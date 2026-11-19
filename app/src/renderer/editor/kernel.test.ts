import { describe, it, expect } from 'vitest'
import { parseInline, parseBlocks } from './kernel'

describe('latex line', () => {
  it('parses the exact line', () => {
    const BS = String.fromCharCode(92)
    const line = 'LaTeX ' + BS + '(a^2+b^2=c^2' + BS + ') y ' + BS + '[' + BS + 'sum_{i=1}^{n} i' + BS + ']'
    const toks = parseInline(line, 0, { latexDelimiters: true, emoji: true, autolink: true, html: true })
    console.log('EXACT_TOKS', JSON.stringify(toks.map(t => ({ t: t.type, from: t.from, to: t.to, text: t.text }))))
    expect(toks.length).toBe(2)
  })
})
