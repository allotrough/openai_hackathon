import type { VehicleSpec } from '../types'

export type GeometryRecipe = 'fastback' | 'mid-engine-road' | 'road-sedan' | 'long-hood-gt' | 'rally-hatch' | 'utility-cab' | 'pickup' | 'tube-frame' | 'open-wheel'

export type GeometryProfile = {
  recipe: GeometryRecipe
  bodyLength: number
  bodyWidth: number
  bodyHeight: number
  bodyY: number
  contour: Array<[number, number]>
  cabin: { x: number; y: number; length: number; width: number; height: number; tilt: number }
  hasOpenWheels: boolean
  hasCargoBed: boolean
  hasTubeFrame: boolean
  headlampStyle: 'blade' | 'round' | 'pod' | 'utility'
}

const contour = (...points: Array<[number, number]>) => points

/**
 * A semantic geometry recipe. The renderer consumes this plan; it does not get
 * arbitrary mesh data from the model. Normalised contour points describe the
 * side silhouette, so vehicle classes cannot silently collapse to one pod.
 */
export function getGeometryProfile(spec: VehicleSpec): GeometryProfile {
  const roadBase = {
    bodyLength: spec.overallLength * 0.77,
    bodyWidth: spec.overallWidth * 0.7,
    bodyHeight: 0.58,
    bodyY: spec.wheelRadius + spec.rideHeight + 0.27,
  }
  switch (spec.vehicleClass) {
    case 'formula':
      return {
        recipe: 'open-wheel', bodyLength: spec.wheelbase * 0.92, bodyWidth: 0.58, bodyHeight: 0.3,
        bodyY: spec.wheelRadius + spec.rideHeight + 0.17,
        contour: contour([-0.5, -0.4], [0.5, -0.4], [0.47, -0.12], [0.2, -0.02], [0.04, 0.45], [-0.18, 0.5], [-0.38, 0.12], [-0.5, -0.1]),
        cabin: { x: -0.13, y: 0.24, length: 0.72, width: 0.54, height: 0.27, tilt: 0 },
        hasOpenWheels: true, hasCargoBed: false, hasTubeFrame: false, headlampStyle: 'pod',
      }
    case 'gt':
      return {
        recipe: 'long-hood-gt', ...roadBase, bodyHeight: 0.53,
        contour: contour([-0.5, -0.48], [0.5, -0.48], [0.5, -0.16], [0.29, -0.04], [0.05, 0.01], [-0.05, 0.46], [-0.28, 0.5], [-0.43, 0.15], [-0.5, -0.06]),
        cabin: { x: -0.16, y: 0.46, length: spec.overallLength * 0.31, width: roadBase.bodyWidth * 0.83, height: 0.42, tilt: -0.08 },
        hasOpenWheels: false, hasCargoBed: false, hasTubeFrame: false, headlampStyle: 'blade',
      }
    case 'rally':
      return {
        recipe: 'rally-hatch', bodyLength: spec.overallLength * 0.82, bodyWidth: spec.overallWidth * 0.76, bodyHeight: 0.72,
        bodyY: spec.wheelRadius + spec.rideHeight + 0.34,
        contour: contour([-0.5, -0.45], [0.5, -0.45], [0.5, -0.14], [0.36, -0.02], [0.19, 0.41], [-0.22, 0.48], [-0.42, 0.16], [-0.5, -0.02]),
        cabin: { x: -0.03, y: 0.53, length: spec.overallLength * 0.4, width: spec.overallWidth * 0.6, height: 0.48, tilt: -0.04 },
        hasOpenWheels: false, hasCargoBed: false, hasTubeFrame: false, headlampStyle: 'round',
      }
    case 'suv':
      return {
        recipe: 'utility-cab', bodyLength: spec.overallLength * 0.79, bodyWidth: spec.overallWidth * 0.75, bodyHeight: 0.92,
        bodyY: spec.wheelRadius + spec.rideHeight + 0.43,
        contour: contour([-0.5, -0.46], [0.5, -0.46], [0.5, -0.13], [0.35, -0.03], [0.24, 0.43], [-0.29, 0.49], [-0.45, 0.19], [-0.5, -0.02]),
        cabin: { x: -0.02, y: 0.73, length: spec.overallLength * 0.44, width: spec.overallWidth * 0.63, height: 0.67, tilt: 0 },
        hasOpenWheels: false, hasCargoBed: false, hasTubeFrame: false, headlampStyle: 'utility',
      }
    case 'truck':
      return {
        recipe: 'pickup', bodyLength: spec.overallLength * 0.82, bodyWidth: spec.overallWidth * 0.79, bodyHeight: 0.83,
        bodyY: spec.wheelRadius + spec.rideHeight + 0.4,
        contour: contour([-0.5, -0.46], [0.5, -0.46], [0.5, -0.15], [0.33, -0.01], [0.23, 0.47], [-0.08, 0.49], [-0.18, 0.04], [-0.5, 0.02]),
        cabin: { x: 0.02, y: 0.7, length: spec.overallLength * 0.3, width: spec.overallWidth * 0.65, height: 0.68, tilt: 0 },
        hasOpenWheels: false, hasCargoBed: true, hasTubeFrame: false, headlampStyle: 'utility',
      }
    case 'monster':
      return {
        recipe: 'tube-frame', bodyLength: spec.overallLength * 0.62, bodyWidth: spec.overallWidth * 0.62, bodyHeight: 0.95,
        bodyY: spec.wheelRadius + spec.rideHeight + 0.48,
        contour: contour([-0.5, -0.45], [0.5, -0.45], [0.47, -0.14], [0.28, 0.02], [0.15, 0.49], [-0.24, 0.49], [-0.43, 0.11], [-0.5, -0.06]),
        cabin: { x: -0.1, y: 0.72, length: spec.overallLength * 0.28, width: spec.overallWidth * 0.48, height: 0.79, tilt: 0 },
        hasOpenWheels: false, hasCargoBed: true, hasTubeFrame: true, headlampStyle: 'round',
      }
    case 'road':
      if (spec.roofProfile === 'cab-forward' || spec.engineLayout.includes('front-transverse')) {
        return {
          recipe: 'road-sedan', bodyLength: spec.overallLength * 0.81, bodyWidth: spec.overallWidth * 0.74, bodyHeight: 0.68,
          bodyY: spec.wheelRadius + spec.rideHeight + 0.31,
          contour: contour([-0.5, -0.46], [0.5, -0.46], [0.5, -0.11], [0.35, -0.02], [0.19, 0.39], [-0.24, 0.46], [-0.43, 0.15], [-0.5, -0.04]),
          cabin: { x: -0.05, y: 0.56, length: spec.overallLength * 0.43, width: spec.overallWidth * 0.59, height: 0.52, tilt: -0.02 },
          hasOpenWheels: false, hasCargoBed: false, hasTubeFrame: false, headlampStyle: 'utility',
        }
      }
      return {
        recipe: 'mid-engine-road', ...roadBase, bodyLength: spec.overallLength * 0.74, bodyHeight: 0.5,
        contour: contour([-0.5, -0.48], [0.5, -0.48], [0.5, -0.18], [0.38, -0.03], [0.13, 0.02], [-0.04, 0.5], [-0.25, 0.53], [-0.42, 0.15], [-0.5, -0.1]),
        cabin: { x: -0.12, y: 0.44, length: spec.overallLength * 0.32, width: roadBase.bodyWidth * 0.8, height: 0.39, tilt: -0.08 },
        hasOpenWheels: false, hasCargoBed: false, hasTubeFrame: false, headlampStyle: 'blade',
      }
    case 'ev':
    default:
      return {
        recipe: 'fastback', ...roadBase,
        contour: contour([-0.5, -0.47], [0.5, -0.47], [0.5, -0.17], [0.39, -0.05], [0.15, 0.02], [-0.03, 0.46], [-0.27, 0.5], [-0.43, 0.13], [-0.5, -0.08]),
        cabin: { x: -0.11, y: 0.49, length: spec.overallLength * 0.36, width: roadBase.bodyWidth * 0.84, height: 0.44, tilt: -0.05 },
        hasOpenWheels: false, hasCargoBed: false, hasTubeFrame: false, headlampStyle: 'blade',
      }
  }
}
