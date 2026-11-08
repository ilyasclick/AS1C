# AS1C — integration source snapshot

This is a sanitized staging copy of AS1C project source code, **not** a production deployment.
- gas/bound-school: primary bound Google Apps Script, secret-bearing literals replaced with Script Properties.
- gas/avt2: separate test/setup Apps Script.
- paykeeper/backend: current headless API adapter (no credentials configured).
- paykeeper/legacy-ui: superseded local administrative UI; do not use as the target integration.
- printing: PDF print service, with the token passed through an environment file (pending source reconciliation).
- tools: internal GAS account/guard tooling (subject to source review).

Never commit production tokens, OAuth caches, CLASP configuration files, students' data, or PayKeeper credentials.
Use gas/script-properties.example.json for the list of required Script Properties; fill the values in the Google Apps Script environment, not in Git.
Working services, remote GAS code, and 1C were not changed during preparation.
