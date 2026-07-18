import type { VehicleSpec } from '../types'
import { getGeometryProfile, type GeometryProfile } from './vehicleGeometry'

/**
 * Shared, procedural collision surfaces for the real-time aero estimate.
 * They are deliberately simple analytic primitives derived from the same
 * dimensions the viewport uses. This is not a watertight CFD mesh, but it
 * gives every important visible system a surface, normal, and clearance test.
 */
export type AeroPoint = [number, number, number]

export type AeroBodySection = {
  bottom: number
  top: number
  halfWidth: number
}

export type AeroWheel = {
  centre: AeroPoint
  radius: number
  halfWidth: number
}

export type AeroSurfaceKind =
  | 'body-shell'
  | 'cabin'
  | 'wheel'
  | 'wheel-arch'
  | 'mirror'
  | 'wing'
  | 'endplate'
  | 'sidepod'
  | 'intake'
  | 'floor'
  | 'diffuser'
  | 'cargo-bed'
  | 'tube-frame'

export type AeroSurfaceRole = 'body' | 'aero' | 'wheel' | 'cooling' | 'underbody' | 'structure'

export type AeroCollider =
  | { shape: 'profile-prism' }
  | { shape: 'box'; centre: AeroPoint; size: AeroPoint; rotationZ?: number }
  | { shape: 'cylinder-z'; centre: AeroPoint; radius: number; halfWidth: number }

export type AeroSurface = {
  id: string
  componentId: string
  label: string
  kind: AeroSurfaceKind
  role: AeroSurfaceRole
  collider: AeroCollider
  /** Centre used by authored seed placement and component wake hints. */
  anchor: AeroPoint
  /** Broad-phase radius for cheap route selection; exact queries use collider. */
  interactionRadius: number
  collidable: boolean
  /** Relative real-time field authority, not a physical coefficient. */
  deflection: number
  wake: number
}

export type AeroSurfaceHit = {
  surface: AeroSurface
  /** Signed meters: negative inside a primitive, positive outside it. */
  distance: number
  normal: AeroPoint
  nearestPoint: AeroPoint
  inside: boolean
}

export type AeroSurfaceBoundary = {
  point: AeroPoint
  surface: AeroSurface
}

export type VehicleAeroGeometry = {
  profile: GeometryProfile
  bodyFrontX: number
  bodyRearX: number
  wheels: readonly AeroWheel[]
  surfaces: readonly AeroSurface[]
  bodySectionAt: (x: number) => AeroBodySection | null
  roofSurfaceAt: (x: number, z: number) => number | null
  floorSurfaceAt: (x: number, z: number) => number | null
  sideSurfaceAt: (x: number, y: number) => number | null
  /** Outermost procedural surface along a side ray at this x/y station. */
  sideBoundaryAt: (x: number, y: number, side: number) => AeroSurfaceBoundary | null
  /** Highest procedural surface along a vertical ray at this x/z station. */
  topBoundaryAt: (x: number, z: number) => AeroSurfaceBoundary | null
  /** Lowest procedural surface along a vertical ray at this x/z station. */
  bottomBoundaryAt: (x: number, z: number) => AeroSurfaceBoundary | null
  nearestSurface: (point: AeroPoint) => AeroSurfaceHit
  projectOutside: (point: AeroPoint, clearance: number, preference?: AeroPoint) => AeroPoint
  contains: (point: AeroPoint, margin?: number) => boolean
}

const EPSILON = 0.0001
const BOUNDARY_STEP = 0.018

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const add = (left: AeroPoint, right: AeroPoint): AeroPoint => [left[0] + right[0], left[1] + right[1], left[2] + right[2]]
const subtract = (left: AeroPoint, right: AeroPoint): AeroPoint => [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
const multiply = (point: AeroPoint, scalar: number): AeroPoint => [point[0] * scalar, point[1] * scalar, point[2] * scalar]
const length = (point: AeroPoint) => Math.hypot(point[0], point[1], point[2])
const normalize = (point: AeroPoint): AeroPoint => {
  const magnitude = length(point)
  return magnitude < EPSILON ? [1, 0, 0] : [point[0] / magnitude, point[1] / magnitude, point[2] / magnitude]
}

function bodyVerticalBounds(profile: GeometryProfile, x: number) {
  const normalizedX = x / Math.max(profile.bodyLength, EPSILON)
  const intersections: number[] = []
  for (let index = 0; index < profile.contour.length; index += 1) {
    const [x0, y0] = profile.contour[index]
    const [x1, y1] = profile.contour[(index + 1) % profile.contour.length]
    const minX = Math.min(x0, x1)
    const maxX = Math.max(x0, x1)
    if (normalizedX < minX - EPSILON || normalizedX > maxX + EPSILON) continue
    if (Math.abs(x1 - x0) < EPSILON) {
      if (Math.abs(normalizedX - x0) < EPSILON) intersections.push(y0, y1)
      continue
    }
    const progress = (normalizedX - x0) / (x1 - x0)
    if (progress >= -EPSILON && progress <= 1 + EPSILON) intersections.push(y0 + (y1 - y0) * progress)
  }
  if (intersections.length < 2) return null
  return {
    bottom: profile.bodyY + Math.min(...intersections) * profile.bodyHeight,
    top: profile.bodyY + Math.max(...intersections) * profile.bodyHeight,
  }
}

function cabinBounds(profile: GeometryProfile) {
  const { cabin } = profile
  const sine = Math.abs(Math.sin(cabin.tilt))
  const cosine = Math.abs(Math.cos(cabin.tilt))
  return {
    minX: cabin.x - (cabin.length * cosine + cabin.height * sine) / 2,
    maxX: cabin.x + (cabin.length * cosine + cabin.height * sine) / 2,
    minY: profile.bodyY + cabin.y - (cabin.height * cosine + cabin.length * sine) / 2,
    maxY: profile.bodyY + cabin.y + (cabin.height * cosine + cabin.length * sine) / 2,
    halfWidth: cabin.width / 2,
  }
}

function polygonArea(points: readonly [number, number][]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0) * 0.5
}

function pointInsidePolygon(point: readonly [number, number], polygon: readonly [number, number][]) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [x, y] = point
    const [xi, yi] = polygon[index]
    const [xj, yj] = polygon[previous]
    const denominator = yj - yi
    const crossing = (yi > y) !== (yj > y)
      && Math.abs(denominator) > EPSILON
      && x < ((xj - xi) * (y - yi)) / denominator + xi
    if (crossing) inside = !inside
  }
  return inside
}

function polygonDistance(point: readonly [number, number], polygon: readonly [number, number][]) {
  let closest: [number, number] = polygon[0]
  let closestDistance = Number.POSITIVE_INFINITY
  let edge: [[number, number], [number, number]] = [polygon[0], polygon[1]]
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const denominator = dx * dx + dy * dy
    const progress = denominator < EPSILON ? 0 : clamp(((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denominator, 0, 1)
    const candidate: [number, number] = [start[0] + dx * progress, start[1] + dy * progress]
    const distance = Math.hypot(point[0] - candidate[0], point[1] - candidate[1])
    if (distance < closestDistance) {
      closestDistance = distance
      closest = candidate
      edge = [start, end]
    }
  }
  const inside = pointInsidePolygon(point, polygon)
  const vector: [number, number] = [point[0] - closest[0], point[1] - closest[1]]
  const winding = polygonArea(polygon)
  const edgeVector: [number, number] = [edge[1][0] - edge[0][0], edge[1][1] - edge[0][1]]
  const fallback = winding >= 0
    ? [edgeVector[1], -edgeVector[0]] as [number, number]
    : [-edgeVector[1], edgeVector[0]] as [number, number]
  const normal2 = Math.hypot(vector[0], vector[1]) > EPSILON
    ? [vector[0] / closestDistance, vector[1] / closestDistance] as [number, number]
    : (() => {
      const magnitude = Math.hypot(fallback[0], fallback[1])
      return [fallback[0] / magnitude, fallback[1] / magnitude] as [number, number]
    })()
  return { distance: inside ? -closestDistance : closestDistance, closest, normal: normal2, inside }
}

function queryProfilePrism(
  surface: AeroSurface,
  point: AeroPoint,
  polygon: readonly [number, number][],
  halfWidth: number,
): AeroSurfaceHit {
  const planar = polygonDistance([point[0], point[1]], polygon)
  const sideDistance = Math.abs(point[2]) - halfWidth
  const outsidePlanar = Math.max(planar.distance, 0)
  const outsideSide = Math.max(sideDistance, 0)
  const outside = Math.hypot(outsidePlanar, outsideSide)
  const distance = outside + Math.min(Math.max(planar.distance, sideDistance), 0)
  let normal: AeroPoint
  if (outside > EPSILON) {
    normal = normalize([
      planar.normal[0] * outsidePlanar,
      planar.normal[1] * outsidePlanar,
      Math.sign(point[2] || 1) * outsideSide,
    ])
  } else if (planar.distance > sideDistance) {
    normal = [planar.normal[0], planar.normal[1], 0]
  } else {
    normal = [0, 0, Math.sign(point[2] || 1)]
  }
  return {
    surface,
    distance,
    normal,
    nearestPoint: subtract(point, multiply(normal, distance)),
    inside: distance <= 0,
  }
}

function queryBox(surface: AeroSurface, point: AeroPoint, collider: Extract<AeroCollider, { shape: 'box' }>): AeroSurfaceHit {
  const rotation = collider.rotationZ ?? 0
  const cosine = Math.cos(rotation)
  const sine = Math.sin(rotation)
  const translated = subtract(point, collider.centre)
  const local: AeroPoint = [
    cosine * translated[0] + sine * translated[1],
    -sine * translated[0] + cosine * translated[1],
    translated[2],
  ]
  const half: AeroPoint = [collider.size[0] / 2, collider.size[1] / 2, collider.size[2] / 2]
  const q: AeroPoint = [Math.abs(local[0]) - half[0], Math.abs(local[1]) - half[1], Math.abs(local[2]) - half[2]]
  const outside: AeroPoint = [Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]
  const outsideLength = length(outside)
  const distance = outsideLength + Math.min(Math.max(q[0], q[1], q[2]), 0)
  let localNormal: AeroPoint
  if (outsideLength > EPSILON) {
    localNormal = normalize([
      Math.sign(local[0] || 1) * outside[0],
      Math.sign(local[1] || 1) * outside[1],
      Math.sign(local[2] || 1) * outside[2],
    ])
  } else {
    const axis = q[0] >= q[1] && q[0] >= q[2] ? 0 : q[1] >= q[2] ? 1 : 2
    localNormal = axis === 0
      ? [Math.sign(local[0] || 1), 0, 0]
      : axis === 1 ? [0, Math.sign(local[1] || 1), 0] : [0, 0, Math.sign(local[2] || 1)]
  }
  const normal: AeroPoint = [
    cosine * localNormal[0] - sine * localNormal[1],
    sine * localNormal[0] + cosine * localNormal[1],
    localNormal[2],
  ]
  return {
    surface,
    distance,
    normal,
    nearestPoint: subtract(point, multiply(normal, distance)),
    inside: distance <= 0,
  }
}

function queryCylinderZ(surface: AeroSurface, point: AeroPoint, collider: Extract<AeroCollider, { shape: 'cylinder-z' }>): AeroSurfaceHit {
  const local = subtract(point, collider.centre)
  const radialLength = Math.hypot(local[0], local[1])
  const radialDistance = radialLength - collider.radius
  const sideDistance = Math.abs(local[2]) - collider.halfWidth
  const outsideRadial = Math.max(radialDistance, 0)
  const outsideSide = Math.max(sideDistance, 0)
  const outside = Math.hypot(outsideRadial, outsideSide)
  const distance = outside + Math.min(Math.max(radialDistance, sideDistance), 0)
  const radialNormal: AeroPoint = radialLength < EPSILON ? [1, 0, 0] : [local[0] / radialLength, local[1] / radialLength, 0]
  let normal: AeroPoint
  if (outside > EPSILON) {
    normal = normalize([
      radialNormal[0] * outsideRadial,
      radialNormal[1] * outsideRadial,
      Math.sign(local[2] || 1) * outsideSide,
    ])
  } else if (radialDistance > sideDistance) {
    normal = radialNormal
  } else {
    normal = [0, 0, Math.sign(local[2] || 1)]
  }
  return {
    surface,
    distance,
    normal,
    nearestPoint: subtract(point, multiply(normal, distance)),
    inside: distance <= 0,
  }
}

function addSurface(
  surfaces: AeroSurface[],
  id: string,
  componentId: string,
  label: string,
  kind: AeroSurfaceKind,
  role: AeroSurfaceRole,
  collider: AeroCollider,
  deflection: number,
  wake: number,
  options?: Partial<Pick<AeroSurface, 'anchor' | 'interactionRadius' | 'collidable'>>,
) {
  const anchor = options?.anchor
    ?? (collider.shape === 'profile-prism' ? [0, 0, 0] as AeroPoint : collider.centre)
  const interactionRadius = options?.interactionRadius
    ?? (collider.shape === 'profile-prism'
      ? 1
      : collider.shape === 'box'
        ? Math.max(collider.size[0], collider.size[1], collider.size[2]) / 2
        : Math.max(collider.radius, collider.halfWidth))
  surfaces.push({
    id,
    componentId,
    label,
    kind,
    role,
    collider,
    anchor,
    interactionRadius,
    collidable: options?.collidable ?? true,
    deflection,
    wake,
  })
}

function buildSurfaceRegistry(spec: VehicleSpec, profile: GeometryProfile, wheels: readonly AeroWheel[]): AeroSurface[] {
  const surfaces: AeroSurface[] = []
  const isPassenger = spec.vehicleClass !== 'formula' && spec.vehicleClass !== 'monster'
  if (isPassenger) {
    addSurface(surfaces, 'body-shell', 'exterior-body-shell', 'Exterior body shell', 'body-shell', 'body', { shape: 'profile-prism' }, 0.34, 0.28, {
      anchor: [0, profile.bodyY, 0], interactionRadius: Math.max(profile.bodyLength, profile.bodyWidth) / 2,
    })
    addSurface(surfaces, 'greenhouse', 'greenhouse-and-pillars', 'Greenhouse and pillars', 'cabin', 'body', {
      shape: 'box', centre: [profile.cabin.x, profile.bodyY + profile.cabin.y, 0], size: [profile.cabin.length, profile.cabin.height, profile.cabin.width], rotationZ: profile.cabin.tilt,
    }, 0.42, 0.35)
  }

  wheels.forEach((wheel, index) => {
    const front = index < 2
    const componentId = spec.vehicleClass === 'formula'
      ? front ? 'front-slick-tyres' : 'rear-slick-tyres'
      : spec.vehicleClass === 'monster' ? 'beadlock-wheels-and-tyres' : 'road-wheels-and-tyres'
    addSurface(surfaces, `wheel-${index}`, componentId, `${front ? 'Front' : 'Rear'} tyre`, 'wheel', 'wheel', {
      shape: 'cylinder-z', centre: wheel.centre, radius: wheel.radius, halfWidth: wheel.halfWidth,
    }, 0.65, 0.85)
  })

  if (isPassenger) {
    const sideZ = profile.bodyWidth * 0.51
    ;[-1, 1].forEach((side) => {
      addSurface(surfaces, `mirror-${side}`, 'side-mirrors', 'Side mirror', 'mirror', 'body', {
        shape: 'box',
        centre: [profile.cabin.x + profile.cabin.length * 0.38, profile.bodyY + profile.cabin.y * 0.75, side * (sideZ + 0.14)],
        size: [0.16, 0.07, 0.07],
      }, 0.86, 0.62)
    })
    wheels.forEach((wheel, index) => {
      addSurface(surfaces, `wheel-arch-${index}`, 'wheel-arches', 'Wheel arch envelope', 'wheel-arch', 'body', {
        shape: 'cylinder-z', centre: [wheel.centre[0], wheel.centre[1] + wheel.radius * 0.1, wheel.centre[2]], radius: wheel.radius * 1.1, halfWidth: wheel.halfWidth * 1.08,
      }, 0.46, 0.58)
    })
    const grilleWidth = Math.max(profile.bodyWidth * 0.34, spec.coolingIntake * profile.bodyWidth * 0.95)
    addSurface(surfaces, 'thermal-inlet', 'thermal-inlets-and-exits', 'Thermal inlet', 'intake', 'cooling', {
      shape: 'box', centre: [profile.bodyLength * 0.505 + 0.008, profile.bodyY - profile.bodyHeight * 0.12, 0], size: [0.05, 0.16, grilleWidth],
    }, 0.38, 0.32)
    addSurface(surfaces, 'underbody-diffuser', 'underbody-diffuser', 'Underbody diffuser', 'diffuser', 'underbody', {
      shape: 'box', centre: [-spec.wheelbase * 0.22, profile.bodyY - 0.28, 0], size: [spec.wheelbase * 0.65, 0.08 + spec.diffuserDepth * 0.35, profile.bodyWidth * 0.72],
    }, 0.72, 0.44)
    const showAero = ((spec.vehicleClass === 'gt' || spec.vehicleClass === 'rally') && spec.rearWing > 0.26)
      || (spec.frontWing > 0.28 && spec.rearWing > 0.38)
    if (showAero) {
      addSurface(surfaces, 'passenger-front-wing', 'front-aero-wing', 'Front aero wing', 'wing', 'aero', {
        shape: 'box',
        centre: [spec.wheelbase / 2 + 0.34, profile.bodyY + 0.03, 0],
        size: [0.36 + spec.frontWing * 0.34, 0.04, Math.max(spec.frontTrack * 1.1, 1.28)],
        rotationZ: 0.08,
      }, 0.92, 0.42)
      addSurface(surfaces, 'passenger-rear-wing', 'rear-aero-wing', 'Rear aero wing', 'wing', 'aero', {
        shape: 'box',
        centre: [-spec.wheelbase / 2 - 0.35, profile.bodyY + 0.38, 0],
        size: [0.32 + spec.rearWing * 0.33, 0.04, Math.max(spec.rearTrack * 0.94, 1.14)],
        rotationZ: -0.12,
      }, 1.08, 0.7)
    }
    if (profile.hasCargoBed) {
      addSurface(surfaces, 'cargo-bed', 'cargo-bed', 'Cargo bed', 'cargo-bed', 'body', {
        shape: 'box', centre: [spec.overallLength * 0.25, profile.bodyY + 0.05, 0], size: [spec.overallLength * 0.31, 0.35, profile.bodyWidth * 0.98],
      }, 0.28, 0.46)
    }
  }

  if (spec.vehicleClass === 'formula') {
    const frontX = spec.wheelbase / 2
    const rearX = -spec.wheelbase / 2
    const frontSpan = Math.max(spec.frontTrack + 0.3, 1.95)
    const rearSpan = Math.max(spec.rearTrack + 0.04, 1.66)
    const frontWingX = frontX + 0.4
    const frontWingY = profile.bodyY - 0.2
    const rearWingX = rearX - 0.38
    const rearWingY = profile.bodyY + 0.48
    const floorY = profile.bodyY - 0.2
    // These colliders intentionally mirror FormulaBodywork rather than use
    // the passenger-car silhouette proxy. They are simple analytic envelopes
    // around the rendered nose, chassis, engine cover and rear bodywork.
    addSurface(surfaces, 'formula-nose', 'formula-nose-and-crash-structure', 'Formula nose and crash structure', 'body-shell', 'body', {
      shape: 'box', centre: [0.93, profile.bodyY + 0.015, 0], size: [1.28, 0.42, 0.42],
    }, 0.38, 0.3)
    addSurface(surfaces, 'formula-chassis', 'formula-central-chassis', 'Formula central chassis', 'body-shell', 'body', {
      shape: 'box', centre: [-0.03, profile.bodyY + 0.08, 0], size: [0.94, 0.34, 0.56],
    }, 0.46, 0.34)
    addSurface(surfaces, 'formula-engine-cover', 'formula-engine-cover', 'Formula engine cover', 'body-shell', 'body', {
      shape: 'box', centre: [-0.74, profile.bodyY + 0.2, 0], size: [0.78, 0.42, 0.4], rotationZ: 0.08,
    }, 0.48, 0.44)
    addSurface(surfaces, 'formula-rear-bodywork', 'formula-rear-bodywork', 'Formula rear bodywork', 'body-shell', 'body', {
      shape: 'box', centre: [-1.22, profile.bodyY + 0.12, 0], size: [1.08, 0.44, 0.44],
    }, 0.5, 0.52)
    addSurface(surfaces, 'formula-halo', 'halo-and-cockpit-safety-cell', 'Halo and cockpit safety cell', 'tube-frame', 'structure', {
      shape: 'box', centre: [-0.63, profile.bodyY + 0.56, 0], size: [0.26, 0.18, 0.3],
    }, 0.38, 0.5)
    addSurface(surfaces, 'formula-front-wing', 'front-wing-mainplane', 'Front wing mainplane', 'wing', 'aero', {
      shape: 'box', centre: [frontWingX, frontWingY, 0], size: [0.48, 0.1, frontSpan], rotationZ: 0.04,
    }, 1.18, 0.42)
    ;[-1, 1].forEach((side) => addSurface(surfaces, `formula-front-endplate-${side}`, 'front-wing-endplates', 'Front wing endplate', 'endplate', 'aero', {
      shape: 'box', centre: [frontWingX - 0.02, frontWingY + 0.12, side * (frontSpan / 2 - 0.012)], size: [0.52, 0.35, 0.06], rotationZ: -0.1,
    }, 1.02, 0.6))
    ;[-1, 1].forEach((side) => {
      addSurface(surfaces, `formula-sidepod-${side}`, 'sidepod-undercuts', 'Sidepod undercut', 'sidepod', 'body', {
        shape: 'box', centre: [-0.78, profile.bodyY + 0.005, side * 0.47], size: [1.18, 0.44, 0.38],
      }, 0.72, 0.64)
      addSurface(surfaces, `formula-sidepod-inlet-${side}`, 'sidepod-inlets', 'Sidepod cooling inlet', 'intake', 'cooling', {
        shape: 'box', centre: [-0.22, profile.bodyY + 0.08, side * 0.627], size: [0.34, 0.18, 0.04], rotationZ: side * 0.02,
      }, 0.9, 0.58)
    })
    addSurface(surfaces, 'formula-floor', 'venturi-tunnels', 'Venturi tunnels', 'floor', 'underbody', {
      shape: 'box', centre: [-0.04, floorY, 0], size: [spec.wheelbase * 0.95, 0.075, 1.22],
    }, 1.06, 0.36)
    addSurface(surfaces, 'formula-diffuser', 'diffuser-and-strakes', 'Diffuser and strakes', 'diffuser', 'underbody', {
      shape: 'box', centre: [rearX - 0.17, floorY + 0.065, 0], size: [0.72, 0.12, 1.18], rotationZ: -0.12,
    }, 1.22, 0.78)
    addSurface(surfaces, 'formula-rear-wing', 'rear-wing-and-endplates', 'Rear wing and endplates', 'wing', 'aero', {
      shape: 'box', centre: [rearWingX, rearWingY, 0], size: [0.42, 0.12, rearSpan], rotationZ: -0.13,
    }, 1.18, 0.86)
  }

  if (spec.vehicleClass === 'monster') {
    const frameY = spec.wheelRadius + Math.max(0.44, spec.rideHeight * 0.83)
    const bodyWidth = profile.bodyWidth * 0.84
    const cabY = frameY + 0.53
    addSurface(surfaces, 'monster-cab', 'tube-frame-safety-cage', 'Cab and safety-cage envelope', 'cabin', 'body', {
      shape: 'box', centre: [-0.2, cabY, 0], size: [1.04, 0.76, bodyWidth * 0.72],
    }, 0.56, 0.76)
    addSurface(surfaces, 'monster-hood', 'engine-and-cooling-module', 'Engine and cooling module', 'body-shell', 'body', {
      shape: 'box', centre: [0.78, frameY + 0.26, 0], size: [1.14, 0.3, bodyWidth * 0.82], rotationZ: -0.06,
    }, 0.48, 0.7)
    addSurface(surfaces, 'monster-bed', 'cargo-bed', 'Cargo bed', 'cargo-bed', 'body', {
      shape: 'box', centre: [-1.12, frameY + 0.19, 0], size: [1.08, 0.32, bodyWidth * 0.83],
    }, 0.38, 0.66)
  }

  return surfaces
}

export function buildVehicleAeroGeometry(spec: VehicleSpec): VehicleAeroGeometry {
  const profile = getGeometryProfile(spec)
  const bodyFrontX = profile.bodyLength / 2
  const bodyRearX = -profile.bodyLength / 2
  const bodyContour = profile.contour.map(([x, y]) => [
    x * profile.bodyLength,
    profile.bodyY + y * profile.bodyHeight,
  ] as [number, number])
  const bodyHalfWidth = profile.bodyWidth / 2
  const cabin = cabinBounds(profile)
  const wheels: AeroWheel[] = [
    { centre: [spec.wheelbase / 2, spec.wheelRadius, spec.frontTrack / 2], radius: spec.wheelRadius, halfWidth: spec.tireWidth / 2 },
    { centre: [spec.wheelbase / 2, spec.wheelRadius, -spec.frontTrack / 2], radius: spec.wheelRadius, halfWidth: spec.tireWidth / 2 },
    { centre: [-spec.wheelbase / 2, spec.wheelRadius, spec.rearTrack / 2], radius: spec.wheelRadius, halfWidth: spec.tireWidth / 2 },
    { centre: [-spec.wheelbase / 2, spec.wheelRadius, -spec.rearTrack / 2], radius: spec.wheelRadius, halfWidth: spec.tireWidth / 2 },
  ]
  const surfaces = buildSurfaceRegistry(spec, profile, wheels)

  const bodySectionAt = (x: number): AeroBodySection | null => {
    const bounds = bodyVerticalBounds(profile, x)
    if (!bounds) return null
    return { ...bounds, halfWidth: profile.bodyWidth / 2 }
  }

  const roofSurfaceAt = (x: number, z: number) => {
    const body = bodySectionAt(x)
    let roof = body && Math.abs(z) <= body.halfWidth + EPSILON ? body.top : null
    if (x >= cabin.minX - EPSILON && x <= cabin.maxX + EPSILON && Math.abs(z) <= cabin.halfWidth + EPSILON) {
      roof = Math.max(roof ?? -Infinity, cabin.maxY)
    }
    return roof
  }

  const floorSurfaceAt = (x: number, z: number) => {
    const body = bodySectionAt(x)
    return body && Math.abs(z) <= body.halfWidth + EPSILON ? body.bottom : null
  }

  const sideSurfaceAt = (x: number, y: number) => {
    const body = bodySectionAt(x)
    let side = body && y >= body.bottom - EPSILON && y <= body.top + EPSILON ? body.halfWidth : null
    if (x >= cabin.minX - EPSILON && x <= cabin.maxX + EPSILON && y >= cabin.minY - EPSILON && y <= cabin.maxY + EPSILON) {
      side = Math.max(side ?? 0, cabin.halfWidth)
    }
    return side
  }

  const querySurface = (surface: AeroSurface, point: AeroPoint) => {
    switch (surface.collider.shape) {
      case 'profile-prism': return queryProfilePrism(surface, point, bodyContour, bodyHalfWidth)
      case 'box': return queryBox(surface, point, surface.collider)
      case 'cylinder-z': return queryCylinderZ(surface, point, surface.collider)
    }
  }

  const nearestSurface = (point: AeroPoint) => surfaces.reduce<AeroSurfaceHit>((nearest, surface) => {
    const hit = querySurface(surface, point)
    return Math.abs(hit.distance) < Math.abs(nearest.distance) ? hit : nearest
  }, querySurface(surfaces[0], point))

  const contains = (point: AeroPoint, margin = 0) => surfaces.some((surface) => querySurface(surface, point).distance <= margin)

  const projectOutside = (point: AeroPoint, clearance: number, preference?: AeroPoint): AeroPoint => {
    const hit = nearestSurface(point)
    if (hit.distance >= clearance) return point
    const preferred = preference ? normalize(preference) : hit.normal
    const usePreferred = preference && (preferred[0] * hit.normal[0] + preferred[1] * hit.normal[1] + preferred[2] * hit.normal[2]) > 0.18
    const normal = usePreferred ? normalize(add(hit.normal, preferred)) : hit.normal
    return add(hit.nearestPoint, multiply(normal, clearance))
  }

  const scanBoundary = (origin: AeroPoint, direction: AeroPoint, maxDistance: number): AeroSurfaceBoundary | null => {
    let furthestInside = -1
    for (let distance = 0; distance <= maxDistance; distance += BOUNDARY_STEP) {
      const point = add(origin, multiply(direction, distance))
      if (contains(point)) furthestInside = distance
    }
    if (furthestInside < 0) return null
    let low = furthestInside
    let high = Math.min(maxDistance, furthestInside + BOUNDARY_STEP * 1.8)
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const midpoint = (low + high) / 2
      if (contains(add(origin, multiply(direction, midpoint)))) low = midpoint
      else high = midpoint
    }
    // Preserve the actual ray intersection rather than snapping it to the
    // nearest primitive feature. Snapping a vertical ray to a sloped cabin
    // face can move its point sideways/downwards and make a following line
    // cut through the glass even though the ray itself was clear.
    const edge = add(origin, multiply(direction, high))
    const hit = nearestSurface(edge)
    return { point: edge, surface: hit.surface }
  }

  const maxSide = Math.max(spec.overallWidth, spec.frontTrack, spec.rearTrack) * 0.8 + spec.wheelRadius + 1.3
  const sideBoundaryAt = (x: number, y: number, side: number) => scanBoundary([x, y, 0], [0, 0, side >= 0 ? 1 : -1], maxSide)
  const topBoundaryAt = (x: number, z: number) => scanBoundary([x, 0.01, z], [0, 1, 0], Math.max(3.5, spec.overallHeight + spec.wheelRadius * 2.8))
  const bottomBoundaryAt = (x: number, z: number) => scanBoundary([x, Math.max(3.5, spec.overallHeight + spec.wheelRadius * 2.8), z], [0, -1, 0], Math.max(3.5, spec.overallHeight + spec.wheelRadius * 2.8))

  return {
    profile,
    bodyFrontX,
    bodyRearX,
    wheels,
    surfaces,
    bodySectionAt,
    roofSurfaceAt,
    floorSurfaceAt,
    sideSurfaceAt,
    sideBoundaryAt,
    topBoundaryAt,
    bottomBoundaryAt,
    nearestSurface,
    projectOutside,
    contains,
  }
}

export function firstAeroPathCollision(
  geometry: VehicleAeroGeometry,
  points: readonly AeroPoint[],
  clearance = 0.001,
  samplesPerSegment = 12,
) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    for (let sample = 0; sample <= samplesPerSegment; sample += 1) {
      const progress = sample / samplesPerSegment
      const point: AeroPoint = [
        from[0] + (to[0] - from[0]) * progress,
        from[1] + (to[1] - from[1]) * progress,
        from[2] + (to[2] - from[2]) * progress,
      ]
      if (geometry.contains(point, clearance)) {
        const hit = geometry.nearestSurface(point)
        return { point, surfaceId: hit.surface.id, componentId: hit.surface.componentId }
      }
    }
  }
  return null
}

export function isAeroPathClear(
  geometry: VehicleAeroGeometry,
  points: readonly AeroPoint[],
  clearance = 0.001,
  samplesPerSegment = 12,
) {
  return firstAeroPathCollision(geometry, points, clearance, samplesPerSegment) === null
}
