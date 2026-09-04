# admin-console Specification

## Purpose

An operator-only surface for seeing every jaime account and controlling
who may use `@jah`. It owns the account roster, the per-user `ai_access`
flag and its environment-list override, the single effective-access
check other features call, and a read-only view of `@jah` usage
records.

## Requirements

### Requirement: The Admin Surface Is Operator-Only

The system SHALL restrict the `/admin` page and every admin API to a
single hard-coded operator identity (matched by GitHub login or account
email). A request from anyone else SHALL be refused the same way a
missing route is — no account list, no toggle, no usage data, and no
acknowledgement that the surface exists. The refusal SHALL be enforced
on the server for each admin request, not only by the page.

#### Scenario: The operator opens the admin page

- **WHEN** the operator, signed in, opens `/admin`
- **THEN** the account roster and usage view load

#### Scenario: A signed-in non-operator tries the admin page

- **WHEN** a signed-in account that is not the operator opens `/admin`
- **THEN** it is treated as a missing page, with no admin data returned

#### Scenario: An anonymous visitor tries the admin page

- **WHEN** a visitor with no session opens `/admin`
- **THEN** it is treated as a missing page

#### Scenario: An admin API is called directly by a non-operator

- **WHEN** a non-operator (or anonymous) request hits an admin API
  endpoint directly, bypassing the page
- **THEN** the endpoint refuses it and returns no account or usage data

### Requirement: The Operator Sees Every Account

The system SHALL show the operator a roster of all accounts. Each entry
SHALL include the account's display name, email, GitHub login (when the
account has one), confirmed status, creation date, and its effective
`@jah` access with an indication of why (granted by the per-user flag,
granted by the environment allowlist, or not granted).

#### Scenario: The roster lists accounts

- **WHEN** the operator loads the admin page
- **THEN** every account appears with its name, email, GitHub login,
  status, join date, and effective `@jah` access

#### Scenario: A newly created account appears

- **WHEN** a person creates an account and the operator reloads the
  roster
- **THEN** the new account is listed

### Requirement: The Operator Grants Or Revokes Per-User Access

The system SHALL let the operator turn a specific account's `ai_access`
flag on or off. The change SHALL persist and SHALL determine that
account's effective access from its next `@jah` attempt onward, with no
redeploy. Toggling the flag SHALL NOT affect access that the account
already has via the environment allowlist.

#### Scenario: Granting access to an account

- **WHEN** the operator turns on `ai_access` for an account that had no
  access
- **THEN** that account's effective access becomes granted, and the
  roster reflects it

#### Scenario: Revoking a per-user grant

- **WHEN** the operator turns off `ai_access` for an account whose
  access came only from the flag
- **THEN** that account's effective access becomes not granted

#### Scenario: Revoking the flag does not remove env-allowlist access

- **WHEN** the operator turns off `ai_access` for an account whose
  GitHub login is in the environment allowlist
- **THEN** that account still has effective access, shown as granted by
  the allowlist

### Requirement: The Environment Allowlist Auto-Grants Access

The system SHALL read a configured list of GitHub logins and treat any
account whose GitHub login is in that list as having `@jah` access,
regardless of its per-user flag. An account's **effective access** SHALL
be the per-user flag OR membership in the allowlist. Changing the list
SHALL take effect without a per-account write.

#### Scenario: A login in the allowlist has access

- **WHEN** an account whose GitHub login is in the configured allowlist
  attempts to use `@jah`
- **THEN** the effective-access check grants it, even though its
  per-user flag is off

#### Scenario: A login not in the allowlist and not flagged has no access

- **WHEN** an account that is neither in the allowlist nor flagged
  attempts to use `@jah`
- **THEN** the effective-access check denies it

#### Scenario: Removing a login from the allowlist

- **WHEN** a login is removed from the configured allowlist and that
  account has no per-user flag
- **THEN** the account's effective access becomes denied on its next
  attempt

### Requirement: Effective Access Is Resolvable For Any Account

The system SHALL provide a single server-side check that, given a
signed-in account, returns whether that account currently has effective
`@jah` access. Features that gate on `@jah` access SHALL use this check
rather than reading the flag or the list directly.

#### Scenario: The check reflects a per-user grant

- **WHEN** the effective-access check runs for an account whose
  `ai_access` flag is on
- **THEN** it returns granted

#### Scenario: The check reflects the allowlist

- **WHEN** the effective-access check runs for an account in the
  environment allowlist whose flag is off
- **THEN** it returns granted

#### Scenario: The check denies an unknown or anonymous caller

- **WHEN** the effective-access check runs with no signed-in account
- **THEN** it returns not granted

### Requirement: The Operator Sees Recent `@jah` Usage

The system SHALL show the operator a read-only view of recent `@jah`
usage records, most recent first. Each record SHALL identify the
account (by id and GitHub login), the room, the model, the prompt and
completion token counts, an estimated cost, and when it happened. The
view SHALL render correctly when there are no records yet.

#### Scenario: No usage recorded yet

- **WHEN** the operator opens the usage view before any `@jah` call has
  been made
- **THEN** the view loads and shows that there is no usage yet, not an
  error

#### Scenario: Usage records are listed

- **WHEN** `@jah` usage records exist and the operator opens the view
- **THEN** the records are listed newest first, each showing the
  account, room, model, token counts, estimated cost, and timestamp
