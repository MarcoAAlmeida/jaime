// strudel.cc encodes a pattern in its URL fragment as plain base64 of
// the UTF-8 source — confirmed by decoding several of its own
// examples (add-favorite-patterns design.md, decision 4). No
// compression, no server round-trip, no proxy.
export function toStrudelUrl(code: string): string {
  return `https://strudel.cc/#${btoa(unescape(encodeURIComponent(code)))}`
}
