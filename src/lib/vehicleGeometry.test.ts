import { describe, expect, it } from 'vitest'
import { compileIntent } from './engineering'
import { getGeometryProfile } from './vehicleGeometry'

describe('vehicle geometry profiles', () => {
  it('gives fundamentally different vehicle classes distinct silhouette recipes', () => {
    const profiles = [
      getGeometryProfile(compileIntent('an elegant electric fastback supercar')),
      getGeometryProfile(compileIntent('a Formula 1 open wheel circuit car')),
      getGeometryProfile(compileIntent('a long hood GT grand tourer')),
      getGeometryProfile(compileIntent('a high clearance desert monster truck')),
      getGeometryProfile(compileIntent('a practical off road pickup truck')),
    ]
    expect(new Set(profiles.map((profile) => profile.recipe)).size).toBe(5)
    expect(profiles[1].hasOpenWheels).toBe(true)
    expect(profiles[3].hasTubeFrame).toBe(true)
    expect(profiles[4].hasCargoBed).toBe(true)
  })
})
