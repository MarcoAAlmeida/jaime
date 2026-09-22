// A tiny stand-in for a Strudel package source file (add-strudel-knowledge-corpus
// task 1.1). Documents what scripts/knowledge/__fixtures__/doc.json below is
// the result of running Strudel's own `jsdoc`/`jsdoc-json` against — the
// fixture tests never actually run jsdoc, they inject doc.json directly, but
// this file is what a human reads to see why it looks the way it does.

/**
 * Reverses a pattern: events that were early are now late, and vice versa.
 * @name rev
 * @memberof Pattern
 * @synonyms reverse, flip
 * @tags structure
 * @param {Pattern} pat the pattern to reverse
 * @returns {Pattern}
 * @example
 * note("c d e g").rev()
 */
export function rev(pat) {
  return pat
}

// No JSDoc comment at all — jsdoc-json produces no doclet for this, and it
// is exactly the kind of export undocumented.json (task 7.1's fixture)
// would list.
export function mystery(pat) {
  return pat
}
