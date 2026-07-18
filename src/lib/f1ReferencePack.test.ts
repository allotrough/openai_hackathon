import { describe, expect, it } from 'vitest'
import { compileIntent } from './engineering'
import { F1_2022_25_REFERENCE_PACK, evaluateF1RatioConstraints, retrieveF1ReferencePack } from './f1ReferencePack'

describe('2022–25 Formula-style reference pack', () => {
  it('retrieves the original ground-effect pack with mandatory exterior systems', () => {
    const spec = compileIntent('Design a modern F1 open-wheel race car with halo, floor tunnels, diffuser, and rear rain light.')
    const retrieval = retrieveF1ReferencePack('Design a modern F1 open-wheel race car with halo, floor tunnels, diffuser, and rear rain light.', spec)

    expect(retrieval?.relevance).toBe('primary')
    expect(retrieval?.pack.id).toBe('original-f1-2022-25-ground-effect')
    expect(retrieval?.pack.mandatoryComponents.map((component) => component.id)).toEqual(expect.arrayContaining([
      'front-wing-flaps', 'halo', 'sidepod-undercuts', 'ground-effect-tunnels', 'diffuser', 'rear-rain-light',
    ]))
    expect(retrieval?.focusedComponents.map((component) => component.id)).toEqual(expect.arrayContaining([
      'halo', 'ground-effect-tunnels', 'diffuser', 'rear-rain-light',
    ]))
    expect(retrieval?.rendererBrief).toContain('Original, unbranded')
  })

  it('reports formula proportions and keeps retrieval deterministic', () => {
    const spec = compileIntent('Formula 1 single seater')
    const first = retrieveF1ReferencePack('Formula 1 single seater with a multi-element front wing', spec)
    const second = retrieveF1ReferencePack('Formula 1 single seater with a multi-element front wing', spec)
    const wheelbase = evaluateF1RatioConstraints(spec).find((constraint) => constraint.id === 'wheelbase-length')

    expect(wheelbase).toMatchObject({ value: 0.683, status: 'within-range' })
    expect(first).toEqual(second)
    expect(F1_2022_25_REFERENCE_PACK.referenceViews).toHaveLength(6)
  })

  it('does not retrieve the F1 pack for an unrelated road-car schema', () => {
    const spec = compileIntent('Design a premium electric roadster')
    expect(retrieveF1ReferencePack('Design a premium electric roadster', spec)).toBeNull()
  })
})
