import type { VehicleSpec } from '../types'
import {
  buildVehicleAeroGeometry,
  type AeroPoint,
  type VehicleAeroGeometry,
} from './aeroGeometry'
import { getGeometryProfile } from './vehicleGeometry'
import { getRequiredComponents, type VehicleComponentDefinition } from './vehicleKnowledge'

/**
 * This module is deliberately deterministic and schema-driven. It is a
 * component-aware aerodynamic estimate for a real-time viewport, not a CFD
 * solver: it makes every required vehicle system visible in the flow plan and
 * provides a clean hand-off point for a future meshed CFD service.
 */

export type { AeroPoint } from './aeroGeometry'

export type AeroFlowFamily =
  | 'freestream'
  | 'roofline'
  | 'sidewash'
  | 'wheel-wake'
  | 'underbody'
  | 'aero-surface'
  | 'cooling'
  | 'structural-wake'

export type AeroInfluenceRole =
  | 'aero-surface'
  | 'body-surface'
  | 'wheel-wake'
  | 'underbody'
  | 'cooling'
  | 'obstruction'

export type AeroComponentInfluence = {
  componentId: string
  label: string
  category: VehicleComponentDefinition['category']
  role: AeroInfluenceRole
  anchor: AeroPoint
  span: number
  deflection: number
  dragWeight: number
  downforceWeight: number
}

export type AeroPressureZone = {
  id: string
  componentId: string
  kind: 'stagnation' | 'low-pressure' | 'separation'
  anchor: AeroPoint
  radius: number
  strength: number
}

export type AeroWakeZone = {
  id: string
  componentId: string
  anchor: AeroPoint
  length: number
  radius: number
  severity: number
}

export type AeroStreamline = {
  id: string
  family: AeroFlowFamily
  componentIds: readonly string[]
  points: readonly AeroPoint[]
  speedMultiplier: number
  opacity: number
}

export type AeroEstimate = {
  assumedSpeedKph: number
  dragIndex: number
  downforceIndex: number
  frontLoadBias: number
  confidence: 'concept-level'
}

export type AeroFlowPlan = {
  analysisKind: 'component-aware-estimate'
  disclaimer: string
  componentInfluences: readonly AeroComponentInfluence[]
  pressureZones: readonly AeroPressureZone[]
  wakeZones: readonly AeroWakeZone[]
  streamlines: readonly AeroStreamline[]
  estimate: AeroEstimate
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const rounded = (value: number, precision = 3) => Number(value.toFixed(precision))

function stableNumber(text: string) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function assumedSpeedKph(vehicleClass: VehicleSpec['vehicleClass']) {
  switch (vehicleClass) {
    case 'formula': return 250
    case 'gt': return 220
    case 'rally': return 135
    case 'monster': return 60
    case 'truck': return 100
    case 'suv': return 110
    case 'ev': return 130
    default: return 120
  }
}

function hasText(component: VehicleComponentDefinition, expression: RegExp) {
  return expression.test(component.id)
}

function roleFor(component: VehicleComponentDefinition): AeroInfluenceRole {
  if (component.category === 'aero') return 'aero-surface'
  if (component.category === 'underbody') return 'underbody'
  if (component.category === 'corner') return 'wheel-wake'
  if (component.category === 'thermal') return 'cooling'
  if (component.category === 'body' || component.category === 'greenhouse' || component.category === 'cabin') return 'body-surface'
  return 'obstruction'
}

function registeredSurfaceSummary(geometry: VehicleAeroGeometry, componentId: string) {
  const aliases: Record<string, readonly string[]> = {
    'front-spoiler': ['front-aero-wing'],
    'rear-spoiler': ['rear-aero-wing'],
    'rear-stabilising-wing': ['rear-aero-wing'],
    'high-speed-underbody': ['underbody-diffuser'],
    'high-visibility-cab': ['tube-frame-safety-cage'],
  }
  const candidateIds = new Set([componentId, ...(aliases[componentId] ?? [])])
  const matches = geometry.surfaces.filter((surface) => candidateIds.has(surface.componentId))
  if (!matches.length) return null
  const average = (axis: 0 | 1 | 2) => matches.reduce((sum, surface) => sum + surface.anchor[axis], 0) / matches.length
  return {
    anchor: [rounded(average(0)), rounded(average(1)), rounded(average(2))] as AeroPoint,
    span: Math.max(...matches.map((surface) => surface.interactionRadius * 2)),
  }
}

function anchorFor(spec: VehicleSpec, component: VehicleComponentDefinition, geometry: VehicleAeroGeometry): AeroPoint {
  const registered = registeredSurfaceSummary(geometry, component.id)
  if (registered) return registered.anchor
  const profile = getGeometryProfile(spec)
  const frontX = spec.wheelbase / 2
  const rearX = -spec.wheelbase / 2
  const side = stableNumber(component.id) % 2 === 0 ? 1 : -1
  const frontTrack = spec.frontTrack / 2
  const rearTrack = spec.rearTrack / 2
  const centreY = profile.bodyY + profile.bodyHeight * 0.08
  const roofY = profile.bodyY + profile.cabin.y + profile.cabin.height * 0.42
  const lowerY = Math.max(spec.rideHeight * 0.55, 0.035)

  if (hasText(component, /front-wing|front-crash|front-spoiler|front-fascia|headlamp|front-storage|front-engine|front-and-rear-crush/)) {
    return [rounded(frontX + Math.max(0.12, spec.wheelRadius * 0.45)), rounded(centreY), 0]
  }
  if (hasText(component, /rear-wing|rear-spoiler|rear-luggage|tail-lamp|rear-transaxle|rear-suspension|rear-brake|rear-rain|rear-axle|tailgate|cargo-bed/)) {
    return [rounded(rearX - Math.max(0.12, spec.wheelRadius * 0.45)), rounded(centreY + profile.bodyHeight * 0.26), 0]
  }
  if (hasText(component, /floor|diffuser|venturi|underbody|battery|driveline|exhaust|approach|departure/)) {
    return [rounded(-spec.wheelbase * 0.12), rounded(lowerY), 0]
  }
  if (hasText(component, /wheel|tyre|tire|arch|upright|brake|axle|four-link|dampers|suspension|steering/)) {
    const rear = hasText(component, /rear|four-link|dampers|rear-axle/)
    return [rounded(rear ? rearX : frontX), rounded(spec.wheelRadius), rounded(side * (rear ? rearTrack : frontTrack))]
  }
  if (hasText(component, /mirror|sidepod|side-intake|cooling|radiator/)) {
    return [rounded(component.category === 'thermal' ? -0.2 : profile.cabin.x + profile.cabin.length * 0.2), rounded(centreY + profile.bodyHeight * 0.23), rounded(side * (profile.bodyWidth / 2 + 0.06))]
  }
  if (hasText(component, /greenhouse|roof|cockpit|halo|airbox|safety-cell|cab|occupant|driver/)) {
    return [rounded(profile.cabin.x), rounded(roofY), 0]
  }
  return [0, rounded(centreY), 0]
}

function componentInfluence(
  spec: VehicleSpec,
  component: VehicleComponentDefinition,
  geometry: VehicleAeroGeometry,
): AeroComponentInfluence {
  const role = roleFor(component)
  const registered = registeredSurfaceSummary(geometry, component.id)
  const aeroAuthority = spec.frontWing + spec.rearWing + spec.diffuserDepth * 1.8
  const baseSpan = Math.max(spec.overallWidth * 0.18, spec.wheelRadius * 0.9)
  const roleWeights: Record<AeroInfluenceRole, { deflection: number; drag: number; downforce: number; span: number }> = {
    'aero-surface': { deflection: 0.25 + aeroAuthority * 0.12, drag: 0.08, downforce: 0.34 + aeroAuthority * 0.34, span: 1.15 },
    underbody: { deflection: 0.22 + spec.diffuserDepth * 0.75, drag: 0.04, downforce: 0.36 + spec.diffuserDepth * 0.9, span: 1.05 },
    'wheel-wake': { deflection: 0.16 + spec.tireWidth * 0.34, drag: 0.27 + spec.tireWidth * 0.18, downforce: 0, span: 0.8 },
    cooling: { deflection: 0.08 + spec.coolingIntake * 0.2, drag: 0.1 + spec.coolingIntake * 0.16, downforce: 0.01, span: 0.56 },
    'body-surface': { deflection: 0.1 + profileHeightFactor(spec) * 0.08, drag: 0.06, downforce: 0.015, span: 1 },
    obstruction: { deflection: 0.09, drag: 0.09, downforce: 0, span: 0.48 },
  }
  const weights = roleWeights[role]
  return {
    componentId: component.id,
    label: component.label,
    category: component.category,
    role,
    anchor: anchorFor(spec, component, geometry),
    span: rounded(registered?.span ?? baseSpan * weights.span),
    deflection: rounded(weights.deflection),
    dragWeight: rounded(weights.drag),
    downforceWeight: rounded(weights.downforce),
  }
}

function profileHeightFactor(spec: VehicleSpec) {
  return clamp(spec.overallHeight / Math.max(spec.overallWidth, 0.5), 0.25, 1.4)
}

function streamline(
  id: string,
  family: AeroFlowFamily,
  componentIds: readonly string[],
  points: readonly AeroPoint[],
  speedMultiplier: number,
  opacity: number,
): AeroStreamline {
  return { id, family, componentIds, points, speedMultiplier: rounded(speedMultiplier), opacity: rounded(opacity, 2) }
}

type SurfaceRoute = 'roof' | 'side' | 'underbody'

// Kept small enough to look attached at vehicle scale, but large enough to
// survive rounding and avoid z-fighting against the procedural surface.
const surfaceClearance = 0.08

function roundedPoint([x, y, z]: AeroPoint): AeroPoint {
  return [rounded(x), rounded(y), rounded(z)]
}

function clearPoint(
  geometry: VehicleAeroGeometry,
  point: AeroPoint,
  route: SurfaceRoute,
  preferredSide: number,
): AeroPoint {
  const side = preferredSide || Math.sign(point[2]) || 1
  const preference: AeroPoint = route === 'roof'
    ? [0, 1, 0]
    : route === 'underbody' ? [0, -1, 0] : [0, 0, side]
  let cleared = point

  // The route is deliberately projected against the same primitive registry
  // used for visible procedural components. That gives mirrors, wheel arches,
  // wings, sidepods and the floor authority over the overlay instead of only
  // testing against the old body envelope.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const hit = geometry.nearestSurface(cleared)
    if (hit.distance >= surfaceClearance - 0.002) return roundedPoint(cleared)

    const [x, y, z] = cleared
    if (route === 'side') {
      const boundary = geometry.sideBoundaryAt(x, y, side)
      if (boundary) {
        cleared = [x, y, boundary.point[2] + side * surfaceClearance]
        continue
      }
    }
    if (route === 'roof') {
      const boundary = geometry.topBoundaryAt(x, z)
      if (boundary) {
        cleared = [x, boundary.point[1] + surfaceClearance, z]
        continue
      }
    }
    if (route === 'underbody') {
      const boundary = geometry.bottomBoundaryAt(x, z)
      if (boundary) {
        cleared = [x, boundary.point[1] - surfaceClearance, z]
        continue
      }
    }
    cleared = geometry.projectOutside(cleared, surfaceClearance, preference)
  }

  return roundedPoint(geometry.projectOutside(cleared, surfaceClearance + 0.012, preference))
}

/** Adds enough path resolution that the rendered line cannot chord through an obstacle between authored control points. */
function clearPath(
  geometry: VehicleAeroGeometry,
  controlPoints: readonly AeroPoint[],
  route: SurfaceRoute,
  preferredSide = 1,
): AeroPoint[] {
  const points: AeroPoint[] = []
  for (let index = 0; index < controlPoints.length - 1; index += 1) {
    const from = controlPoints[index]
    const to = controlPoints[index + 1]
    const samples = Math.max(8, Math.ceil(Math.hypot(
      to[0] - from[0],
      to[1] - from[1],
      to[2] - from[2],
    ) / 0.09))
    for (let sample = 0; sample <= samples; sample += 1) {
      if (index > 0 && sample === 0) continue
      const progress = sample / samples
      points.push(clearPoint(geometry, [
        from[0] + (to[0] - from[0]) * progress,
        from[1] + (to[1] - from[1]) * progress,
        from[2] + (to[2] - from[2]) * progress,
      ], route, preferredSide))
    }
  }
  return points
}

function appendSurfacePoint(
  geometry: VehicleAeroGeometry,
  points: AeroPoint[],
  point: AeroPoint,
  route: SurfaceRoute,
  preferredSide: number,
) {
  const previous = points.at(-1)
  if (!previous) {
    points.push(point)
    return
  }

  if (route === 'roof') {
    const deltaY = point[1] - previous[1]
    if (deltaY > 0.11) {
      // Rise in front of a windscreen/greenhouse before travelling over it.
      points.push(clearPoint(geometry, [previous[0], point[1] + 0.012, previous[2]], route, preferredSide))
    } else if (deltaY < -0.11) {
      // Descend only after clearing the rear edge of the greenhouse or wing.
      points.push(clearPoint(geometry, [point[0], previous[1] + 0.012, point[2]], route, preferredSide))
    }
  }

  if (route === 'side') {
    const previousExtent = Math.abs(previous[2])
    const nextExtent = Math.abs(point[2])
    if (Math.abs(nextExtent - previousExtent) > 0.075) {
      const growingOutboard = nextExtent > previousExtent
      const guard: AeroPoint = growingOutboard
        ? [previous[0], previous[1], preferredSide * (nextExtent + 0.016)]
        : [point[0], point[1], preferredSide * (previousExtent + 0.016)]
      points.push(clearPoint(geometry, guard, route, preferredSide))
    }
  }

  points.push(point)
}

function surfaceComponentIds(
  geometry: VehicleAeroGeometry,
  points: readonly AeroPoint[],
  initial: readonly string[],
) {
  const ids = new Set(initial)
  for (let index = 0; index < points.length; index += 3) {
    const hit = geometry.nearestSurface(points[index])
    if (hit.distance < 0.16) ids.add(hit.surface.componentId)
  }
  return [...ids]
}

function buildRooflineStreamlines(spec: VehicleSpec, geometry: VehicleAeroGeometry): AeroStreamline[] {
  const { profile } = geometry
  const frontTop = geometry.topBoundaryAt(geometry.bodyFrontX * 0.98, 0)?.point[1]
    ?? profile.bodyY + profile.bodyHeight * 0.25
  const roofHalfWidth = Math.min(profile.bodyWidth, profile.cabin.width) * 0.43
  const startX = geometry.bodyFrontX + 0.46
  const endX = geometry.bodyRearX - 0.88
  const samples = Math.max(42, Math.ceil(spec.overallLength / 0.075))
  return [-0.92, -0.48, 0, 0.48, 0.92].map((ratio, index) => {
    const z = ratio * roofHalfWidth
    let previousY = frontTop + surfaceClearance + 0.16
    const points: AeroPoint[] = []
    for (let sample = 0; sample <= samples; sample += 1) {
      const progress = sample / samples
      const x = startX + (endX - startX) * progress
      const boundary = geometry.topBoundaryAt(x, z)
      const target = boundary ? boundary.point[1] + surfaceClearance : previousY - 0.014
      // Let the stream settle down only gradually, but never let it cut back
      // into a roof, windscreen, greenhouse, wing, or cargo-bed surface.
      const y = boundary ? Math.max(target, previousY - 0.032) : target
      const point = clearPoint(geometry, [x, y, z], 'roof', Math.sign(z) || 1)
      appendSurfacePoint(geometry, points, point, 'roof', Math.sign(z) || 1)
      previousY = point[1]
    }
    return streamline(
      `roofline-${index}`,
      'roofline',
      surfaceComponentIds(geometry, points, ['exterior-body-shell', 'greenhouse-and-pillars']),
      points,
      1.02 + index * 0.018,
      0.68,
    )
  })
}

function sideHeight(geometry: VehicleAeroGeometry, x: number, lane: number) {
  const section = geometry.bodySectionAt(x)
  if (!section) return geometry.profile.bodyY
  return section.bottom + (section.top - section.bottom) * lane
}

function buildSidewashStreamlines(geometry: VehicleAeroGeometry): AeroStreamline[] {
  const { profile } = geometry
  const front = geometry.bodyFrontX
  const rear = geometry.bodyRearX
  const lateralComponentId = geometry.surfaces.some((surface) => surface.componentId === 'sidepod-inlets') ? 'sidepod-inlets' : 'side-mirrors'
  return [-1, 1].flatMap((side) => [0.3, 0.48, 0.65, 0.78].map((lane, laneIndex) => {
    const lateralSurface = geometry.surfaces.find((surface) => (
      surface.componentId === lateralComponentId && Math.sign(surface.anchor[2]) === side
    ))
    const frontWheel = geometry.wheels.find((wheel) => (
      wheel.centre[0] > 0 && Math.sign(wheel.centre[2]) === side
    ))!
    const startX = front + 0.58
    const endX = rear - 0.94
    const samples = Math.max(48, Math.ceil((startX - endX) / 0.075))
    const componentWindow = Math.max(lateralSurface?.interactionRadius ?? 0.22, 0.26) * 1.7
    let previousY = sideHeight(geometry, front * 0.96, lane)
    let previousZ = side * (Math.abs(frontWheel.centre[2]) + frontWheel.halfWidth + surfaceClearance)
    const points: AeroPoint[] = []

    for (let sample = 0; sample <= samples; sample += 1) {
      const progress = sample / samples
      const x = startX + (endX - startX) * progress
      const section = geometry.bodySectionAt(x)
      const baseY = section ? sideHeight(geometry, x, lane) : previousY - 0.008
      const componentBlend = lateralSurface
        ? clamp(1 - Math.abs(x - lateralSurface.anchor[0]) / componentWindow, 0, 1)
        : 0
      // The third lane is intentionally captured by the mirror/sidepod
      // surface. The other lanes remain attached to their own body-height
      // stations, so the flow sheet has visible vertical structure.
      const componentAuthority = laneIndex === 2 ? componentBlend : componentBlend * 0.28
      const y = baseY + ((lateralSurface?.anchor[1] ?? baseY) - baseY) * componentAuthority
      const boundary = geometry.sideBoundaryAt(x, y, side)
      // Look ahead into the oncoming wheel envelope. Without this anticipation
      // a straight line would jump from the body flank to an arch and slice
      // through it between samples. The envelope makes the line bend around
      // both front and rear tyres before it reaches them.
      const lookAhead = geometry.sideBoundaryAt(Math.max(endX, x - 0.32), y, side)
      const boundaryExtent = Math.max(
        Math.abs(boundary?.point[2] ?? 0),
        Math.abs(lookAhead?.point[2] ?? 0),
      ) + surfaceClearance
      const targetExtent = Math.max(boundaryExtent, Math.abs(previousZ) - 0.024)
      const targetZ = side * targetExtent
      const point = clearPoint(geometry, [x, y, targetZ], 'side', side)
      appendSurfacePoint(geometry, points, point, 'side', side)
      previousY = point[1]
      previousZ = point[2]
    }
    return streamline(
      `sidewash-${side < 0 ? 'left' : 'right'}-${laneIndex}`,
      'sidewash',
      surfaceComponentIds(geometry, points, ['exterior-body-shell', 'greenhouse-and-pillars', lateralComponentId, 'wheel-arches']),
      points,
      0.96 + laneIndex * 0.04,
      0.72,
    )
  }))
}

function buildWheelWakeStreamlines(spec: VehicleSpec, geometry: VehicleAeroGeometry): AeroStreamline[] {
  const tail = geometry.bodyRearX - 1.35
  return geometry.wheels.map((wheel, index) => {
    const [x, y, z] = wheel.centre
    const side = Math.sign(z) || 1
    const outboardZ = z + side * (wheel.halfWidth + surfaceClearance)
    return streamline(
      `${index > 1 ? 'rear' : 'front'}-wheel-wake-${index}`,
      'wheel-wake',
      [index > 1 ? 'rear-slick-tyres' : 'front-slick-tyres', 'road-wheels-and-tyres', 'beadlock-wheels-and-tyres'],
      clearPath(geometry, [
        [x + wheel.radius + 0.72, y + wheel.radius * 0.48, outboardZ],
        [x + wheel.radius * 0.38, y + wheel.radius * 0.78, outboardZ],
        [x - wheel.radius * 0.42, y + wheel.radius * 0.2, outboardZ + side * wheel.halfWidth * 0.7],
        [Math.min(tail, x - wheel.radius * 1.8), y - wheel.radius * 0.22, outboardZ + side * (wheel.halfWidth * 2.4 + 0.15)],
      ], 'side', side),
      0.7 + (index % 2) * 0.05,
      0.78,
    )
  })
}

function buildUnderbodyStreamlines(
  spec: VehicleSpec,
  influences: readonly AeroComponentInfluence[],
  geometry: VehicleAeroGeometry,
): AeroStreamline[] {
  const underbodyIds = influences.filter((influence) => influence.role === 'underbody' || influence.role === 'aero-surface').map((influence) => influence.componentId)
  if (!underbodyIds.length) return []
  const { profile } = geometry
  const front = geometry.bodyFrontX
  const rear = geometry.bodyRearX
  const span = profile.bodyWidth * 0.4
  const startX = front + 0.5
  const endX = rear - 0.82
  const samples = Math.max(42, Math.ceil((startX - endX) / 0.075))
  return [-0.82, -0.42, 0, 0.42, 0.82].map((ratio, index) => {
    const z = ratio * span
    const frontFloor = geometry.bottomBoundaryAt(front * 0.96, z)?.point[1]
      ?? profile.bodyY - profile.bodyHeight * 0.35
    let previousY = Math.max(0.022, frontFloor - surfaceClearance - 0.045)
    const points: AeroPoint[] = []
    for (let sample = 0; sample <= samples; sample += 1) {
      const progress = sample / samples
      const x = startX + (endX - startX) * progress
      const boundary = geometry.bottomBoundaryAt(x, z)
      const target = boundary ? boundary.point[1] - surfaceClearance : previousY + 0.01
      // The route follows the floor/diffuser downwards immediately, then lets
      // the wake rise gently after the underbody ends.
      const y = boundary ? Math.min(target, previousY + 0.026) : target
      const point = clearPoint(geometry, [x, Math.max(0.018, y), z], 'underbody', Math.sign(z) || 1)
      points.push(point)
      previousY = point[1]
    }
    return streamline(
      `underbody-${index}`,
      'underbody',
      surfaceComponentIds(geometry, points, underbodyIds),
      points,
      1.1 + spec.diffuserDepth * 1.35,
      0.84,
    )
  })
}

function buildComponentStreamlines(
  spec: VehicleSpec,
  influences: readonly AeroComponentInfluence[],
  geometry: VehicleAeroGeometry,
): AeroStreamline[] {
  const tail = geometry.bodyRearX - 1.1
  return influences
    .filter((influence) => influence.role === 'aero-surface' || influence.role === 'cooling')
    .slice(0, 14)
    .map((influence, index) => {
      const family: AeroFlowFamily = influence.role === 'cooling' ? 'cooling' : 'aero-surface'
      const [x, y, z] = influence.anchor
      const side = Math.sign(z) || (index % 2 === 0 ? 1 : -1)
      const route: SurfaceRoute = influence.role === 'cooling' ? 'side' : y < geometry.profile.bodyY ? 'underbody' : 'roof'
      return streamline(
        `component-${influence.componentId}`,
        family,
        [influence.componentId],
        clearPath(geometry, [
          [x + influence.span * 0.55, y + influence.deflection * 0.22, z],
          [x + influence.span * 0.12, y + influence.deflection, z + side * influence.span * 0.16],
          [x - influence.span * 0.5, y - influence.deflection * 0.16, z + side * influence.span * 0.34],
          [Math.min(tail, x - influence.span * 1.5), y - influence.deflection * 0.32, z + side * influence.span * 0.5],
        ], route, side),
        influence.role === 'aero-surface' ? 1.18 : 0.86,
        influence.role === 'aero-surface' ? 0.86 : 0.6,
      )
    })
}

function pressureKind(influence: AeroComponentInfluence): AeroPressureZone['kind'] {
  if (influence.role === 'aero-surface' || influence.role === 'underbody') return 'low-pressure'
  if (influence.role === 'wheel-wake' || influence.role === 'obstruction') return 'separation'
  return 'stagnation'
}

function buildPressureZones(influences: readonly AeroComponentInfluence[]): AeroPressureZone[] {
  return influences.map((influence) => ({
    id: `pressure-${influence.componentId}`,
    componentId: influence.componentId,
    kind: pressureKind(influence),
    anchor: influence.anchor,
    radius: rounded(Math.max(0.08, influence.span * 0.3)),
    strength: rounded(clamp(influence.downforceWeight + influence.dragWeight + influence.deflection * 0.45, 0.12, 1)),
  }))
}

function buildWakeZones(spec: VehicleSpec, influences: readonly AeroComponentInfluence[]): AeroWakeZone[] {
  const tailLength = Math.max(spec.overallLength * 0.36, 1.4)
  return influences
    .filter((influence) => influence.role === 'wheel-wake' || influence.role === 'obstruction' || /rear-wing|diffuser|greenhouse|sidepod|body-shell/.test(influence.componentId))
    .map((influence) => ({
      id: `wake-${influence.componentId}`,
      componentId: influence.componentId,
      anchor: [rounded(influence.anchor[0] - influence.span * 0.2), influence.anchor[1], influence.anchor[2]] as AeroPoint,
      length: rounded(tailLength * (influence.role === 'wheel-wake' ? 1 : 0.62)),
      radius: rounded(Math.max(0.09, influence.span * (influence.role === 'wheel-wake' ? 0.44 : 0.28))),
      severity: rounded(clamp(influence.dragWeight + influence.deflection * 0.6, 0.12, 1)),
    }))
}

function buildEstimate(spec: VehicleSpec, influences: readonly AeroComponentInfluence[]): AeroEstimate {
  const baseDrag: Record<VehicleSpec['vehicleClass'], number> = {
    formula: 56, gt: 31, rally: 47, suv: 50, truck: 58, monster: 84, ev: 28, road: 34,
  }
  const baseDownforce: Record<VehicleSpec['vehicleClass'], number> = {
    formula: 72, gt: 20, rally: 13, suv: 5, truck: 3, monster: 1, ev: 8, road: 6,
  }
  const dragWeight = influences.reduce((sum, influence) => sum + influence.dragWeight, 0)
  const downforceWeight = influences.reduce((sum, influence) => sum + influence.downforceWeight, 0)
  const dragIndex = clamp(baseDrag[spec.vehicleClass] + dragWeight * 3.4 + spec.overallHeight / Math.max(spec.overallWidth, 0.5) * 5, 0, 100)
  const downforceIndex = clamp(baseDownforce[spec.vehicleClass] + downforceWeight * 5.2 + (spec.frontWing + spec.rearWing) * 13 + spec.diffuserDepth * 28, 0, 100)
  return {
    assumedSpeedKph: assumedSpeedKph(spec.vehicleClass),
    dragIndex: Math.round(dragIndex),
    downforceIndex: Math.round(downforceIndex),
    frontLoadBias: Math.round(clamp(spec.downforceBias * 100, 35, 65)),
    confidence: 'concept-level',
  }
}

export function buildAeroFlowPlan(spec: VehicleSpec): AeroFlowPlan {
  const geometry = buildVehicleAeroGeometry(spec)
  const componentInfluences = getRequiredComponents(spec).map((component) => componentInfluence(spec, component, geometry))
  const streamlines = [
    ...buildRooflineStreamlines(spec, geometry),
    ...buildSidewashStreamlines(geometry),
    ...buildWheelWakeStreamlines(spec, geometry),
    ...buildUnderbodyStreamlines(spec, componentInfluences, geometry),
    ...buildComponentStreamlines(spec, componentInfluences, geometry),
  ]
  return {
    analysisKind: 'component-aware-estimate',
    disclaimer: 'Component-aware aerodynamic estimate, not a CFD solve. It uses the active schema, component graph, package proportions, and deterministic flow heuristics; validate final decisions with a meshed CFD solver and wind-tunnel or track correlation.',
    componentInfluences,
    pressureZones: buildPressureZones(componentInfluences),
    wakeZones: buildWakeZones(spec, componentInfluences),
    streamlines,
    estimate: buildEstimate(spec, componentInfluences),
  }
}
