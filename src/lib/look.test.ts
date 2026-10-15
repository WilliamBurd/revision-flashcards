import { describe, expect, it } from 'vitest'
import { accentVars, subjectPaint, textOn } from './look'

describe('accent colour', () => {
  it('picks readable text on the accent', () => {
    expect(textOn('#f5b544')).toBe('#0b0b0f')
    expect(textOn('#ffffff')).toBe('#0b0b0f')
    expect(textOn('#2f5bea')).toBe('#ffffff')
    expect(textOn('#000000')).toBe('#ffffff')
  })

  it('sets every accent variable', () => {
    const vars = accentVars('#e5484d')
    expect(Object.keys(vars).sort()).toEqual(['--accent', '--accent-soft', '--accent-strong', '--on-accent', '--on-accent-soft'])
    expect(vars['--accent']).toBe('#e5484d')
  })
})

describe('subjectPaint', () => {
  it('uses the picked colour, with readable text on it', () => {
    expect(subjectPaint('#f5b544', 0)).toMatchObject({ dot: '#f5b544', badge: '#f5b544', badgeInk: '#0b0b0f' })
    expect(subjectPaint('#2f5bea', 0).badgeInk).toBe('#ffffff')
  })
  it("falls back to the theme's colour for the subject's place", () => {
    expect(subjectPaint(undefined, 5).badge).toBe('var(--subject-2-badge)')
    expect(subjectPaint('not a colour', 0).dot).toBe('var(--subject-1)')
  })
})
