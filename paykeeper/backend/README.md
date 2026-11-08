# AS1C PayKeeper — headless read-only adapter

State: PREPARED / NO PAYKEEPER CREDENTIALS / NO FINANCIAL INTEGRATION.

This is an isolated Python 3 standard-library module; it contains no web UI, no listening port, no daemon, no webhook and no POST requests. It does not modify PayKeeper, Google, Access or 1C.

## Deployment

Host: RDCX device ubuntu-code-tdrezerv (code.tdrezerv.com).
Path: /home/ilyas/as1c/paykeeper-backend/
Entrypoint: paykeeper.py
Tests: test_paykeeper.py
Legacy UI service: as1c-paykeeper.service is separate and unchanged.

## Runtime behavior

- CLI action "status": checks whether required environment entries are present, but never contacts PayKeeper.
- CLI action "probe": only GET /info/systems/list/ with Basic Authorization via verified TLS.
- Expected origin is strictly HTTPS on port 443 with no path, query or userinfo.
- All DNS records must resolve to public IPs; TLS is established to the resolved IP and verified against the original hostname.
- Redirects are refused. Responses are limited to 128 KiB.
- Logs/output include only safe error codes and the number of payment systems; no response bodies, payment details, usernames, passwords, tokens or Basic headers.
- Missing configuration fails closed, without a network request.

## Configuration boundary

The adapter expects AS1C_PAYKEEPER_ORIGIN, AS1C_PAYKEEPER_USERNAME, AS1C_PAYKEEPER_PASSWORD supplied in the process environment. None are populated or stored in this installation. Do not put credentials on the command line, in Library, in shell history, in a repository, or in automation prompts. Before any real use, agree on a least-privilege credential store and safe injection mechanism; ensure operator readback never prints secrets.

No scheduled execution or service is installed. Real API probe requires separate consent plus credentials. Payment events, reconciliation, retries, callbacks, refunds and 1C exchange are not implemented or authorized.

## Offline verification

python3 -B -m unittest -q test_paykeeper
python3 -B paykeeper.py status

Only the public vendor API docs were used:
https://docs.paykeeper.ru/dokumentatsiya-json-api/
https://docs.paykeeper.ru/dokumentatsiya-json-api/token-bezopasnosti/
https://docs.paykeeper.ru/vozmozhnosti-i-primery-ispolzovaniya/poluchenie-informatsii-o-spiske-platezhnyh-sistem-s-pomoshhyu-json-api/
