import type { VehicleClass, VehicleSpec } from '../types'
import { getDesignAssumptions, getFidelityPolicy, getRequiredComponents, getVehicleKnowledgePack } from './vehicleKnowledge'

type TerraResponse = { patch?: unknown; research?: string[]; confidence?: number }

const numericBounds: Partial<Record<keyof VehicleSpec, [number, number]>> = {
  wheelbase: [1.8, 6.5], frontTrack: [0.9, 4.2], rearTrack: [0.9, 4.2], rideHeight: [0.025, 1.4],
  overallLength: [2.5, 9], overallWidth: [1, 4.5], overallHeight: [0.55, 4.5], wheelRadius: [0.2, 1.3],
  tireWidth: [0.1, 1.2], massKg: [300, 12000], frontWing: [0, 1], rearWing: [0, 1],
  diffuserDepth: [0, 0.5], downforceBias: [0.35, 0.65], coolingIntake: [0.05, 0.8], groundClearance: [0.025, 1.4],
}

const validClasses = new Set<VehicleClass>(['road', 'formula', 'gt', 'rally', 'suv', 'truck', 'monster', 'ev'])
const validPowertrains = new Set<VehicleSpec['powertrain']>(['ICE', 'Hybrid', 'EV', 'Hydrogen'])
const validRoofs = new Set<VehicleSpec['roofProfile']>(['low-canopy', 'fastback', 'cab-forward', 'open-cockpit', 'high-cab'])

/**
 * A compact, deterministic class brief travels with the typed schema. It gives
 * a remote planner the same component constraints as the local renderer while
 * keeping the model boundary schema-only and free of raw mesh instructions.
 */
export function buildKnowledgeContext(current: VehicleSpec) {
  const pack = getVehicleKnowledgePack(current.vehicleClass)
  const requiredSystems = getRequiredComponents(current)
    .map((component) => `${component.label}: ${component.geometryIntent}`)
    .slice(0, 20)
    .join(' | ')
  const fidelity = getFidelityPolicy(current)
  const assumptions = getDesignAssumptions(current).slice(0, 5).join(' | ')
  return [
    `Class knowledge pack: ${pack.title}. ${pack.summary}`,
    `Required component graph: ${requiredSystems}.`,
    `Engineering quality gate: ${fidelity.minimumOverallScore}/100; required checks: ${fidelity.requiredChecks.join('; ')}.`,
    `Active assumptions: ${assumptions}.`,
  ].join(' ').slice(0, 2400)
}

/**
 * The browser never sees an API key. This adapter is disabled unless the deploy
 * environment explicitly sets VITE_TERRA_LIVE=true and exposes /api/design.
 */
export async function requestTerraPatch(prompt: string, current: VehicleSpec, imageDataUrl?: string): Promise<Partial<VehicleSpec> | null> {
  if (import.meta.env.VITE_TERRA_LIVE !== 'true') return null
  try {
    const response = await fetch('/api/design', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, current, imageDataUrl, knowledgeContext: buildKnowledgeContext(current) }),
    })
    if (!response.ok) return null
    const data = await response.json() as TerraResponse
    return sanitizePatch(data.patch)
  } catch {
    return null
  }
}

/** Only semantic vehicle fields cross the model boundary; mesh-shaped fields are discarded. */
function sanitizePatch(candidate: unknown): Partial<VehicleSpec> | null {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  const record = candidate as Record<string, unknown>
  const patch: Partial<VehicleSpec> = {}
  for (const [key, bounds] of Object.entries(numericBounds) as Array<[keyof VehicleSpec, [number, number]]>) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) patch[key] = Math.max(bounds[0], Math.min(bounds[1], value)) as never
  }
  for (const key of ['name', 'suspensionType', 'engineLayout', 'bodyColor', 'accentColor', 'referenceCue'] as const) {
    const value = record[key]
    if (typeof value === 'string' && value.length <= 160) patch[key] = value
  }
  if (typeof record.vehicleClass === 'string' && validClasses.has(record.vehicleClass as VehicleClass)) patch.vehicleClass = record.vehicleClass as VehicleClass
  if (typeof record.powertrain === 'string' && validPowertrains.has(record.powertrain as VehicleSpec['powertrain'])) patch.powertrain = record.powertrain as VehicleSpec['powertrain']
  if (typeof record.roofProfile === 'string' && validRoofs.has(record.roofProfile as VehicleSpec['roofProfile'])) patch.roofProfile = record.roofProfile as VehicleSpec['roofProfile']
  if (Array.isArray(record.assumptions)) patch.assumptions = record.assumptions.filter((item): item is string => typeof item === 'string' && item.length <= 160).slice(0, 6)
  return Object.keys(patch).length ? patch : null
}
