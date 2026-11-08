"""Offline tests: no real PayKeeper requests or business data."""
import contextlib
import io
import json
import os
from pathlib import Path
import re
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error

import app


class PayKeeperTests(unittest.TestCase):
    def test_address_validation(self):
        self.assertEqual(app.validate_server("https://demo.paykeeper.ru/"), "https://demo.paykeeper.ru")
        for value in (
            "http://demo.paykeeper.ru",
            "https://paykeeper.ru.evil.com",
            "https://127.0.0.1",
            "https://demo.paykeeper.ru/private",
            "https://demo.paykeeper.ru/?x=1",
            "https://demo.paykeeper.ru:8080",
            "https://user:demo@example.invalid",
            "https://demo.paykeeper.ru#fragment",
        ):
            with self.subTest(value=value), self.assertRaises(ValueError):
                app.validate_server(value)

    def test_read_only_probe_with_mocked_api(self):
        class FakeResponse:
            status = 200

            def read(self, limit):
                return b'[{"id":"1"},{"id":"2"}]'

        class FakeConnection:
            def request(self, method, uri, headers):
                assert method == "GET"
                assert uri == "/info/systems/list/"
                assert "Basic " in headers["Authorization"]

            def getresponse(self):
                return FakeResponse()

            def close(self):
                pass

        mock_dns = [(None, None, None, None, ("8.8.8.8", 443))]
        with patch.object(app.socket, "getaddrinfo", return_value=mock_dns):
            with patch.object(app, "PinnedConnection", return_value=FakeConnection()) as pinned:
                count = app.test_paykeeper({
                    "server": "https://demo.paykeeper.ru",
                    "username": "tester",
                    "password": "fake-secret",
                })
                pinned.assert_called_once_with("demo.paykeeper.ru", "8.8.8.8")
        self.assertEqual(count, 2)

    def test_probe_blocks_private_dns(self):
        with patch.object(app.socket, "getaddrinfo", return_value=[(None, None, None, None, ("127.0.0.1", 443))]):
            with self.assertRaises(ValueError):
                app.test_paykeeper({"server": "https://demo.paykeeper.ru", "username": "x", "password": "y"})

    def test_login_rate_limiter(self):
        old = list(app.LOGIN_FAILURES)
        try:
            app.LOGIN_FAILURES.clear()
            self.assertTrue(app.login_allowed())
            for _ in range(10):
                app.login_failed()
            self.assertFalse(app.login_allowed())
            app.login_succeeded()
            self.assertTrue(app.login_allowed())
        finally:
            app.LOGIN_FAILURES[:] = old

    def test_secret_files_private_and_roundtrip(self):
        with tempfile.TemporaryDirectory() as folder:
            old = (app.STATE_DIR, app.ADMIN_KEY_PATH, app.CONFIG_PATH)
            app.STATE_DIR = Path(folder) / "state"
            app.ADMIN_KEY_PATH = app.STATE_DIR / "admin-access-key"
            app.CONFIG_PATH = app.STATE_DIR / "paykeeper.json"
            try:
                app.init_state()
                self.assertEqual(app.ADMIN_KEY_PATH.stat().st_mode & 0o077, 0)
                self.assertTrue(app.admin_key())
                app.save_config({"server": "https://demo.paykeeper.ru", "username": "test", "password": "fake"})
                self.assertEqual(app.load_config()["username"], "test")
                self.assertEqual(app.CONFIG_PATH.stat().st_mode & 0o077, 0)
            finally:
                app.STATE_DIR, app.ADMIN_KEY_PATH, app.CONFIG_PATH = old


if __name__ == "__main__":
    unittest.main(verbosity=2)
