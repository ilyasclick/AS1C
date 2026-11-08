"""Live local smoke test, never prints admin key or credentials."""
import http.cookiejar
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:18764"
key = (Path(__file__).resolve().parent / "state" / "admin-access-key").read_text().strip()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

with opener.open(BASE + "/health", timeout=4) as response:
    assert response.status == 200
    assert response.read() == b'{"status":"ok"}'
with opener.open(BASE + "/", timeout=4) as response:
    assert "Ключ администратора" in response.read().decode()
assert not (Path(__file__).resolve().parent / "state" / "paykeeper.json").exists()

def post(route, fields):
    data = urllib.parse.urlencode(fields).encode()
    request = urllib.request.Request(BASE + route, data=data, method="POST")
    try:
        with opener.open(request, timeout=4) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()

status, _ = post("/settings", {"server": "https://demo.paykeeper.ru"})
assert status == 403, status

status, _ = post("/login", {"key": "wrong-key"})
assert status == 401, status

status, body = post("/login", {"key": key})
assert status == 200 and "Подключение PayKeeper" in body, status
csrf = re.search('name="csrf" value="([^"]+)"', body).group(1)

status, _ = post("/settings", {"csrf": "wrong", "server": "https://demo.paykeeper.ru"})
assert status == 403, status

status, body = post("/settings", {
    "csrf": csrf,
    "server": "https://localhost",
    "username": "not-real",
    "password": "not-real",
})
assert status == 400 and "Разрешён только HTTPS" in body, status
assert not (Path(__file__).resolve().parent / "state" / "paykeeper.json").exists()

status, _ = post("/logout", {"csrf": csrf})
assert status == 200, status
status, _ = post("/settings", {"csrf": csrf})
assert status == 403, status

for test_request in (
    urllib.request.Request(BASE + "/health", headers={"Host": "example.org"}),
    urllib.request.Request(BASE + "/settings",
                           data=urllib.parse.urlencode({"csrf": csrf}).encode(),
                           headers={"Origin": "https://example.org"},
                           method="POST"),
):
    try:
        opener.open(test_request, timeout=4)
        raise AssertionError("Untrusted request was accepted")
    except urllib.error.HTTPError as exc:
        assert exc.code in (400, 403), exc.code

print("PASS: live health, login, CSRF, origin/host, SSRF rejection, logout, no credentials configured")
