## 1. Shared constant

- [ ] 1.1 Add `SESSION_COOKIE_DOMAIN` next to `SESSION_COOKIE` in `server/utils/auth.ts`, `undefined` in dev and `.jaime.stream` otherwise (mirroring the existing `secure: !import.meta.dev` branch)

## 2. Set and clear

- [ ] 2.1 Pass `domain: SESSION_COOKIE_DOMAIN` in `setSessionCookie`'s `setCookie` call
- [ ] 2.2 Pass `domain: SESSION_COOKIE_DOMAIN` in `clearSessionCookie`'s `deleteCookie` call
- [ ] 2.3 Confirm `httpOnly`, `secure`, `sameSite`, `path`, and `maxAge` are otherwise untouched

## 3. Verification

- [ ] 3.1 Local dev: sign in, confirm the cookie is still set and works on `localhost` (no `Domain` attribute)
- [ ] 3.2 Deployed: sign in on `jaime.stream`, inspect the cookie and confirm `Domain=.jaime.stream`
- [ ] 3.3 Deployed: confirm a request to `games.jaime.stream` now carries the cookie
- [ ] 3.4 Deployed: sign out, confirm the cookie is actually removed (not left behind with the old scope, not left behind as a stray host-only cookie)
- [ ] 3.5 Confirm a session cookie issued before this change still authenticates correctly on `jaime.stream` (no forced sign-out on deploy)
