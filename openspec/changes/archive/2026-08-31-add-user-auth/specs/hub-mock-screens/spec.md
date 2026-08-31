## REMOVED Requirements

### Requirement: Community Signup Mock Accepts An Email
**Reason**: Signup is a real feature now — see the new `user-account`
capability. `/signup` performs a real passwordless sign-in / register
flow and sends a real email.
**Migration**: Replaced by `user-account`'s "Request a Sign-In Link by
Email" and related requirements.
