import { describe, expect, it } from 'vitest'
import { accentVars, textOn } from './look'

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
