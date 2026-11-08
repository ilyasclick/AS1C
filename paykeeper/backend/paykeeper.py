"""Headless, read-only PayKeeper connectivity adapter for AS1C."""

import argparse
import base64
import http.client
import ipaddress
import json
import os
import re
import socket
import ssl
import sys
from urllib.parse import urlsplit

PATH = "/info/systems/list/"
MAX_BODY = 131072
TIMEOUT_SECONDS = 8


class ProbeError(Exception):
    """A safe, detail-free error code suitable for logs."""


def validate_origin(origin):
    if not isinstance(origin, str) or not origin:
        raise ProbeError("INVALID_ORIGIN")
    try:
        parts = urlsplit(origin)
    except ValueError:
        raise ProbeError("INVALID_ORIGIN") from None
    try:
        port = parts.port
    except ValueError:
        raise ProbeError("INVALID_ORIGIN") from None
    if (
        parts.scheme != "https"
        or not parts.hostname
        or parts.username is not None
        or parts.password is not None
        or parts.path not in ("", "/")
        or parts.query
        or parts.fragment
        or port not in (None, 443)
    ):
        raise ProbeError("INVALID_ORIGIN")
    try:
        host = parts.hostname.encode("idna").decode("ascii").lower()
    except UnicodeError:
        raise ProbeError("INVALID_ORIGIN") from None
    if (
        len(host) > 253
        or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", host)
        or "." not in host
        or ".." in host
        or any(len(p) > 63 or not p or p.startswith("-") or p.endswith("-") for p in host.split("."))
        or host.endswith((".local", ".internal", ".localhost", ".test", ".invalid"))
    ):
        raise ProbeError("INVALID_ORIGIN")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ProbeError("INVALID_ORIGIN")
    return host


def resolve_public_ips(host):
    try:
        records = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except (socket.gaierror, OSError):
        raise ProbeError("DNS_UNAVAILABLE") from None
    ips = list(dict.fromkeys(record[4][0] for record in records))
    if not ips:
        raise ProbeError("DNS_UNAVAILABLE")
    try:
        if any(not ipaddress.ip_address(ip).is_global for ip in ips):
            raise ProbeError("DNS_UNSAFE")
    except ValueError:
        raise ProbeError("DNS_UNSAFE") from None
    return ips


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host, ip):
        super().__init__(host, port=443, timeout=TIMEOUT_SECONDS, context=ssl.create_default_context())
        self.pinned_ip = ip

    def connect(self):
        raw = socket.create_connection((self.pinned_ip, 443), timeout=self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except BaseException:
            raw.close()
            raise


def parse_result(status, payload):
    if status != 200:
        raise ProbeError("HTTP_NOT_OK")
    if len(payload) > MAX_BODY:
        raise ProbeError("RESPONSE_TOO_LARGE")
    try:
        parsed = json.loads(payload)
    except (ValueError, UnicodeError):
        raise ProbeError("INVALID_JSON") from None
    if isinstance(parsed, dict) and parsed.get("result") == "fail":
        raise ProbeError("PAYKEEPER_API_ERROR")
    if not isinstance(parsed, list) or any(not isinstance(item, dict) for item in parsed):
        raise ProbeError("UNEXPECTED_PAYLOAD")
    return {"result": "ok", "systems_count": len(parsed), "read_only": True}


def probe(origin, username, password, *, connection_factory=PinnedHTTPSConnection):
    host = validate_origin(origin)
    if not username or not password or ":" in username:
        raise ProbeError("INVALID_CREDENTIALS")
    ips = resolve_public_ips(host)
    auth = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    conn = None
    try:
        conn = connection_factory(host, ips[0])
        conn.request("GET", PATH, headers={
            "Authorization": f"Basic {auth}",
            "Accept": "application/json",
            "User-Agent": "AS1C-PayKeeper-ReadOnly/0.1",
            "Connection": "close",
        })
        response = conn.getresponse()
        payload = response.read(MAX_BODY + 1)
        return parse_result(response.status, payload)
    except ProbeError:
        raise
    except (OSError, TimeoutError, ssl.SSLError, http.client.HTTPException, ValueError):
        raise ProbeError("TRANSPORT_ERROR") from None
    finally:
        if conn is not None:
            conn.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description="AS1C PayKeeper read-only adapter")
    parser.add_argument("action", choices=["status", "probe"])
    args = parser.parse_args(argv)
    if args.action == "status":
        print(json.dumps({
            "adapter": "paykeeper-read-only",
            "configured": all(os.getenv(k) for k in (
                "AS1C_PAYKEEPER_ORIGIN",
                "AS1C_PAYKEEPER_USERNAME",
                "AS1C_PAYKEEPER_PASSWORD",
            )),
            "remote_call": False,
        }))
        return 0
    config = [os.getenv(k) for k in (
        "AS1C_PAYKEEPER_ORIGIN",
        "AS1C_PAYKEEPER_USERNAME",
        "AS1C_PAYKEEPER_PASSWORD",
    )]
    if not all(config):
        print(json.dumps({"result": "error", "code": "CONFIG_MISSING"}))
        return 2
    try:
        output = probe(*config)
        print(json.dumps(output))
        return 0
    except ProbeError as err:
        print(json.dumps({"result": "error", "code": str(err)}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
