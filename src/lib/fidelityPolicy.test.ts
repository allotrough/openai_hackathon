import { describe, expect, it } from 'vitest'
import type { VehicleClass } from '../types'
import { compileIntent } from './engineering'
import { buildVisualCriticBrief, getVisualFidelityPolicy, VISUAL_FIDELITY_POLICIES } from './fidelityPolicy'

describe('class-aware visual fidelity policies', () => {
  it('covers every current vehicle class with a usable policy', () => {
    const classes: VehicleClass[] = ['road', 'formula', 'gt', 'rally', 'suv', 'truck', 'monster', 'ev']

    expect(Object.keys(VISUAL_FIDELITY_POLICIES).sort()).toEqual([...classes].sort())
    for (const vehicleClass of classes) {
      const policy = getVisualFidelityPolicy(vehicleClass)
      expect(policy.requiredVisibleSystems.length).toBeGreaterThanOrEqual(4)
      expect(policy.thresholds.minimumReferenceViews).toBeGreaterThanOrEqual(4)
      expect(policy.referenceGuidance.sourcePriority.length).toBeGreaterThan(0)
    }
  })

  it('keeps road, Formula, and monster-truck criteria meaningfully distinct', () => {
    const road = getVisualFidelityPolicy('road')
    const formula = getVisualFidelityPolicy('formula')
    const monster = getVisualFidelityPolicy('monster')

    expect(road.requiredVisibleSystems.map((item) => item.id)).toEqual(expect.arrayContaining(['greenhouse', 'lighting', 'closures']))
    expect(formula.requiredVisibleSystems.map((item) => item.id)).toEqual(expect.arrayContaining(['open-wheel-layout', 'cockpit-safety-cell', 'ground-effect-floor']))
    expect(monster.requiredVisibleSystems.map((item) => item.id)).toEqual(expect.arrayContaining(['tube-frame', 'axles-and-suspension', 'tyres-and-wheel-package']))
    expect(formula.thresholds.minimumReferenceViews).toBeGreaterThan(road.thresholds.minimumReferenceViews)
    expect(monster.thresholds.maxMissingRequiredSystems).toBeLessThan(road.thresholds.maxMissingRequiredSystems)
  })

  it('builds a compact class-aware critic brief from the active schema', () => {
    const spec = compileIntent('Design an original modern Formula 1 car with a halo and ground effect floor.')
    const brief = buildVisualCriticBrief(spec)

    expect(brief).toContain('ground-effect Formula-style single-seater')
    expect(brief).toContain(`${Math.round(spec.wheelbase * 1000)} mm wheelbase`)
    expect(brief).toContain('open cockpit, halo, monocoque')
    expect(brief).toContain('Pass only at 84/100 or above')
    expect(brief.length).toBeLessThan(2200)
  })

  it('uses vehicle-specific fallback guidance outside the three primary packs', () => {
    const truck = getVisualFidelityPolicy('truck')
    const ev = getVisualFidelityPolicy('ev')

    expect(truck.requiredVisibleSystems.map((item) => item.id)).toContain('cab-and-bed')
    expect(ev.requiredVisibleSystems.map((item) => item.id)).toContain('battery-package')
    expect(ev.referenceGuidance.doNotUseReferencesFor.join(' ')).toContain('logos')
  })
})
