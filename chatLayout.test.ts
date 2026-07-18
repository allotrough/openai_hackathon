import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const styles = readFileSync(new URL('./src/styles.css', import.meta.url), 'utf8')
const app = readFileSync(new URL('./src/App.tsx', import.meta.url), 'utf8')

describe('chat desk layout contract', () => {
  it('keeps the composer outside the scrollable engineering detail stack', () => {
    expect(app).toContain('<div className="desk-scroll" aria-label="Conversation and engineering details">')
    expect(app.indexOf('<form className="composer"')).toBeGreaterThan(app.indexOf('<div className="desk-scroll"'))
    expect(styles).toMatch(/\.design-desk\s*\{[^}]*min-height:\s*0;/s)
    expect(styles).toMatch(/\.desk-scroll\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s)
    expect(styles).toMatch(/\.composer\s*\{[^}]*flex:\s*0 0 auto;/s)
  })
})
