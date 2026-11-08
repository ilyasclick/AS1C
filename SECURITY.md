# Secret handling

Do not commit Google OAuth tokens, Apps Script deployment credentials, PayKeeper accounts or password files, print-server bearer tokens, personal/student records, PDF payloads, or live service state.

The bound GAS program reads IDs, the print-service URL, and its bearer token from Google Apps Script Script Properties. Set them in the authorized Apps Script project before deploying; the included JSON file is an empty example, not a deployment config.

The print server reads PRINT_SERVER_TOKEN from the environment. Load a private `print-server.env.local` with file permissions 0600 using systemd EnvironmentFile or an equivalent secret injection mechanism. Its exact value is not stored here.

The PayKeeper adapters use external configuration; the legacy UI must not be deployed automatically. Treat the historical source code as unreviewed for production security.

The standalone operational helper tools use AS1C_* environment variables instead of hard-coded accounts, Script IDs, OAuth paths or credentials.

Run `python3 scripts/scan_secrets.py` before any commit or push. Also manually inspect the entire staged diff. If a secret has already reached GitHub, revoke/rotate it and clean repository history; ignoring it afterward is insufficient.

No production configuration, current deployments, financial data, or 1C records are changed by this repository snapshot.
