import { describe, expect, it } from 'vitest'
import { compileIntent } from './engineering'
import { buildVehicleAeroGeometry, firstAeroPathCollision, isAeroPathClear } from './aeroGeometry'
import { getRequiredComponents } from './vehicleKnowledge'
import { buildAeroFlowPlan } from './aeroFlow'

describe('component-aware aerodynamic flow plan', () => {
  it('maps every required Formula system to an aerodynamic influence and distinct wake/pressure features', () => {
    const spec = compileIntent('Design a modern ground-effect Formula 1 car with floor tunnels, diffuser, and a multi-element wing.')
    const plan = buildAeroFlowPlan(spec)
    const requiredIds = getRequiredComponents(spec).map((component) => component.id)

    expect(plan.analysisKind).toBe('component-aware-estimate')
    expect(plan.componentInfluences.map((influence) => influence.componentId)).toEqual(expect.arrayContaining(requiredIds))
    expect(plan.componentInfluences.map((influence) => influence.componentId)).toEqual(expect.arrayContaining([
      'front-wing-mainplane', 'venturi-tunnels', 'diffuser-and-strakes', 'rear-wing-and-endplates',
    ]))
    expect(plan.pressureZones.some((zone) => zone.componentId === 'front-wing-mainplane')).toBe(true)
    expect(plan.wakeZones.some((zone) => zone.componentId === 'rear-slick-tyres')).toBe(true)
    expect(plan.streamlines.length).toBeGreaterThanOrEqual(24)
  })

  it('produces materially different flow topology for road and monster-truck packages', () => {
    const road = buildAeroFlowPlan(compileIntent('Design a regular premium family sedan.'))
    const monster = buildAeroFlowPlan(compileIntent('Build a high-clearance monster truck with extreme suspension travel.'))

    expect(road.componentInfluences.map((influence) => influence.componentId)).toEqual(expect.arrayContaining([
      'greenhouse-and-pillars', 'side-mirrors', 'wheel-arches',
    ]))
    expect(monster.componentInfluences.map((influence) => influence.componentId)).toEqual(expect.arrayContaining([
      'tube-frame-safety-cage', 'solid-front-axle', 'beadlock-wheels-and-tyres', 'nitrogen-coilover-dampers',
    ]))
    expect(monster.estimate.dragIndex).toBeGreaterThan(road.estimate.dragIndex)
    expect(monster.streamlines.some((streamline) => streamline.family === 'wheel-wake')).toBe(true)
    expect(road.streamlines.some((streamline) => streamline.family === 'roofline')).toBe(true)
  })

  it('is deterministic and explicitly does not claim a CFD solve', () => {
    const spec = compileIntent('Create an original modern GT with a subtle rear wing and a rear diffuser.')
    const first = buildAeroFlowPlan(spec)
    const second = buildAeroFlowPlan(spec)

    expect(first).toEqual(second)
    expect(first.disclaimer.toLowerCase()).toContain('not a cfd solve')
    expect(first.estimate.assumedSpeedKph).toBeGreaterThan(0)
  })

  it('routes visible surface flow around the rendered body, cabin, and tyres', () => {
    const spec = compileIntent('Create a low electric fastback with a diffuser and wide tyres.')
    const geometry = buildVehicleAeroGeometry(spec)
    const plan = buildAeroFlowPlan(spec)
    const surfaceFlow = plan.streamlines.filter((streamline) => (
      streamline.family === 'roofline'
      || streamline.family === 'sidewash'
      || streamline.family === 'wheel-wake'
      || streamline.family === 'underbody'
    ))
    expect(surfaceFlow).toHaveLength(22)
    expect(surfaceFlow
      .filter((streamline) => !isAeroPathClear(geometry, streamline.points, 0.006))
      .map((streamline) => ({ id: streamline.id, collision: firstAeroPathCollision(geometry, streamline.points, 0.006) }))).toEqual([])
    expect(surfaceFlow.filter((streamline) => streamline.family === 'sidewash').map((streamline) => streamline.id)).toEqual(expect.arrayContaining([
      'sidewash-left-0', 'sidewash-right-0',
    ]))
  })

  it('binds lateral flow to shared, rendered component surfaces instead of a generic body-width lane', () => {
    const spec = compileIntent('Create a premium electric fastback with visible mirrors, wide wheel arches, cooling inlets, and a rear diffuser.')
    const geometry = buildVehicleAeroGeometry(spec)
    const plan = buildAeroFlowPlan(spec)
    const sidewash = plan.streamlines.filter((streamline) => streamline.family === 'sidewash')

    expect(geometry.surfaces.map((surface) => surface.componentId)).toEqual(expect.arrayContaining([
      'exterior-body-shell', 'greenhouse-and-pillars', 'side-mirrors', 'wheel-arches', 'thermal-inlets-and-exits', 'underbody-diffuser',
    ]))
    expect(sidewash).toHaveLength(8)
    expect(sidewash.flatMap((streamline) => streamline.componentIds)).toEqual(expect.arrayContaining([
      'side-mirrors', 'wheel-arches',
    ]))
    expect(sidewash.every((streamline) => isAeroPathClear(geometry, streamline.points, 0.006))).toBe(true)

    const nearBodySidePoints = sidewash.flatMap((streamline) => streamline.points)
      .filter(([x]) => x < geometry.bodyFrontX - 0.15 && x > geometry.bodyRearX + 0.15)
    expect(nearBodySidePoints.some((point) => {
      const hit = geometry.nearestSurface(point)
      return hit.surface.componentId !== 'exterior-body-shell' && hit.distance < 0.16
    })).toBe(true)
  })

  it('exposes Formula wings, sidepods, and floor as airflow surfaces with non-generic local routes', () => {
    const spec = compileIntent('Design a modern ground-effect Formula 1 car with floor tunnels, sidepods, a multi-element front wing, and rear wing.')
    const geometry = buildVehicleAeroGeometry(spec)
    const plan = buildAeroFlowPlan(spec)

    expect(geometry.surfaces.map((surface) => surface.componentId)).toEqual(expect.arrayContaining([
      'front-wing-mainplane', 'front-wing-endplates', 'sidepod-inlets', 'venturi-tunnels', 'diffuser-and-strakes', 'rear-wing-and-endplates',
    ]))
    expect(plan.streamlines.filter((streamline) => streamline.family === 'aero-surface').some((streamline) => (
      streamline.componentIds.includes('front-wing-mainplane')
    ))).toBe(true)
    expect(plan.streamlines.filter((streamline) => streamline.family === 'sidewash').some((streamline) => (
      streamline.componentIds.includes('sidepod-inlets')
    ))).toBe(true)
  })

  it('uses colliders that match rendered GT wings and class-specific Formula/monster bodywork', () => {
    const gtSpec = {
      ...compileIntent('Design a track-focused GT with a substantial front splitter, rear wing, and diffuser.'),
      vehicleClass: 'gt' as const,
      frontWing: 0.62,
      rearWing: 0.72,
    }
    const gt = buildVehicleAeroGeometry(gtSpec)
    const formula = buildVehicleAeroGeometry(compileIntent('Design a modern Formula 1 car with floor tunnels and rear wing.'))
    const monster = buildVehicleAeroGeometry(compileIntent('Build a high-clearance monster truck with a tube-frame cab and exposed engine.'))

    expect(gt.surfaces.map((surface) => surface.componentId)).toEqual(expect.arrayContaining([
      'front-aero-wing', 'rear-aero-wing',
    ]))
    expect(formula.surfaces.some((surface) => surface.collider.shape === 'profile-prism')).toBe(false)
    expect(formula.surfaces.map((surface) => surface.componentId)).toEqual(expect.arrayContaining([
      'formula-nose-and-crash-structure', 'formula-central-chassis', 'formula-engine-cover',
    ]))
    expect(monster.surfaces.some((surface) => surface.collider.shape === 'profile-prism')).toBe(false)
    expect(monster.surfaces.map((surface) => surface.componentId)).toEqual(expect.arrayContaining([
      'tube-frame-safety-cage', 'engine-and-cooling-module', 'cargo-bed',
    ]))
  })

  it('grounds component cues on matching registry surfaces when one is available', () => {
    const spec = compileIntent('Design a modern Formula 1 car with a multi-element front wing and ground-effect floor.')
    const geometry = buildVehicleAeroGeometry(spec)
    const plan = buildAeroFlowPlan(spec)
    const frontWing = geometry.surfaces.find((surface) => surface.componentId === 'front-wing-mainplane')!
    const influence = plan.componentInfluences.find((entry) => entry.componentId === 'front-wing-mainplane')!

    expect(influence.anchor).toEqual(frontWing.anchor)
    expect(influence.span).toBeGreaterThanOrEqual(frontWing.interactionRadius * 2)
  })
})
