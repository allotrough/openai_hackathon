import { describe, expect, it } from 'vitest'
import { createInitialSpec } from './engineering'
import { buildAlignmentBrief, buildComponentBrief, buildStudioRenderPrompt } from './studioRender'

describe('studio render prompt', () => {
  it('turns the active schema into a full-size photorealistic render request', () => {
    const spec = createInitialSpec()
    const prompt = buildStudioRenderPrompt(spec)

    expect(prompt).toContain(spec.name)
    expect(prompt).toContain(`${Math.round(spec.wheelbase * 1000)} mm`)
    expect(prompt).toContain('not a toy')
    expect(prompt).toContain('No text')
    expect(prompt).toContain('GEOMETRY LOCK')
    expect(prompt).toContain('attached engineering reference sheet')
  })

  it('creates a concrete alignment brief from the procedural schema', () => {
    const spec = createInitialSpec()
    const brief = buildAlignmentBrief(spec)

    expect(brief).toContain(`${Math.round(spec.overallLength * 1000)} mm overall length`)
    expect(brief).toContain(`${Math.round(spec.frontTrack * 1000)} mm front track`)
    expect(brief).toContain('fastback')
    expect(brief).toContain('Electric performance vehicle')
  })

  it('carries class-specific required systems into the image prompt', () => {
    const spec = createInitialSpec()
    const componentBrief = buildComponentBrief(spec)

    expect(componentBrief).toContain('Class knowledge pack: Electric performance vehicle')
    expect(componentBrief).toContain('Structural battery pack')
    expect(componentBrief).toContain('Required separately readable systems')
  })
})
