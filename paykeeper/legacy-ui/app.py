#!/usr/bin/env python3
"""Local-only PayKeeper connection console for project AS1C."""

from __future__ import annotations

import base64
import datetime as dt
import html
import hmac
import http.client
import ipaddress
import json
import os
from pathlib import Path
import secrets
import socket
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


APP_DIR = Path(__file__).resolve().parent
STATE_DIR = APP_DIR / "state"
CONFIG_PATH = STATE_DIR / "paykeeper.json"
ADMIN_KEY_PATH = STATE_DIR / "admin-access-key"
HOST = "127.0.0.1"
PORT = 18764
MAX_BODY = 8192
MAX_REMOTE_RESPONSE = 32768
SESSIONS = {}
LOGIN_FAILURES = []
LOCK = threading.Lock()

STYLE = """
:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#202938;background:#f5f7fb}
*{box-sizing:border-box}body{margin:0;padding:36px 18px}.panel{max-width:670px;margin:auto;background:white;border:1px solid #e0e6ef;border-radius:16px;padding:32px;box-shadow:0 9px 35px #17233a09}
h1{font-size:25px;margin:0 0 7px}p{line-height:1.5;color:#596578}.eyebrow{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#6072aa;font-weight:700}
hr{border:0;border-top:1px solid #e9edf4;margin:26px 0}label{font-weight:600;display:block;margin:16px 0 6px}
input{width:100%;padding:11px 12px;border:1px solid #bac7d7;border-radius:9px;font:inherit}
button{background:#253c9b;color:#fff;border:0;border-radius:9px;padding:11px 18px;font:inherit;font-weight:600;cursor:pointer}
button.secondary{background:#edf1fa;color:#273a75}button:disabled{opacity:.5;cursor:not-allowed}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}
.notice{padding:12px 14px;border-radius:9px;background:#edf4ff;margin:18px 0;color:#24385b}
.warning{background:#fff4ed;color:#784a23}.ok{background:#edfaef;color:#255f31}
small{color:#657184}.footer{font-size:13px;margin-top:30px}
a{color:#233fa5}code{background:#f1f3f7;border-radius:4px;padding:2px 4px}
"""
HEAD = """<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>AS1C · PayKeeper</title>
<style>@@STYLE@@</style></head><body><main class="panel">"""
FOOT = """<p class="footer">AS1C · Локальный интерфейс, 127.0.0.1:18764.
<a href="https://docs.paykeeper.ru/dokumentatsiya-json-api/" target="_blank" rel="noreferrer">Документация PayKeeper</a></p></main></body></html>"""


def esc(value):
    return html.escape(str(value), quote=True)


def init_state():
    os.umask(0o077)
    STATE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    if STATE_DIR.is_symlink():
        raise RuntimeError("Unsafe state directory")
    STATE_DIR.chmod(0o700)
    if not ADMIN_KEY_PATH.exists():
        fd = os.open(str(ADMIN_KEY_PATH), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(secrets.token_urlsafe(32) + "\n")
    if ADMIN_KEY_PATH.is_symlink() or ADMIN_KEY_PATH.stat().st_mode & 0o077:
        raise RuntimeError("Unsafe admin token permissions")


def admin_key():
    return ADMIN_KEY_PATH.read_text(encoding="utf-8").strip()


def load_config():
    if not CONFIG_PATH.exists():
        return {}
    if CONFIG_PATH.is_symlink() or CONFIG_PATH.stat().st_mode & 0o077:
        raise RuntimeError("Unsafe config permissions")
    data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def save_config(data):
    tmp = STATE_DIR / ("config-" + secrets.token_hex(8) + ".tmp")
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, separators=(",", ":"))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, CONFIG_PATH)
    finally:
        tmp.unlink(missing_ok=True)


def validate_server(value):
    raw = value.strip().rstrip("/")
    parsed = urllib.parse.urlsplit(raw)
    hostname = (parsed.hostname or "").lower()
    if (parsed.scheme != "https" or parsed.username or parsed.password or
            parsed.path or parsed.query or parsed.fragment or
            not hostname.endswith(".paykeeper.ru") or
            not hostname.replace(".", "").replace("-", "").isalnum() or
            parsed.port not in (None, 443)):
        raise ValueError("Разрешён только HTTPS-адрес сервера *.paykeeper.ru без пути и порта.")
    return "https://" + hostname


class PinnedConnection(http.client.HTTPSConnection):
    """Connect to a previously checked public IP; preserve PayKeeper SNI/TLS hostname."""

    def __init__(self, hostname, address):
        super().__init__(hostname, port=443, timeout=9, context=ssl.create_default_context())
        self.pinned_address = address

    def connect(self):
        raw = socket.create_connection((self.pinned_address, 443), timeout=self.timeout)
        self.sock = self._context.wrap_socket(raw, server_hostname=self.host)


def test_paykeeper(config):
    server = validate_server(config.get("server", ""))
    username = config.get("username", "")
    password = config.get("password", "")
    if not username or not password:
        raise ValueError("Укажите имя пользователя и пароль API.")
    hostname = urllib.parse.urlsplit(server).hostname
    try:
        addrinfos = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise ValueError("Не удалось определить адрес сервера PayKeeper.") from exc
    addresses = list(dict.fromkeys(item[4][0] for item in addrinfos))
    if not addresses or any(not ipaddress.ip_address(addr).is_global for addr in addresses):
        raise ValueError("Адрес PayKeeper разрешается в непубличный IP.")
    auth = base64.b64encode((username + ":" + password).encode("utf-8")).decode("ascii")
    connection = PinnedConnection(hostname, addresses[0])
    try:
        connection.request("GET", "/info/systems/list/", headers={
            "Authorization": "Basic " + auth,
            "Accept": "application/json",
        })
        response = connection.getresponse()
        if response.status != 200:
            raise ValueError("HTTP response was not 200.")
        content = response.read(MAX_REMOTE_RESPONSE + 1)
        if len(content) > MAX_REMOTE_RESPONSE:
            raise ValueError("Response too large.")
        payload = json.loads(content)
    except (OSError, ValueError, http.client.HTTPException, ssl.SSLError) as exc:
        raise ValueError("Не удалось подтвердить ответ API: проверьте адрес, доступ и учётные данные.") from exc
    finally:
        connection.close()
    if not isinstance(payload, list):
        raise ValueError("PayKeeper вернул неожиданный формат ответа. Проверьте API-права.")
    return len(payload)


def login_allowed():
    now = time.time()
    with LOCK:
        LOGIN_FAILURES[:] = [stamp for stamp in LOGIN_FAILURES if now - stamp < 600]
        return len(LOGIN_FAILURES) < 10


def login_failed():
    with LOCK:
        LOGIN_FAILURES.append(time.time())


def login_succeeded():
    with LOCK:
        LOGIN_FAILURES.clear()


def page(body):
    return (HEAD.replace("@@STYLE@@", STYLE) + body + FOOT).encode("utf-8")


def login_page(message=""):
    notice = '<div class="notice warning">' + esc(message) + '</div>' if message else ""
    body = ('<div class="eyebrow">Интеграция AS1C</div><h1>PayKeeper</h1>'
            '<p>Для доступа к настройкам введите локальный ключ администратора. '
            'Ключ хранится только на сервере в закрытом каталоге приложения.</p>'
            + notice +
            '<form action="/login" method="post"><label for="key">Ключ администратора</label>'
            '<input id="key" name="key" type="password" autocomplete="off" required>'
            '<div class="actions"><button type="submit">Войти</button></div></form>')
    return page(body)


def dashboard(session, message="", kind="ok"):
    cfg = load_config()
    configured = bool(cfg.get("server") and cfg.get("username") and cfg.get("password"))
    csrf = esc(session["csrf"])
    status = "Сохранено, API ещё не проверен" if configured else "Параметры PayKeeper не заданы"
    notice = '<div class="notice ' + esc(kind) + '">' + esc(message) + '</div>' if message else ""
    password_hint = "Оставьте пустым, чтобы сохранить существующий пароль." if configured else "Пароль API сохраняется только на сервере."
    body = ( '<div class="eyebrow">AS1C / PayKeeper</div><h1>Подключение PayKeeper</h1>'
             '<p>Изолированная настройка для автошколы. Нет доступа к платежам, '
             'не создаются счета и не выполняются изменения в 1С.</p>'
             '<div class="notice">' + esc(status) + '</div>' + notice +
             '<form action="/settings" method="post">'
             '<input type="hidden" name="csrf" value="' + csrf + '">'
             '<label for="server">Адрес сервера PayKeeper</label>'
             '<input id="server" type="url" name="server" autocomplete="off" '
             'placeholder="https://your.server.paykeeper.ru" value="' + esc(cfg.get("server", "")) + '" required>'
             '<small>Только HTTPS и домены *.paykeeper.ru.</small>'
             '<label for="username">Пользователь API</label>'
             '<input id="username" name="username" autocomplete="off" value="' + esc(cfg.get("username", "")) + '" required>'
             '<label for="password">Пароль API</label>'
             '<input id="password" name="password" type="password" autocomplete="new-password" '
             + ("" if configured else "required ") + '>'
             '<small>' + esc(password_hint) + '</small>'
             '<div class="actions"><button type="submit">Сохранить параметры</button></div></form>'
             '<hr><form action="/probe" method="post">'
             '<input type="hidden" name="csrf" value="' + csrf + '">'
             '<button class="secondary" type="submit"' + ("" if configured else " disabled") +
             '>Проверить подключение (только чтение)</button></form>'
             '<p><small>Проверка использует GET /info/systems/list/. Выставление счетов, возвраты, '
             'webhook и синхронизация с 1С не включены.</small></p>'
             '<hr><form action="/logout" method="post">'
             '<input type="hidden" name="csrf" value="' + csrf + '">'
             '<button class="secondary" type="submit">Выйти</button></form>')
    return page(body)


class Handler(BaseHTTPRequestHandler):
    server_version = "AS1C-PayKeeper/0.1"

    def log_message(self, fmt, *args):
        # Never log URLs containing credentials or request bodies.
        print(dt.datetime.now(dt.timezone.utc).isoformat(), "http", self.command, self.path.split("?")[0],
              "status", args[1] if len(args) >= 2 else "-", flush=True)

    def send(self, status, data, content_type="text/html; charset=utf-8", cookie=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(data)

    def valid_host(self):
        return self.headers.get("Host", "") in ("127.0.0.1:18764", "localhost:18764")

    def session(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        ident = cookie.get("as1c_session")
        if not ident:
            return None
        with LOCK:
            now = time.time()
            for key, entry in list(SESSIONS.items()):
                if entry["until"] <= now:
                    SESSIONS.pop(key, None)
            current = SESSIONS.get(ident.value)
            if current and current["until"] > now:
                return current
        return None

    def parse_post(self):
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Неверная длина запроса.")
        if n < 0 or n > MAX_BODY or self.headers.get("Content-Type", "").split(";")[0].strip() != "application/x-www-form-urlencoded":
            raise ValueError("Некорректное содержимое формы.")
        value = self.rfile.read(n).decode("utf-8")
        return {k: v[0] for k, v in urllib.parse.parse_qs(value, keep_blank_values=True).items()}

    def do_GET(self):
        if not self.valid_host():
            return self.send(HTTPStatus.BAD_REQUEST, b"Invalid host", "text/plain")
        if self.path == "/health":
            return self.send(HTTPStatus.OK, b'{"status":"ok"}', "application/json")
        if self.path not in ("/", "/login"):
            return self.send(HTTPStatus.NOT_FOUND, b"Not found", "text/plain")
        active = self.session()
        return self.send(HTTPStatus.OK, dashboard(active) if active else login_page())

    def do_POST(self):
        if not self.valid_host():
            return self.send(HTTPStatus.BAD_REQUEST, b"Invalid host", "text/plain")
        origin = self.headers.get("Origin", "")
        if origin and origin not in ("http://127.0.0.1:18764", "http://localhost:18764"):
            return self.send(HTTPStatus.FORBIDDEN, b"Origin denied", "text/plain")
        try:
            form = self.parse_post()
        except (UnicodeError, ValueError) as exc:
            return self.send(HTTPStatus.BAD_REQUEST, page("<h1>Ошибка формы</h1><p>" + esc(exc) + "</p>"))
        if self.path == "/login":
            if not login_allowed():
                return self.send(HTTPStatus.TOO_MANY_REQUESTS, login_page("Слишком много попыток входа. Повторите позже."))
            expected = admin_key()
            supplied = form.get("key", "")
            if not hmac.compare_digest(supplied, expected):
                login_failed()
                return self.send(HTTPStatus.UNAUTHORIZED, login_page("Неверный ключ."))
            login_succeeded()
            ident = secrets.token_urlsafe(32)
            active = {"csrf": secrets.token_urlsafe(32), "until": time.time() + 7200}
            with LOCK:
                if len(SESSIONS) >= 64:
                    oldest = min(SESSIONS, key=lambda key: SESSIONS[key]["until"])
                    SESSIONS.pop(oldest, None)
                SESSIONS[ident] = active
            return self.send(HTTPStatus.OK, dashboard(active),
                             cookie="as1c_session=" + ident + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200")
        active = self.session()
        if not active or not hmac.compare_digest(form.get("csrf", ""), active["csrf"]):
            return self.send(HTTPStatus.FORBIDDEN, b"Access denied", "text/plain")
        if self.path == "/logout":
            cookie = SimpleCookie()
            cookie.load(self.headers.get("Cookie", ""))
            token = cookie.get("as1c_session")
            if token:
                with LOCK:
                    SESSIONS.pop(token.value, None)
            return self.send(HTTPStatus.OK, login_page(), cookie="as1c_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict")
        if self.path == "/settings":
            try:
                server = validate_server(form.get("server", ""))
                username = form.get("username", "").strip()
                password = form.get("password", "")
                if not username or len(username) > 128:
                    raise ValueError("Введите имя пользователя API.")
                if not password:
                    current = load_config()
                    password = current.get("password", "")
                if not password or len(password) > 4096:
                    raise ValueError("Введите пароль API.")
                save_config({"server": server, "username": username, "password": password})
                return self.send(HTTPStatus.OK, dashboard(active, "Параметры сохранены. Подключение ещё не проверено."))
            except (ValueError, OSError) as exc:
                return self.send(HTTPStatus.BAD_REQUEST, dashboard(active, str(exc), "warning"))
        if self.path == "/probe":
            try:
                count = test_paykeeper(load_config())
                return self.send(HTTPStatus.OK, dashboard(active, "Подключение подтверждено: API ответил. Платёжных систем: " + str(count)))
            except (ValueError, OSError, socket.error) as exc:
                return self.send(HTTPStatus.BAD_GATEWAY, dashboard(active, str(exc), "warning"))
        return self.send(HTTPStatus.NOT_FOUND, b"Not found", "text/plain")


if __name__ == "__main__":
    init_state()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    print("AS1C PayKeeper local admin console listening on http://127.0.0.1:18764", flush=True)
    server.serve_forever()
