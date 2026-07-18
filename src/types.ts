import type { ReferenceResearchPack } from './lib/referenceCatalog'

export type VehicleClass =
  | 'road'
  | 'formula'
  | 'gt'
  | 'rally'
  | 'suv'
  | 'truck'
  | 'monster'
  | 'ev'

export type ViewMode = 'solid' | 'wireframe' | 'blueprint' | 'structural' | 'studio'

export type Scores = {
  realism: number
  aerodynamics: number
  manufacturability: number
  packaging: number
  stability: number
  originality: number
  consistency: number
}

export type VehicleSpec = {
  id: string
  name: string
  vehicleClass: VehicleClass
  wheelbase: number
  frontTrack: number
  rearTrack: number
  rideHeight: number
  overallLength: number
  overallWidth: number
  overallHeight: number
  wheelRadius: number
  tireWidth: number
  roofProfile: 'low-canopy' | 'fastback' | 'cab-forward' | 'open-cockpit' | 'high-cab'
  suspensionType: string
  engineLayout: string
  powertrain: 'ICE' | 'Hybrid' | 'EV' | 'Hydrogen'
  massKg: number
  frontWing: number
  rearWing: number
  diffuserDepth: number
  downforceBias: number
  coolingIntake: number
  groundClearance: number
  bodyColor: string
  accentColor: string
  referenceCue?: string
  assumptions: string[]
}

export type IterationLog = {
  iteration: number
  score: number
  scores: Scores
  issue: string
  revision: string
  agents: Array<{ name: string; state: 'done' | 'active' | 'queued' }>
}

export type DesignRevision = {
  id: string
  version: number
  branch: string
  createdAt: number
  prompt: string
  spec: VehicleSpec
  logs: IterationLog[]
  /** Compact, project-local reference research retained with the revision. */
  referenceResearch?: ReferenceResearchPack
  summary: string
}

export type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  createdAt: number
  compact?: boolean
}
