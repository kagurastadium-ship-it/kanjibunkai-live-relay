# KanjiBunkai protected LIVE relay — local proposal, not deployed

The current public Kanji service is the legacy relay. This directory is an inactive private candidate. Do not deploy it or enable an app URL until the operator explicitly approves the authentication policy and cutover.

## Runtime and non-secret configuration

Node >=20 (Docker base remains node:24-alpine). Use the existing lockfile and `npm ci --omit=dev --no-audit --no-fund`. Unchanged TikTok connector2.5.0/ws8.22.1; Firebase Admin14.5.0 is added relative to the deployed legacy version.

- `GOOGLE_CLOUD_PROJECT`: proposed value `kanji-bunkai-orl`; must match the existing Kanji app's native and web Firebase project. Do not copy another app's project.
- `AUTH_VERIFICATION_MODE`: explicitly select `public_jwt` or `revocation`. Missing/unknown mode fails startup; no automatic fallback.
- `public_jwt`: ID token and App Check signed-token/project/expiry verification using Google's public certificate/JWKS paths. No Admin service-account key or Auth user-record access is needed for this path. Immediate account-disable/revocation lookup is not performed; an issued token can remain acceptable until its real expiry. A session limit is not a replacement for revocation checking.
- `revocation`: existing `verifyIdToken(token,true)` plus App Check verification. Existing authorized Admin credentials and Kanji Auth user-state read permission are necessary. Never create/copy keys or broaden permissions merely to start this candidate.
- `FIREBASE_APP_IDS`: required comma-separated approved native/web Firebase app IDs from the same project number. Exact app ID allowlist and exact App Check issuer project number are enforced. Values must be confirmed against existing app configuration before deployment.
- `FIREBASE_AUTH_EMULATOR_HOST` must be absent; otherwise startup fails.
- `HOST`, `PORT`: existing hosting values. Optional `EULER_API_KEY` is a separate upstream signing-service credential; never send it from the app or print it. No credential values are included here.

## Protocol, lifetime and health

The current app already sends subscribe fields `tiktokId`, `subscriptionId`, `activity`, `idToken`, `appCheckToken`. No client-code downgrade is required. Authentication failure rejects before an upstream connection and returns a generic failure only. Sessions close at the earlier of both verified tokens' expiry or30minutes; fresh authentication is needed to reconnect. Multiple clients have separate lifetimes even when sharing one upstream room. Old tokenless apps will fail authentication after cutover.

`GET /health` reports process liveness only. It does not prove Firebase permissions, token validity, upstream TikTok availability, or end-to-end LIVE readiness. It opens no upstream connection. `/live` accepts subscribe over WebSocket; tokens are not placed in URLs. Public source whitelist remains available for AGPL source distribution and does not serve environment or secret files.

No polling/keepalive traffic or paid-plan changes are introduced. Max32rooms/128clients, bounded starts/subscriptions/buffers and connection timeout remain inherited from the current implementation. No usernames/profile data/comment histories are stored. See LICENSE and THIRD_PARTY_NOTICES.md.

## Local validation limits

Normal clean npm ci from the official registry succeeded in ../runtime-validation/server (238 packages, install scripts disabled). This supersedes the earlier offline-cache failure. 28 local unit/SDK tests pass. 17 additional real Node-process tests pass using the actual installed Admin SDK RSA signature verification, loopback public-key transport, ephemeral memory-only signed fixtures and a fake TikTok upstream. They cover health, key-fetch failure fail-closed, signature/issuer/audience/project/expiry/app-ID rejection, valid connection, separate expiry with shared upstream, release/reconnect and secret-free logs/zero credential access. No real user tokens, Google/TikTok requests, service credentials or production connections were used. All test child processes exited.

Docker is not installed; no Docker image build was performed. Node24.22.0 real-process startup is verified, not Render deployment or end-to-end upstream availability. Immediate Auth disable/revocation lookup and App Check replay consumption are not supplied by public_jwt. No new software, external settings or plan changes were made.
