## MODIFIED Requirements

### Requirement: Static Deployment
The system SHALL be deployable as static assets on Cloudflare Workers,
independent of any realtime backend, and reachable at the
`jaime.stream` custom domain.

#### Scenario: Deployed build serves the editor
- **WHEN** a user visits `https://jaime.stream`
- **THEN** the editor and playback work identically to local
  `wrangler dev`
