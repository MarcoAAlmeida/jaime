/**
 * The "to @jah" switch's outgoing rule (uplift-chat-interface design
 * decision 5): prepend `@jah ` unless the text already addresses `@jah`.
 *
 * "Already addresses" MUST match the server's `classifyMention`
 * (server/jah/route.ts): the first whitespace-delimited token is exactly
 * `@jah`, case-insensitively. Anything looser (`@jah,` or `@jahn`) would
 * skip the prefix on a message the server does not treat as addressed —
 * so the switch would silently fail to reach `@jah`. Parity is asserted
 * in test/jah-mention.test.ts.
 */
export function withJahMention(text: string): string {
  const trimmed = text.trim()
  const first = trimmed.split(/\s+/)[0]?.toLowerCase()
  return first === '@jah' ? trimmed : `@jah ${trimmed}`
}
