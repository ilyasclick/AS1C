"""Offline tests for the PayKeeper read-only adapter."""

import base64
import io
import json
import os
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

import paykeeper as p


class StubResponse:
    status = 200

    def __init__(self, body=b"[]", status=200):
        self.body = body
        self.status = status

    def read(self, limit):
        return self.body[:limit]


class StubConnection:
    def __init__(self, host, ip, response=None):
        self.host = host
        self.ip = ip
        self.response = response or StubResponse()
        self.request_details = None
        self.closed = False

    def request(self, method, path, headers=None):
        self.request_details = (method, path, headers)

    def getresponse(self):
        return self.response

    def close(self):
        self.closed = True


class PayKeeperTests(unittest.TestCase):
    def test_https_only(self):
        for url in ("http://paykeeper.ru", "https://localhost", "https://127.0.0.1",
                    "https://paykeeper.ru/api", "https://demo@example.invalid",
                    "https://paykeeper.ru:8443", "https://paykeeper.ru:bad", "https://paykeeper.ru?x=1"):
            with self.subTest(url=url), self.assertRaises(p.ProbeError):
                p.validate_origin(url)

    def test_safe_origin(self):
        self.assertEqual(p.validate_origin("https://demo.paykeeper.ru/"), "demo.paykeeper.ru")

    def test_private_dns_rejected(self):
        with patch.object(p.socket, "getaddrinfo", return_value=[
            (2, 1, 6, "", ("93.184.215.14", 443)),
            (2, 1, 6, "", ("10.0.0.1", 443)),
        ]):
            with self.assertRaisesRegex(p.ProbeError, "DNS_UNSAFE"):
                p.resolve_public_ips("demo.paykeeper.ru")

    def test_network_dns_missing(self):
        with patch.object(p.socket, "getaddrinfo", side_effect=p.socket.gaierror()):
            with self.assertRaisesRegex(p.ProbeError, "DNS_UNAVAILABLE"):
                p.resolve_public_ips("demo.paykeeper.ru")

    def test_valid_read_only_request(self):
        conn = StubConnection("demo.paykeeper.ru", "93.184.215.14",
                              StubResponse(b'[{"id":"10"}]'))
        with patch.object(p, "resolve_public_ips", return_value=["93.184.215.14"]):
            output = p.probe("https://demo.paykeeper.ru", "apiuser", "secret",
                             connection_factory=lambda host, ip: conn)
        self.assertEqual(output["systems_count"], 1)
        self.assertEqual(conn.request_details[:2], ("GET", p.PATH))
        token = conn.request_details[2]["Authorization"].split(" ", 1)[1]
        self.assertEqual(base64.b64decode(token), b"apiuser:secret")
        self.assertTrue(conn.closed)

    def test_redirect_is_rejected(self):
        with self.assertRaisesRegex(p.ProbeError, "HTTP_NOT_OK"):
            p.parse_result(302, b"redirect")

    def test_api_failure(self):
        with self.assertRaisesRegex(p.ProbeError, "PAYKEEPER_API_ERROR"):
            p.parse_result(200, b'{"result":"fail","msg":"secret info"}')

    def test_invalid_payload(self):
        for body in (b"{", b'{"message": "ok"}', b'[{"id":1},2]'):
            with self.subTest(body=body), self.assertRaises(p.ProbeError):
                p.parse_result(200, body)

    def test_body_limit(self):
        with self.assertRaisesRegex(p.ProbeError, "RESPONSE_TOO_LARGE"):
            p.parse_result(200, b"x" * (p.MAX_BODY + 1))

    def test_missing_credentials_never_calls_network(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(p, "probe") as mock_probe:
            with redirect_stdout(io.StringIO()) as out:
                code = p.main(["probe"])
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(out.getvalue())["code"], "CONFIG_MISSING")
        mock_probe.assert_not_called()

    def test_status_no_secrets(self):
        with patch.dict(os.environ, {"AS1C_PAYKEEPER_PASSWORD": "SECRET"}, clear=True):
            with redirect_stdout(io.StringIO()) as out:
                self.assertEqual(p.main(["status"]), 0)
        self.assertNotIn("SECRET", out.getvalue())
        self.assertFalse(json.loads(out.getvalue())["configured"])

    def test_reject_colon_username(self):
        with self.assertRaisesRegex(p.ProbeError, "INVALID_CREDENTIALS"):
            p.probe("https://demo.paykeeper.ru", "user:admin", "secret")


if __name__ == "__main__":
    unittest.main()
