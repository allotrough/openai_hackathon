import type { VehicleSpec } from '../types'
import { getGeometryProfile } from './vehicleGeometry'
import { getRequiredComponents, getVehicleKnowledgePack } from './vehicleKnowledge'

export type StudioRenderResult = { imageDataUrl: string; prompt: string; model?: string; referenceLocked?: boolean }

export function buildComponentBrief(spec: VehicleSpec): string {
  const knowledgePack = getVehicleKnowledgePack(spec.vehicleClass)
  const components = getRequiredComponents(spec)
    .map((component) => `${component.label} [${component.detailTier}]`)
    .slice(0, 24)
    .join('; ')
  return `Class knowledge pack: ${knowledgePack.title}. Required separately readable systems: ${components}.`
}

export function buildAlignmentBrief(spec: VehicleSpec): string {
  const profile = getGeometryProfile(spec)
  const knowledgePack = getVehicleKnowledgePack(spec.vehicleClass)
  return [
    `Geometry recipe: ${profile.recipe}; ${spec.roofProfile} roof; ${spec.engineLayout} layout; ${knowledgePack.title} architecture.`,
    `${Math.round(spec.overallLength * 1000)} mm overall length, ${Math.round(spec.overallWidth * 1000)} mm overall width, ${Math.round(spec.overallHeight * 1000)} mm overall height.`,
    `${Math.round(spec.wheelbase * 1000)} mm wheelbase; ${Math.round(spec.frontTrack * 1000)} mm front track; ${Math.round(spec.rearTrack * 1000)} mm rear track.`,
    `${Math.round(spec.wheelRadius * 2000)} mm wheel diameter; ${Math.round(spec.tireWidth * 1000)} mm tire width; ${Math.round(spec.rideHeight * 1000)} mm ride height.`,
    `Cabin envelope: ${Math.round(profile.cabin.length * 1000)} mm long, ${Math.round(profile.cabin.height * 1000)} mm high, positioned ${Math.round(profile.cabin.x * 1000)} mm from body centre.`,
    buildComponentBrief(spec),
  ].join(' ')
}

export function buildStudioRenderPrompt(spec: VehicleSpec): string {
  const className = spec.vehicleClass === 'formula' ? 'open-wheel Formula-style racing car' : `${spec.vehicleClass} vehicle`
  return [
    'Photorealistic premium automotive press photograph, not a toy, not a scale model, not low-poly 3D, not a concept sketch.',
    'GEOMETRY LOCK: the attached engineering reference sheet is authoritative. Preserve its exact silhouette, wheel centers and diameter, wheelbase/track ratio, roof and cabin placement, body class, aero placement, and three-quarter camera side. Improve material realism and panel surfacing only; do not add, remove, or relocate visible geometry.',
    `An original ${className} called ${spec.name}, with realistic full-size automotive proportions.`,
    `Body: ${spec.bodyColor}; accents: ${spec.accentColor}; powertrain: ${spec.powertrain}; layout: ${spec.engineLayout}.`,
    spec.referenceCue ? `Reference DNA: ${spec.referenceCue}. Translate only its compatible visual cue; preserve the active vehicle's own proportions, mounting, packaging, and required systems.` : '',
    buildAlignmentBrief(spec),
    'Every required system must remain separately legible and mounted plausibly. Do not replace manufacturing details with smooth toy-like bodywork.',
    `${spec.suspensionType} suspension.`,
    `Aero: front wing ${Math.round(spec.frontWing * 100)}%, rear wing ${Math.round(spec.rearWing * 100)}%, ${Math.round(spec.diffuserDepth * 1000)} mm diffuser.`,
    'Three-quarter front exterior view at eye level, premium dark automotive photo studio, large softbox reflections, realistic paint, glass, rubber tires, panel gaps, brakes, road-scale wheels, subtle floor reflection, cinematic but believable.',
    'No text, no watermark, no visible logos, no copied production-car design, no people, no miniature diorama.',
  ].join(' ')
}

export async function requestStudioRender(spec: VehicleSpec, alignmentReference: string, refinementInstruction?: string): Promise<StudioRenderResult> {
  const response = await fetch('/api/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ spec, alignmentBrief: buildAlignmentBrief(spec), alignmentReference, refinementInstruction }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error || 'Photo render request failed')
  }
  return response.json() as Promise<StudioRenderResult>
}
