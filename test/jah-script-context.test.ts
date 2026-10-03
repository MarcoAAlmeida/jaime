import { describe, expect, it } from 'vitest'
import { buildScriptContext, MAX_SCRIPT_CHARS, MAX_SELECTION_CHARS } from '../server/jah/scriptContext'

describe('buildScriptContext', () => {
  it('a script within the cap is sent whole, not truncated', () => {
    const ctx = buildScriptContext('s("bd sd")', undefined)
    expect(ctx).toEqual({ script: 's("bd sd")', selection: undefined, truncated: false })
  })

  it('an empty script is not truncated', () => {
    expect(buildScriptContext('', undefined)).toEqual({ script: '', selection: undefined, truncated: false })
  })

  it('an oversized script with a findable selection keeps the selection and nearby content', () => {
    const before = 'x'.repeat(3000)
    const selection = 's("bd sd")'
    const after = 'y'.repeat(3000)
    const script = before + selection + after
    const ctx = buildScriptContext(script, selection)
    expect(ctx.truncated).toBe(true)
    expect(ctx.selection).toBe(selection)
    expect(ctx.script).toContain(selection)
    expect(ctx.script.length).toBeLessThanOrEqual(MAX_SCRIPT_CHARS)
  })

  it('an oversized script with no selection sends the head of the script', () => {
    const script = 'a'.repeat(MAX_SCRIPT_CHARS + 500)
    const ctx = buildScriptContext(script, undefined)
    expect(ctx.truncated).toBe(true)
    expect(ctx.selection).toBeUndefined()
    expect(ctx.script).toBe('a'.repeat(MAX_SCRIPT_CHARS))
  })

  it('a selection that no longer appears in the script falls back to the head of the script', () => {
    const script = 'a'.repeat(MAX_SCRIPT_CHARS + 500)
    const ctx = buildScriptContext(script, 's("this was deleted")')
    expect(ctx.truncated).toBe(true)
    // The selection is still reported (the asker did select something)...
    expect(ctx.selection).toBe('s("this was deleted")')
    // ...but the script window falls back to the head, since it can't be
    // located in the current document.
    expect(ctx.script).toBe('a'.repeat(MAX_SCRIPT_CHARS))
  })

  it('an oversized selection alone is trimmed to MAX_SELECTION_CHARS', () => {
    const hugeSelection = 's'.repeat(MAX_SELECTION_CHARS + 500)
    const ctx = buildScriptContext(hugeSelection, hugeSelection)
    expect(ctx.selection).toHaveLength(MAX_SELECTION_CHARS)
    expect(ctx.selection).toBe(hugeSelection.slice(0, MAX_SELECTION_CHARS))
  })

  it('an empty-string selection is treated as no selection', () => {
    const ctx = buildScriptContext('s("bd")', '')
    expect(ctx.selection).toBeUndefined()
  })
})
