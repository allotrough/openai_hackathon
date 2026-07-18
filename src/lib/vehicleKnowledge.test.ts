import { describe, expect, it } from 'vitest'
import { compileIntent } from './engineering'
import {
  assessReferenceComponentAdaptation,
  getDesignAssumptions,
  getFidelityPolicy,
  getRequiredComponents,
  getVehicleKnowledgePack,
} from './vehicleKnowledge'

describe('vehicle knowledge packs', () => {
  it('selects detailed golden packs for road, Formula, and monster-truck schemas', () => {
    const road = getVehicleKnowledgePack('road')
    const formula = getVehicleKnowledgePack('formula')
    const monster = getVehicleKnowledgePack('monster')

    expect(road.id).toBe('road-production-v1')
    expect(road.components.map((component) => component.id)).toEqual(expect.arrayContaining([
      'greenhouse-and-pillars', 'road-lighting-signature', 'wheel-arches', 'side-mirrors',
    ]))
    expect(formula.components.map((component) => component.id)).toEqual(expect.arrayContaining([
      'halo', 'front-wing-flaps', 'venturi-tunnels', 'diffuser-and-strakes', 'rear-rain-light',
    ]))
    expect(monster.components.map((component) => component.id)).toEqual(expect.arrayContaining([
      'tube-frame-safety-cage', 'four-link-suspension', 'nitrogen-coilover-dampers', 'beadlock-wheels-and-tyres',
    ]))
    expect(getFidelityPolicy('formula').minimumOverallScore).toBeGreaterThan(getFidelityPolicy('road').minimumOverallScore)
  })

  it('returns class-specific required component graphs instead of one generic car blob', () => {
    const road = compileIntent('Design a practical regular family sedan with road legal lighting.')
    const formula = compileIntent('Design a 2025 ground-effect Formula 1 car with a halo and diffuser.')
    const monster = compileIntent('Build a high-clearance monster truck with extreme suspension travel.')

    expect(getRequiredComponents(road).map((component) => component.id)).toEqual(expect.arrayContaining([
      'unibody-safety-cell', 'greenhouse-and-pillars', 'road-lighting-signature', 'occupant-cabin',
    ]))
    expect(getRequiredComponents(formula).map((component) => component.id)).toEqual(expect.arrayContaining([
      'open-cockpit', 'halo', 'front-wing-mainplane', 'venturi-tunnels', 'rear-wing-and-endplates',
    ]))
    expect(getRequiredComponents(monster).map((component) => component.id)).toEqual(expect.arrayContaining([
      'tube-frame-safety-cage', 'solid-front-axle', 'four-link-suspension', 'front-engine-and-driveline',
    ]))
  })

  it('exposes assumptions and guards incompatible named-reference transfers', () => {
    const monster = compileIntent('Build a front-engine monster truck with a tube frame.')
    const assumptions = getDesignAssumptions(monster)
    const frunkDecision = assessReferenceComponentAdaptation(monster, {
      componentId: 'front-storage',
      category: 'cargo',
      sourceVehicleClass: 'gt',
      sourceLabel: 'a 911-style front luggage volume',
    })
    const mirrorDecision = assessReferenceComponentAdaptation(monster, {
      componentId: 'side-mirrors',
      category: 'visibility',
      sourceVehicleClass: 'road',
      sourceLabel: 'a production-car side mirror',
    })

    expect(assumptions.join(' ')).toContain('tube frame')
    expect(frunkDecision.status).toBe('blocked')
    expect(frunkDecision.requiredChanges.join(' ')).toContain('EV architecture')
    expect(mirrorDecision.status).toBe('adaptable')
    expect(mirrorDecision.requiredChanges.join(' ')).toContain('scale and remount')
  })
})
