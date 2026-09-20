## 1. Secret

- [ ] 1.1 Generate a shared secret value and set it via `wrangler secret put` on jaime (name it clearly, e.g. `GAMES_VERIFY_SECRET`)
- [ ] 1.2 Document in this endpoint's code comment that jaime-games must hold the same value as its own secret, set independently there (out of scope here)

## 2. Endpoint

- [ ] 2.1 Add the verify route (e.g. `server/api/session/verify.post.ts`) that reads a session identifier from the request body
- [ ] 2.2 Reject the request (no account data returned) unless the shared-secret header matches, using a constant-time comparison
- [ ] 2.3 Look up the session the same way the existing "current account" query does, returning id, display name, and avatar URL on a valid session
- [ ] 2.4 Return an explicit "no account" response (not a thrown error) for a missing, invalid, or expired session identifier
- [ ] 2.5 Confirm the lookup has no side effects — it must not refresh, extend, or invalidate the session

## 3. Verification

- [ ] 3.1 Test: a request with a valid secret and a valid session identifier returns the correct account data
- [ ] 3.2 Test: a request with a valid secret and an invalid/expired/missing session identifier returns the explicit "no account" response
- [ ] 3.3 Test: a request missing or with an incorrect secret does not return account data, regardless of the session identifier supplied
- [ ] 3.4 Confirm existing same-origin "current account" behavior for jaime's own client is unchanged
