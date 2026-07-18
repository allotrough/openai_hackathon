import type { IterationLog, Scores, VehicleClass, VehicleSpec } from '../types'
import { getDesignAssumptions, getFidelityPolicy, getRequiredComponents, getVehicleKnowledgePack } from './vehicleKnowledge'

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)))

type ClassPack = Omit<VehicleSpec, 'id' | 'referenceCue' | 'assumptions'> & {
  assumptions: string[]
}

const packs: Record<VehicleClass, ClassPack> = {
  road: {
    vehicleClass: 'road', name: 'Aether Meridian', wheelbase: 2.78, frontTrack: 1.58, rearTrack: 1.59,
    rideHeight: 0.145, overallLength: 4.7, overallWidth: 1.84, overallHeight: 1.44, wheelRadius: 0.34,
    tireWidth: 0.225, roofProfile: 'cab-forward', suspensionType: 'comfort-tuned multi-link', engineLayout: 'front-transverse',
    powertrain: 'Hybrid', massKg: 1510, frontWing: 0.02, rearWing: 0.04, diffuserDepth: 0.06,
    downforceBias: 0.5, coolingIntake: 0.26, groundClearance: 0.145, bodyColor: '#e8e9ea', accentColor: '#f0a72e',
    assumptions: ['Everyday five-seat cabin and luggage volume', 'Road-legal lighting and crash envelope', 'Serviceable steel-aluminium unibody'],
  },
  formula: {
    vehicleClass: 'formula', name: 'Aether Vanta F1', wheelbase: 3.55, frontTrack: 1.72, rearTrack: 1.62,
    rideHeight: 0.045, overallLength: 5.2, overallWidth: 2, overallHeight: 0.98, wheelRadius: 0.37,
    tireWidth: 0.31, roofProfile: 'open-cockpit', suspensionType: 'pushrod double wishbone', engineLayout: 'mid-engine',
    powertrain: 'Hybrid', massKg: 798, frontWing: 0.78, rearWing: 0.82, diffuserDepth: 0.29,
    downforceBias: 0.47, coolingIntake: 0.42, groundClearance: 0.045, bodyColor: '#ececec', accentColor: '#e74a3b',
    assumptions: ['Open-wheel single-seater', 'Ground-effect floor', 'High-speed circuit use'],
  },
  gt: {
    vehicleClass: 'gt', name: 'Aether Aurora GT', wheelbase: 2.76, frontTrack: 1.65, rearTrack: 1.68,
    rideHeight: 0.105, overallLength: 4.54, overallWidth: 1.91, overallHeight: 1.21, wheelRadius: 0.35,
    tireWidth: 0.3, roofProfile: 'low-canopy', suspensionType: 'adaptive double wishbone', engineLayout: 'front-mid-engine',
    powertrain: 'ICE', massKg: 1320, frontWing: 0.26, rearWing: 0.44, diffuserDepth: 0.19,
    downforceBias: 0.48, coolingIntake: 0.36, groundClearance: 0.105, bodyColor: '#d2d5da', accentColor: '#e9b84b',
    assumptions: ['Two-seat grand touring package', 'Long-distance thermal capacity', 'Rear transaxle balance'],
  },
  rally: {
    vehicleClass: 'rally', name: 'Aether Kestrel RX', wheelbase: 2.62, frontTrack: 1.6, rearTrack: 1.6,
    rideHeight: 0.22, overallLength: 4.25, overallWidth: 1.84, overallHeight: 1.42, wheelRadius: 0.35,
    tireWidth: 0.24, roofProfile: 'fastback', suspensionType: 'long-travel MacPherson', engineLayout: 'front-transverse',
    powertrain: 'Hybrid', massKg: 1280, frontWing: 0.12, rearWing: 0.28, diffuserDepth: 0.07,
    downforceBias: 0.5, coolingIntake: 0.42, groundClearance: 0.22, bodyColor: '#f4f4f1', accentColor: '#f1872d',
    assumptions: ['Loose-surface durability', 'Four-wheel-drive torque vectoring', 'High suspension travel'],
  },
  suv: {
    vehicleClass: 'suv', name: 'Aether Atlas', wheelbase: 2.96, frontTrack: 1.7, rearTrack: 1.72,
    rideHeight: 0.2, overallLength: 4.86, overallWidth: 1.98, overallHeight: 1.68, wheelRadius: 0.39,
    tireWidth: 0.29, roofProfile: 'cab-forward', suspensionType: 'adaptive air suspension', engineLayout: 'front-longitudinal',
    powertrain: 'EV', massKg: 2380, frontWing: 0.02, rearWing: 0.1, diffuserDepth: 0.09,
    downforceBias: 0.5, coolingIntake: 0.25, groundClearance: 0.2, bodyColor: '#d9d9d2', accentColor: '#c4ff3e',
    assumptions: ['Five-seat utility package', 'Low-mounted battery pack', 'All-weather stability'],
  },
  truck: {
    vehicleClass: 'truck', name: 'Aether Forge', wheelbase: 3.4, frontTrack: 1.78, rearTrack: 1.76,
    rideHeight: 0.26, overallLength: 5.4, overallWidth: 2.03, overallHeight: 1.93, wheelRadius: 0.43,
    tireWidth: 0.34, roofProfile: 'high-cab', suspensionType: 'heavy-duty multi-link', engineLayout: 'front-longitudinal',
    powertrain: 'Hybrid', massKg: 2650, frontWing: 0.01, rearWing: 0.06, diffuserDepth: 0.04,
    downforceBias: 0.5, coolingIntake: 0.34, groundClearance: 0.26, bodyColor: '#c9c9c7', accentColor: '#ef9d35',
    assumptions: ['Crew cab and cargo bed', 'Towing-capable thermal package', 'High payload structure'],
  },
  monster: {
    vehicleClass: 'monster', name: 'Aether Titan', wheelbase: 3.25, frontTrack: 3.1, rearTrack: 3.1,
    rideHeight: 0.78, overallLength: 5.12, overallWidth: 3.15, overallHeight: 3.15, wheelRadius: 0.88,
    tireWidth: 0.78, roofProfile: 'high-cab', suspensionType: 'four-link nitrogen long-travel', engineLayout: 'front-longitudinal',
    powertrain: 'ICE', massKg: 5200, frontWing: 0, rearWing: 0.08, diffuserDepth: 0,
    downforceBias: 0.5, coolingIntake: 0.48, groundClearance: 0.78, bodyColor: '#d6d8dc', accentColor: '#ff542e',
    assumptions: ['Tube-frame chassis', 'Extreme suspension articulation', 'High center-of-gravity mitigation'],
  },
  ev: {
    vehicleClass: 'ev', name: 'Aether Flux', wheelbase: 3.02, frontTrack: 1.68, rearTrack: 1.7,
    rideHeight: 0.12, overallLength: 4.72, overallWidth: 1.96, overallHeight: 1.31, wheelRadius: 0.37,
    tireWidth: 0.29, roofProfile: 'low-canopy', suspensionType: 'adaptive multi-link', engineLayout: 'skateboard',
    powertrain: 'EV', massKg: 1960, frontWing: 0.1, rearWing: 0.2, diffuserDepth: 0.16,
    downforceBias: 0.5, coolingIntake: 0.22, groundClearance: 0.12, bodyColor: '#edf1ef', accentColor: '#76f6cf',
    assumptions: ['Structural battery pack', 'Dual-motor torque vectoring', 'Front cargo volume'],
  },
}

const unique = <T,>(items: T[]) => [...new Set(items)]

const uid = () => `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function createInitialSpec(): VehicleSpec {
  const { assumptions, ...base } = packs.ev
  const spec = { ...base, id: uid(), assumptions: [...assumptions] }
  return { ...spec, assumptions: [...getDesignAssumptions(spec)] }
}

export function detectVehicleClass(prompt: string, fallback: VehicleClass = 'ev'): VehicleClass {
  const text = prompt.toLowerCase()
  if (/(monster|crush|big tire)/.test(text)) return 'monster'
  if (/(formula|f1|open wheel|single seater)/.test(text)) return 'formula'
  if (/(rally|wrc|gravel|dirt)/.test(text)) return 'rally'
  if (/(pickup|pick-up|truck|ute)/.test(text)) return 'truck'
  if (/(suv|off-road|offroad|crossover)/.test(text)) return 'suv'
  if (/(gt3|grand tour|grand touring|gt car)/.test(text)) return 'gt'
  if (/(electric|\bev\b|battery|frunk)/.test(text)) return 'ev'
  if (/(supercar|sports? car|sportscar|roadster|coupe|sedan|hatchback|family car|regular car|commuter|car|vehicle)/.test(text)) return 'road'
  return fallback
}

function referenceCue(prompt: string): string | undefined {
  const text = prompt.toLowerCase()
  if (/(911|porsche)/.test(text)) return '911-inspired front luggage volume and round-lamp graphic'
  if (/(ferrari|sf90)/.test(text)) return 'Italian side-intake surfacing cue'
  if (/(cybertruck|tesla)/.test(text)) return 'faceted stainless monobody cue'
  if (/(defender|land rover)/.test(text)) return 'upright utility-glasshouse cue'
  if (/(g wagon|g-wagon|g class)/.test(text)) return 'squared fender and exposed-hinge cue'
  return undefined
}

function applyRoadPerformancePackage(spec: VehicleSpec) {
  spec.overallLength = 4.62
  spec.overallWidth = 1.94
  spec.overallHeight = 1.24
  spec.wheelbase = 2.76
  spec.frontTrack = 1.67
  spec.rearTrack = 1.7
  spec.rideHeight = 0.115
  spec.groundClearance = spec.rideHeight
  spec.wheelRadius = 0.36
  spec.tireWidth = 0.285
  spec.roofProfile = 'low-canopy'
  spec.suspensionType = 'adaptive double wishbone'
  spec.engineLayout = 'mid-engine'
  spec.powertrain = 'Hybrid'
  spec.massKg = 1460
  spec.frontWing = 0.14
  spec.rearWing = 0.26
  spec.diffuserDepth = 0.15
  spec.coolingIntake = 0.38
  spec.assumptions.push('Mid-engine performance package selected from explicit sports-car intent')
}

export function compileIntent(prompt: string, previous?: VehicleSpec): VehicleSpec {
  const vehicleClass = detectVehicleClass(prompt, previous?.vehicleClass ?? 'ev')
  const { assumptions: packAssumptions, ...pack } = packs[vehicleClass]
  const text = prompt.toLowerCase()
  const asksForNewPackage = !previous
    || vehicleClass !== previous.vehicleClass
    || /\b(?:create|design|generate|build|make|new)\b[\s\S]{0,90}\b(?:car|vehicle|sedan|coupe|roadster|truck|suv|concept|formula)\b/.test(text)
  const spec: VehicleSpec = {
    ...pack,
    id: uid(),
    // New-package wording deliberately starts from the target class pack. Keeping
    // the prior name/paint made a successful revision look like the old vehicle.
    name: asksForNewPackage ? pack.name : previous?.name ?? pack.name,
    bodyColor: asksForNewPackage ? pack.bodyColor : previous?.bodyColor ?? pack.bodyColor,
    accentColor: asksForNewPackage ? pack.accentColor : previous?.accentColor ?? pack.accentColor,
    assumptions: [...packAssumptions],
    referenceCue: referenceCue(prompt),
  }

  if (spec.vehicleClass === 'road' && /(supercar|sports? car|sportscar|roadster|coupe|mid-engine|track day)/.test(text)) {
    applyRoadPerformancePackage(spec)
  }

  if (/(electric|\bev\b|battery|frunk)/.test(text)) {
    spec.powertrain = 'EV'
    spec.engineLayout = 'skateboard battery / dual motor'
    spec.assumptions.push('Front cargo volume reserved around cooling and crash structure')
  }
  if (/(hydrogen|fuel cell)/.test(text)) {
    spec.powertrain = 'Hydrogen'
    spec.engineLayout = 'fuel-cell / rear e-axle'
    spec.massKg += 120
    spec.assumptions.push('Composite high-pressure tank volume included in packaging estimate')
  }
  if (/(aggressive|race|track|aero|wing)/.test(text)) {
    spec.frontWing = Math.min(0.9, spec.frontWing + 0.13)
    spec.rearWing = Math.min(0.9, spec.rearWing + 0.16)
    spec.diffuserDepth = Math.min(0.34, spec.diffuserDepth + 0.04)
    spec.assumptions.push('Track-focused cooling and drag balance')
  }
  if (/(low|lower|slam)/.test(text)) {
    spec.rideHeight = Math.max(spec.vehicleClass === 'formula' ? 0.035 : 0.075, spec.rideHeight - 0.04)
    spec.groundClearance = spec.rideHeight
  }
  if (/(lifted|lift|tall|clearance)/.test(text)) {
    spec.rideHeight += 0.08
    spec.groundClearance = spec.rideHeight
    spec.assumptions.push('Suspension kinematics recalibrated for added clearance')
  }
  if (/(wide|wider|widebody)/.test(text)) {
    spec.frontTrack += 0.1
    spec.rearTrack += 0.12
    spec.overallWidth += 0.12
  }
  if (/(short|compact)/.test(text)) {
    spec.wheelbase = Math.max(2.2, spec.wheelbase - 0.16)
    spec.overallLength = Math.max(3.5, spec.overallLength - 0.24)
  }
  if (/(long|stretched)/.test(text)) {
    spec.wheelbase += 0.18
    spec.overallLength += 0.24
  }
  if (/(regular|family|sedan|daily|commuter|practical|hatchback)/.test(text) && spec.vehicleClass === 'road') {
    spec.assumptions.push('Everyday five-seat cabin and luggage volume prioritized over downforce')
  }
  if (/(beautiful|sleek|elegant|premium|futuristic|cyber)/.test(text)) {
    spec.overallLength += 0.08
    spec.wheelbase += 0.05
    spec.overallHeight = Math.max(0.95, spec.overallHeight - 0.035)
    spec.assumptions.push('Proportions refined from the requested design language')
  }
  if (/(futuristic|cyber)/.test(text)) {
    spec.bodyColor = '#9faebe'
    spec.accentColor = '#75f1d2'
  }
  if (/(retro|classic|heritage)/.test(text)) {
    spec.bodyColor = '#24445a'
    spec.accentColor = '#d8b06d'
    spec.assumptions.push('Heritage surfacing cues translated without copying a production design')
  }
  if (/(muscle|brutal)/.test(text) && spec.vehicleClass === 'road') {
    spec.frontTrack += 0.12
    spec.rearTrack += 0.15
    spec.overallWidth += 0.14
    spec.wheelRadius += 0.025
    spec.assumptions.push('Wide-track stance inferred from muscle-car design language')
  }
  if (/(blue|azure)/.test(text)) spec.bodyColor = '#2e71f3'
  if (/(red|crimson)/.test(text)) spec.bodyColor = '#dd4034'
  if (/(black|stealth)/.test(text)) spec.bodyColor = '#1d232c'
  if (/(orange)/.test(text)) spec.accentColor = '#f3812d'
  if (/(lime|green)/.test(text)) spec.accentColor = '#b4ff38'
  if (spec.referenceCue) {
    spec.assumptions.push('Reference is translated into compatible design cues, scale, and mounting logic')
  }
  spec.assumptions = unique([...getDesignAssumptions(spec)])
  return spec
}

export function scoreSpec(spec: VehicleSpec): Scores {
  const classAero = ['formula', 'gt', 'road', 'ev'].includes(spec.vehicleClass)
  const aero = classAero
    ? clamp(54 + spec.frontWing * 19 + spec.rearWing * 20 + spec.diffuserDepth * 48 + spec.coolingIntake * 7 - spec.rideHeight * 18)
    : clamp(59 + spec.rearWing * 15 + spec.diffuserDepth * 26 - Math.max(0, spec.rideHeight - 0.24) * 20)
  const packaging = clamp(66 + Math.min(13, spec.wheelbase * 3) + (spec.powertrain === 'EV' ? 3 : 0) - (spec.vehicleClass === 'monster' ? 2 : 0))
  const stabilityRatio = ((spec.frontTrack + spec.rearTrack) / 2) / Math.max(spec.rideHeight * 4.1, 0.42)
  const stability = clamp(48 + stabilityRatio * 10 - Math.max(0, spec.wheelRadius - spec.rideHeight) * 5)
  const manufacturingPenalty = spec.frontWing * 7 + spec.rearWing * 8 + spec.diffuserDepth * 20 + (spec.vehicleClass === 'formula' ? 4 : 0)
  const manufacturability = clamp(89 - manufacturingPenalty + (spec.vehicleClass === 'monster' ? 3 : 0))
  const realism = clamp(72 + (spec.suspensionType.length > 12 ? 4 : 0) + (spec.engineLayout.length > 8 ? 3 : 0) - (spec.rideHeight < 0.06 && spec.vehicleClass !== 'formula' ? 10 : 0))
  const originality = clamp(68 + (spec.referenceCue ? 6 : 0) + (spec.powertrain === 'Hydrogen' ? 7 : 0) + (spec.vehicleClass === 'monster' ? 5 : 0))
  const consistency = clamp(84 - Math.abs(spec.downforceBias - 0.5) * 38 - (spec.powertrain === 'EV' && spec.engineLayout === 'mid-engine' ? 8 : 0))
  return { realism, aerodynamics: aero, manufacturability, packaging, stability, originality, consistency }
}

export function weightedScore(scores: Scores, vehicleClass: VehicleClass): number {
  const weights = vehicleClass === 'monster'
    ? [0.15, 0.04, 0.15, 0.16, 0.28, 0.1, 0.12]
    : vehicleClass === 'formula'
      ? [0.14, 0.28, 0.09, 0.14, 0.17, 0.06, 0.12]
      : [0.16, 0.17, 0.13, 0.18, 0.17, 0.08, 0.11]
  return Math.round(Object.values(scores).reduce((sum, score, index) => sum + score * weights[index], 0))
}

function reviseForLowestScore(spec: VehicleSpec, scores: Scores): { next: VehicleSpec; issue: string; revision: string } {
  const [lowest] = Object.entries(scores).sort(([, a], [, b]) => a - b)[0]
  const next = { ...spec, assumptions: [...spec.assumptions] }
  if (lowest === 'aerodynamics') {
    next.rearWing = Math.min(0.92, next.rearWing + 0.08)
    next.diffuserDepth = Math.min(0.34, next.diffuserDepth + 0.025)
    next.downforceBias = Number(((next.downforceBias + 0.49) / 2).toFixed(2))
    return { next, issue: 'rear lift margin', revision: 'Rear wing angle and diffuser throat deepened' }
  }
  if (lowest === 'stability') {
    next.frontTrack += 0.06
    next.rearTrack += 0.07
    next.rideHeight = Math.max(next.vehicleClass === 'monster' ? 0.65 : 0.055, next.rideHeight - 0.025)
    next.groundClearance = next.rideHeight
    return { next, issue: 'lateral rollover / transient response', revision: 'Track widened and center of mass lowered' }
  }
  if (lowest === 'manufacturability') {
    next.frontWing = Math.max(0, next.frontWing - 0.04)
    next.rearWing = Math.max(0.06, next.rearWing - 0.05)
    return { next, issue: 'aero assembly complexity', revision: 'Simplified multi-element wing geometry' }
  }
  if (lowest === 'consistency') {
    next.downforceBias = 0.5
    return { next, issue: 'front-to-rear aero balance', revision: 'Balanced center-of-pressure target' }
  }
  if (lowest === 'packaging') {
    next.wheelbase += 0.08
    next.overallLength += 0.1
    return { next, issue: 'component service envelope', revision: 'Extended wheelbase for thermal and service clearance' }
  }
  return { next, issue: 'physical plausibility', revision: 'Strengthened component assumptions and proportions' }
}

export function runAgenticLoop(initial: VehicleSpec, maxIterations = 4, threshold = 76) {
  let spec = initial
  const logs: IterationLog[] = []
  const fidelityPolicy = getFidelityPolicy(initial)
  const iterationLimit = Math.max(maxIterations, fidelityPolicy.maximumRevisionIterations)
  const targetScore = Math.max(threshold, fidelityPolicy.minimumOverallScore)
  for (let iteration = 1; iteration <= iterationLimit; iteration += 1) {
    const scores = scoreSpec(spec)
    const score = weightedScore(scores, spec.vehicleClass)
    const pass = score >= targetScore && Object.values(scores).every((value) => value >= 62)
    const revision = pass
      ? { next: spec, issue: 'no critical conflict', revision: 'Design passes current concept gate' }
      : reviseForLowestScore(spec, scores)
    logs.push({
      iteration,
      score,
      scores,
      issue: revision.issue,
      revision: revision.revision,
      agents: [
        { name: 'Intent', state: 'done' },
        { name: 'Research', state: initial.referenceCue ? 'done' : 'queued' },
        { name: 'Vehicle Eng.', state: 'done' },
        { name: 'Geometry', state: 'done' },
        { name: 'Critic', state: 'done' },
        { name: 'Renderer', state: 'done' },
      ],
    })
    if (pass) break
    spec = { ...revision.next, assumptions: [...getDesignAssumptions(revision.next)] }
  }
  const final = logs.at(-1)!
  return { spec, logs, score: final.score, pass: final.score >= targetScore }
}

export function buildDesignSummary(spec: VehicleSpec, score: number): string {
  const knowledgePack = getVehicleKnowledgePack(spec.vehicleClass)
  const requiredSystems = getRequiredComponents(spec).length
  const qualityGate = getFidelityPolicy(spec).minimumOverallScore
  const changes = `${spec.vehicleClass.toUpperCase()} package with ${spec.powertrain} powertrain, ${spec.suspensionType}, and ${Math.round(spec.wheelbase * 1000)} mm wheelbase.`
  const rationale = `${knowledgePack.title} resolves ${requiredSystems} required systems from a typed component graph; aero balance targets ${(spec.downforceBias * 100).toFixed(0)}% front load.`
  const tradeoffs = spec.vehicleClass === 'monster'
    ? 'Extreme clearance increases rollover demand, so the track and suspension geometry carry priority.'
    : 'Additional aero authority trades top-speed efficiency and fabrication complexity for stability.'
  const impact = `Concept gate: ${score}/100 (class target ${qualityGate}). Expected impact: ${score >= qualityGate ? 'balanced high-speed confidence' : 'a viable baseline with a focused revision queue'}.`
  return `${changes} ${rationale} ${tradeoffs} ${impact}`
}

export const scoreLabels: Array<keyof Scores> = [
  'realism', 'aerodynamics', 'manufacturability', 'packaging', 'stability', 'originality', 'consistency',
]
