import { describe, expect, it } from 'vitest'
import { createInitialSpec } from './engineering'
import { runDesignTurn } from './designTurn'
import { getGeometryProfile } from './vehicleGeometry'

describe('design turns', () => {
  it('commits a visibly different recipe for a new vehicle request', () => {
    const current = createInitialSpec()
    const before = getGeometryProfile(current)
    const result = runDesignTurn('Create a Formula 1 open-wheel circuit car with exposed wheels and a ground-effect floor.', current)
    const after = getGeometryProfile(result.spec)

    expect(result.spec.vehicleClass).toBe('formula')
    expect(after.recipe).toBe('open-wheel')
    expect(after.recipe).not.toBe(before.recipe)
    expect(result.logs.length).toBeGreaterThan(0)
  })

  it('does not silently retain the prior EV silhouette for a new regular-car request', () => {
    const current = createInitialSpec()
    const before = getGeometryProfile(current)
    const result = runDesignTurn('Design a regular family sedan with a calm premium interior.', current)
    const after = getGeometryProfile(result.spec)

    expect(result.spec.vehicleClass).toBe('road')
    expect(result.spec.name).toBe('Aether Meridian')
    expect(after.recipe).not.toBe(before.recipe)
    expect(after.recipe).toBe('road-sedan')
  })

  it('uses a passenger-car baseline unless performance intent is explicit', () => {
    const current = createInitialSpec()
    const regular = runDesignTurn('Design a beautiful everyday car with room for five adults.', current)
    const performance = runDesignTurn('Design a beautiful mid-engine supercar for track days.', current)

    expect(regular.spec.engineLayout).toBe('front-transverse')
    expect(getGeometryProfile(regular.spec).recipe).toBe('road-sedan')
    expect(performance.spec.engineLayout).toBe('mid-engine')
    expect(getGeometryProfile(performance.spec).recipe).toBe('mid-engine-road')
  })
})
