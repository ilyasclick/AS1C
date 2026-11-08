#!/usr/bin/env python3
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
res = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True)
paths = [pathlib.Path(p.decode()) for p in res.stdout.split(b"\0") if p]
blocked_names = {
    ".clasp.json", ".clasprc.json", "credentials.json", "token.json",
    "id_rsa", "id_ed25519", "admin-access-key",
}
blocked_parts = {"secrets", "state", "__pycache__", ".venv", "node_modules"}
patterns = {
    "private_key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "github_token": re.compile(r"(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{15,}"),
    "google_api_key": re.compile(r"AIza[0-9A-Za-z_-]{30,}"),
    "aws_access_key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "generic_literal_secret": re.compile(
        r"""(?im)\b(?:AUTH_TOKEN|API_KEY|ACCESS_TOKEN|CLIENT_SECRET|PASSWORD|SECRET_KEY|PRINT_SERVER_TOKEN)\s*[:=]\s*["'][^"']{8,}["']"""
    ),
}
problems = []
for rel in paths:
    if rel.name in blocked_names or rel.name.endswith((".pem", ".p12", ".pfx", ".key")):
        problems.append((str(rel), "secret_file"))
        continue
    if any(p in blocked_parts for p in rel.parts) or ".env" in rel.name and not rel.name.endswith(".example"):
        problems.append((str(rel), "sensitive_path"))
        continue
    try:
        text = (ROOT / rel).read_text(encoding="utf-8")
    except UnicodeDecodeError:
        problems.append((str(rel), "binary_file_manual_review"))
        continue
    for label, pattern in patterns.items():
        if pattern.search(text):
            problems.append((str(rel), label))
    for match in re.finditer(r"[\w.+-]+@([\w.-]+\.[A-Za-z]{2,})", text):
        domain = match.group(1).lower()
        if domain not in {"example.invalid", "example.com", "example.org", "example.net", "localhost"}:
            problems.append((str(rel), "non_example_email"))
if problems:
    for name, reason in sorted(set(problems)):
        print("FAIL", name, reason)
    sys.exit(1)
print("PASS scanned_tracked_files="+str(len(paths)))
