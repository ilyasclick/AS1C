# AS1C · PayKeeper connection console

Deployment: code.tdrezerv.com (RDCX: ubuntu-code-tdrezerv)
App: /home/ilyas/as1c/paykeeper-integration/app.py
Service: as1c-paykeeper.service
Bind: 127.0.0.1:18764 (NOT public)
Version: 0.1
Status: BASIC_LOCAL_INTERFACE_DEPLOYED; PAYKEEPER_NOT_CONFIGURED

## Local access

Use an SSH tunnel from your own device:

    ssh -L 18764:127.0.0.1:18764 demo@example.invalid

Open in a browser on the same device:

    http://127.0.0.1:18764/

Read the local administrator key in your private SSH terminal:

    cat /home/ilyas/as1c/paykeeper-integration/state/admin-access-key

Do not copy the key or PayKeeper credentials to ChatGPT, Library, public URLs, logs, or Git.

## Functional scope

- Login with an app-specific random admin key; 10 failures/10 minutes rate limit, 64-session cap/expired session cleanup, HttpOnly SameSite cookie and CSRF-protected POST forms.
- Save HTTPS PayKeeper instance URL (*.paykeeper.ru), API username and password, masked in UI.
- Store API credentials only in state/paykeeper.json with mode 0600 in mode-0700 private directory.
- On demand, test Basic HTTP auth via GET /info/systems/list/ only; never send POST to PayKeeper.
- No invoices, charges, refunds, webhooks, student data, payment history, Google edits, Access or 1C updates.
- HTTPS TLS validation, DNS-pinned connection with verified PayKeeper hostname, no redirects/proxies, restricted *.paykeeper.ru hostnames, public DNS requirement.
- App listens ONLY on loopback; no external nginx route created.
- The first account should preferably be a dedicated API user with minimal permissions, not the primary administrator.

## Verification

    systemctl status as1c-paykeeper.service
    curl -i http://127.0.0.1:18764/health
    cd /home/ilyas/as1c/paykeeper-integration && python3 -m unittest -v test_app
    cd /home/ilyas/as1c/paykeeper-integration && python3 smoke_test.py

The integration and unit tests use no PayKeeper credentials; no real outbound PayKeeper request has been made.

## Rollback of deployment

    sudo systemctl disable --now as1c-paykeeper.service
    sudo rm /etc/systemd/system/as1c-paykeeper.service
    sudo systemctl daemon-reload

The data directory should be retained until specifically authorized to delete it. Do not purge secrets automatically.

## Pending

1. Verify exact PayKeeper instance hostname and dedicated read-only API credentials via secure local UI.
2. Run authorized GET connection test; confirm the result without exporting payment data.
3. Map payment/order/student keys and create a separate approved plan for synchronization and webhook verification.
4. Independent audit, accountant reconciliation, backup and rollback before anything affects production 1C.
