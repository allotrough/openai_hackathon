import type { VehicleClass, VehicleSpec } from '../types'

/**
 * Project-local reference research. This module deliberately stores compact,
 * structured observations instead of images, raw webpages, model output, or
 * secrets. A reference may inspire a component, but it is never a direct-copy
 * instruction for the procedural geometry engine.
 */

export type ReferenceComponent =
  | 'side-mirror'
  | 'frunk'
  | 'front-fascia'
  | 'headlamp'
  | 'tail-lamp'
  | 'greenhouse'
  | 'side-intake'
  | 'wheel-arch'
  | 'fender'
  | 'door'
  | 'roofline'
  | 'cargo-bed'
  | 'rear-wing'
  | 'diffuser'
  | 'front-wing'
  | 'suspension'
  | 'steering'
  | 'chassis'
  | 'wheel'
  | 'brake-system'
  | 'body-language'

export type ReferenceView = 'front' | 'side' | 'rear' | 'top' | 'three-quarter'

export type ReferenceProvenance = {
  kind: 'prompt-seed' | 'reference-cue'
  label: string
  sourceUrl?: string
  license?: string
}

export type ReferenceAsset = {
  id: string
  title: string
  sourceVehicle: string
  sourceClass: VehicleClass
  component: ReferenceComponent
  views: readonly ReferenceView[]
  visualTraits: readonly string[]
  landmarkRatios: Readonly<Record<string, number>>
  adaptationConstraints: readonly string[]
  transferable: boolean
  confidence: number
  provenance: ReferenceProvenance
}

export type CompatibilityStatus = 'compatible' | 'adapt-with-changes' | 'incompatible'

export type CompatibilityAssessment = {
  status: CompatibilityStatus
  score: number
  reasons: readonly string[]
  requiredAdaptations: readonly string[]
  blockers: readonly string[]
}

export type ReferenceDNA = {
  id: string
  sourceAssetId: string
  sourceVehicle: string
  component: ReferenceComponent
  transferableTraits: readonly string[]
  protectedTraits: readonly string[]
  nonTransferableTraits: readonly string[]
  landmarkRatios: Readonly<Record<string, number>>
  targetClass: VehicleClass
  assessment: CompatibilityAssessment
}

export type ResearchPackStatus = 'candidate' | 'partial' | 'rejected' | 'approved'

export type CompactResearchLog = {
  stage: 'seed' | 'assess' | 'guard'
  message: string
}

export type ReferenceResearchPack = {
  id: string
  query: string
  targetClass: VehicleClass
  createdAt: number
  status: ResearchPackStatus
  assets: readonly ReferenceAsset[]
  dna: readonly ReferenceDNA[]
  logs: readonly CompactResearchLog[]
}

export type SeedReferenceInput = {
  prompt: string
  referenceCue?: string
  /** Explicit schema class wins over a phrase inferred from the prompt. */
  targetClass?: VehicleClass
  targetSpec?: Pick<VehicleSpec, 'vehicleClass' | 'powertrain' | 'engineLayout' | 'overallWidth' | 'overallHeight'>
  /** Injectable for deterministic tests and reproducible project imports. */
  now?: number
}

type SourceTemplate = {
  signals: readonly string[]
  sourceVehicle: string
  sourceClass: VehicleClass
  sharedTraits: readonly string[]
  componentTraits: Partial<Record<ReferenceComponent, readonly string[]>>
}

const sourceTemplates: readonly SourceTemplate[] = [
  {
    signals: ['tesla cybertruck', 'cybertruck'],
    sourceVehicle: 'Tesla Cybertruck',
    sourceClass: 'truck',
    sharedTraits: ['faceted planar surfacing', 'minimal dark trim', 'angular technical character'],
    componentTraits: {
      'side-mirror': ['low-profile angular mirror housing', 'triangular sail mounting', 'thin black perimeter'],
      frunk: ['flat forebody volume', 'shallow front cargo lid', 'clean shut-line graphic'],
      greenhouse: ['straight beltline', 'tapered dark glass band', 'strong A-pillar angle'],
      'body-language': ['faceted planar surfacing', 'geometric panel breaks', 'minimal trim'],
    },
  },
  {
    signals: ['porsche 911', '911', 'porsche'],
    sourceVehicle: 'Porsche 911',
    sourceClass: 'gt',
    sharedTraits: ['compact rear-biased silhouette', 'clean rounded volumes', 'precise shut-line discipline'],
    componentTraits: {
      frunk: ['low front luggage volume', 'short hood shut line', 'compact front service envelope'],
      headlamp: ['round lamp graphic', 'flush lamp integration'],
      roofline: ['continuous fast roof arc', 'tapered rear glass'],
      'body-language': ['clean rounded volumes', 'compact rear-biased silhouette'],
    },
  },
  {
    signals: ['ferrari sf90', 'sf90', 'ferrari'],
    sourceVehicle: 'Ferrari SF90',
    sourceClass: 'gt',
    sharedTraits: ['cab-forward supercar proportion', 'deep negative space', 'layered performance surfacing'],
    componentTraits: {
      'side-intake': ['high shoulder intake', 'deep sculpted inlet throat', 'radiator-directed negative space'],
      'front-fascia': ['low technical intake band', 'layered splitter graphic'],
      'body-language': ['cab-forward supercar proportion', 'layered performance surfacing'],
    },
  },
  {
    signals: ['land rover defender', 'defender'],
    sourceVehicle: 'Land Rover Defender',
    sourceClass: 'suv',
    sharedTraits: ['upright utility proportion', 'strong glasshouse', 'durable modular surfaces'],
    componentTraits: {
      greenhouse: ['upright windshield', 'tall side glass', 'square rear-quarter window'],
      'wheel-arch': ['squared protective arch', 'clear tire clearance'],
      'body-language': ['upright utility proportion', 'durable modular surfaces'],
    },
  },
  {
    signals: ['g wagon', 'g-wagon', 'g class', 'g-class'],
    sourceVehicle: 'Mercedes-Benz G-Class',
    sourceClass: 'suv',
    sharedTraits: ['boxy upright cabin', 'exposed utility hardware', 'flat fender planes'],
    componentTraits: {
      fender: ['squared fender profile', 'separate protective flare'],
      door: ['upright door cut line', 'utility hardware expression'],
      greenhouse: ['flat side glass', 'upright pillars'],
      'body-language': ['boxy upright cabin', 'flat fender planes'],
    },
  },
  {
    signals: ['formula 1', 'f1', 'formula car', 'open wheel'],
    sourceVehicle: 'Formula-style single-seater',
    sourceClass: 'formula',
    sharedTraits: ['narrow centreline chassis', 'exposed wheels', 'separate aerodynamic assemblies'],
    componentTraits: {
      'front-wing': ['layered low wing planes', 'wheel-wake endplates', 'narrow nose support'],
      'rear-wing': ['separate multi-plane rear aero assembly', 'slender central supports'],
      diffuser: ['underbody exit channels', 'vertical diffuser strakes'],
      suspension: ['exposed wishbone links', 'wheel-independent suspension envelope'],
      'body-language': ['narrow centreline chassis', 'separate aerodynamic assemblies'],
    },
  },
]

const componentMatchers: readonly { component: ReferenceComponent; test: RegExp }[] = [
  { component: 'side-mirror', test: /\b(?:side[ -]?(?:view )?)?mirrors?\b/ },
  { component: 'frunk', test: /\b(?:frunk|fronk|front trunk|front luggage|front cargo)\b/ },
  { component: 'front-fascia', test: /\b(?:front fascia|front end|front bumper|grille)\b/ },
  { component: 'headlamp', test: /\b(?:headlamps?|headlights?|lamp graphic)\b/ },
  { component: 'tail-lamp', test: /\b(?:tail ?lamps?|tail ?lights?|rear light)\b/ },
  { component: 'greenhouse', test: /\b(?:greenhouse|glasshouse|side glass|window line)\b/ },
  { component: 'side-intake', test: /\b(?:side intakes?|side vents?|intake surfacing)\b/ },
  { component: 'wheel-arch', test: /\b(?:wheel arches?|wheel arch)\b/ },
  { component: 'fender', test: /\b(?:fenders?|fender flare|flares?)\b/ },
  { component: 'door', test: /\b(?:doors?|door handles?)\b/ },
  { component: 'roofline', test: /\b(?:roof ?line|roof profile|roof arc)\b/ },
  { component: 'cargo-bed', test: /\b(?:cargo bed|truck bed|pickup bed)\b/ },
  { component: 'rear-wing', test: /\b(?:rear wing|spoiler|beam wing)\b/ },
  { component: 'front-wing', test: /\b(?:front wing|front aero)\b/ },
  { component: 'diffuser', test: /\b(?:diffuser|underfloor)\b/ },
  { component: 'suspension', test: /\b(?:suspension|wishbones?|dampers?)\b/ },
  { component: 'steering', test: /\b(?:steering|rack)\b/ },
  { component: 'chassis', test: /\b(?:chassis|frame|monocoque)\b/ },
  { component: 'wheel', test: /\b(?:wheels?|rims?|tires?|tyres?)\b/ },
  { component: 'brake-system', test: /\b(?:brakes?|brake ducts?|calipers?)\b/ },
]

const structuralComponents: readonly ReferenceComponent[] = ['suspension', 'steering', 'chassis', 'brake-system']
const copyProtectedTraits = ['brand badges, wordmarks, sponsor graphics, and exact production panel geometry']

function compactText(value: string, max = 220) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > max ? `${normalized.slice(0, Math.max(0, max - 1))}…` : normalized
}

function stableId(prefix: string, value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`
}

function inferTargetClass(prompt: string): VehicleClass {
  const text = prompt.toLowerCase()
  if (/(monster|crush|big tire)/.test(text)) return 'monster'
  if (/(formula|f1|open wheel|single seater)/.test(text)) return 'formula'
  if (/(rally|wrc|gravel|dirt)/.test(text)) return 'rally'
  if (/(pickup|pick-up|\btruck\b|\bute\b)/.test(text) && !/cybertruck/.test(text)) return 'truck'
  if (/(suv|off-road|offroad|crossover)/.test(text)) return 'suv'
  if (/(gt3|grand tour|grand touring|gt car)/.test(text)) return 'gt'
  if (/(electric|\bev\b|battery|frunk)/.test(text)) return 'ev'
  return 'road'
}

function findTemplate(text: string) {
  return sourceTemplates.find((template) => template.signals.some((signal) => text.includes(signal)))
}

function componentsIn(text: string): ReferenceComponent[] {
  const matched = componentMatchers.filter(({ test }) => test.test(text)).map(({ component }) => component)
  return [...new Set(matched)]
}

function defaultComponent(template: SourceTemplate | undefined): ReferenceComponent {
  if (template?.componentTraits['body-language']) return 'body-language'
  return 'body-language'
}

function defaultViews(component: ReferenceComponent): readonly ReferenceView[] {
  switch (component) {
    case 'side-mirror': return ['side', 'three-quarter']
    case 'frunk': return ['front', 'top', 'three-quarter']
    case 'front-fascia':
    case 'headlamp':
    case 'front-wing': return ['front', 'three-quarter']
    case 'tail-lamp':
    case 'rear-wing':
    case 'diffuser': return ['rear', 'three-quarter']
    case 'greenhouse':
    case 'roofline': return ['side', 'three-quarter']
    default: return ['front', 'side', 'three-quarter']
  }
}

function genericTraits(component: ReferenceComponent): readonly string[] {
  const traits: Record<ReferenceComponent, readonly string[]> = {
    'side-mirror': ['clean housing volume', 'integrated mount', 'clear rearward sight line'],
    frunk: ['front storage envelope', 'crash-structure-aware lid', 'serviceable opening'],
    'front-fascia': ['coherent front graphic', 'cooling-aware openings', 'bumper-to-lamp relationship'],
    headlamp: ['legible lamp signature', 'flush outer lens', 'serviceable lamp volume'],
    'tail-lamp': ['legible rear lamp signature', 'clear rear width graphic'],
    greenhouse: ['proportional glass-to-body ratio', 'plausible pillar thickness'],
    'side-intake': ['cooling-driven inlet', 'clean surrounding surface transition'],
    'wheel-arch': ['tire clearance envelope', 'consistent arch radius'],
    fender: ['wheel coverage', 'manufacturable panel break'],
    door: ['occupant access envelope', 'plausible shut line'],
    roofline: ['coherent roof arc', 'rear headroom envelope'],
    'cargo-bed': ['payload volume', 'cab-to-bed separation'],
    'rear-wing': ['mounted aero assembly', 'clear rear visibility envelope'],
    diffuser: ['underbody exit volume', 'ground-clearance-aware strakes'],
    'front-wing': ['mounted aero assembly', 'wheel-clearance-aware span'],
    suspension: ['load-path-aware link placement', 'wheel travel clearance'],
    steering: ['wheel-to-rack geometry', 'clear service path'],
    chassis: ['primary load path', 'occupant or equipment safety cell'],
    wheel: ['tire envelope', 'brake and steering clearance'],
    'brake-system': ['thermal path', 'wheel package clearance'],
    'body-language': ['coherent proportion language', 'distinct but non-literal surfacing cues'],
  }
  return traits[component]
}

function makeAsset(template: SourceTemplate | undefined, component: ReferenceComponent, kind: ReferenceProvenance['kind']): ReferenceAsset {
  const sourceVehicle = template?.sourceVehicle ?? 'User-provided design cue'
  const sourceClass = template?.sourceClass ?? 'road'
  const traits = template?.componentTraits[component] ?? template?.sharedTraits ?? genericTraits(component)
  const allTraits = [...new Set([...traits, ...genericTraits(component)])].slice(0, 6)
  const title = `${sourceVehicle} ${component.replaceAll('-', ' ')}`
  return {
    id: stableId('asset', `${sourceVehicle}:${component}`),
    title,
    sourceVehicle,
    sourceClass,
    component,
    views: defaultViews(component),
    visualTraits: allTraits,
    landmarkRatios: component === 'side-mirror'
      ? { 'housing-to-door-height': 0.16, 'mount-to-a-pillar-offset': 0.08 }
      : component === 'frunk'
        ? { 'lid-length-to-wheelbase': 0.2, 'opening-width-to-front-track': 0.58 }
        : {},
    adaptationConstraints: [
      'Scale to the target mounting envelope instead of copying source dimensions.',
      'Preserve functional clearance, service access, and adjacent-panel relationships.',
      'Translate visual language; do not reproduce badges, marks, or exact production panel geometry.',
    ],
    transferable: !structuralComponents.includes(component),
    confidence: template ? 0.78 : 0.46,
    provenance: { kind, label: sourceVehicle },
  }
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function hasClass(list: readonly VehicleClass[], target: VehicleClass) {
  return list.includes(target)
}

/**
 * Evaluates whether an inspiration can be translated to a target package.
 * It returns blockers rather than silently producing a cosmetically pasted-on
 * part. Structural hardware only crosses class boundaries when a dedicated
 * engineering recipe has been authored for it.
 */
export function assessReferenceCompatibility(
  asset: ReferenceAsset,
  targetClass: VehicleClass,
  targetSpec?: SeedReferenceInput['targetSpec'],
): CompatibilityAssessment {
  const reasons: string[] = []
  const requiredAdaptations: string[] = []
  const blockers: string[] = []
  let score = 84

  if (!asset.transferable || structuralComponents.includes(asset.component)) {
    if (asset.sourceClass !== targetClass) {
      blockers.push(`${asset.component.replaceAll('-', ' ')} is structural or safety-critical and cannot be transplanted from ${asset.sourceClass} to ${targetClass} without a dedicated engineering recipe.`)
    } else {
      requiredAdaptations.push('Revalidate loads, travel, packaging, and service access against the active schema.')
      score -= 12
    }
  }

  if (asset.component === 'side-mirror') {
    if (targetClass === 'formula') {
      requiredAdaptations.push('Replace door/sail mounting with a vibration-controlled pod mount outside the cockpit and wheel wake.')
      score -= 15
    } else if (targetClass === 'monster') {
      requiredAdaptations.push('Use a protected, breakaway mount and verify tire, roll-cage, and suspension-travel clearance.')
      score -= 12
    } else {
      requiredAdaptations.push('Rescale the housing and mount to the target A-pillar or door beltline; preserve rearward sight lines.')
      score -= asset.sourceClass === targetClass ? 0 : 8
    }
  }

  if (asset.component === 'frunk') {
    if (targetClass === 'formula' || targetClass === 'monster' || targetClass === 'rally') {
      blockers.push(`A front cargo volume conflicts with the ${targetClass} package's front crash, suspension, clearance, or service envelope.`)
    } else if (targetSpec?.powertrain && targetSpec.powertrain !== 'EV') {
      requiredAdaptations.push('Repackage cooling, fuel, and front crash structure before reserving front cargo volume.')
      score -= 19
    } else {
      requiredAdaptations.push('Reserve front crash, cooling, latch, and weather-sealing volume before sizing the cargo opening.')
      score -= asset.sourceClass === targetClass ? 0 : 7
    }
  }

  if (asset.component === 'cargo-bed' && !hasClass(['truck', 'monster'], targetClass)) {
    blockers.push('A cargo bed changes the primary body architecture and is not a safe component-level transplant into this target class.')
  }

  if (asset.component === 'greenhouse' || asset.component === 'door' || asset.component === 'roofline') {
    if (targetClass === 'formula') blockers.push(`${asset.component.replaceAll('-', ' ')} is incompatible with an open-cockpit Formula safety cell.`)
    if (targetClass === 'monster' && asset.component === 'greenhouse') {
      requiredAdaptations.push('Translate only the glass proportion; retain tube-frame visibility and roll-cage clearance.')
      score -= 16
    }
  }

  if (asset.component === 'front-fascia' || asset.component === 'headlamp' || asset.component === 'tail-lamp') {
    if (targetClass === 'formula') blockers.push(`${asset.component.replaceAll('-', ' ')} cannot replace Formula aero or safety lighting architecture.`)
    if (targetClass === 'monster') {
      requiredAdaptations.push('Use impact-protected housings and preserve approach angle, tire clearance, and tube-frame mounting.')
      score -= 14
    }
  }

  if (asset.component === 'front-wing' || asset.component === 'rear-wing' || asset.component === 'diffuser') {
    if (targetClass === 'monster' && asset.component !== 'rear-wing') {
      blockers.push(`${asset.component.replaceAll('-', ' ')} conflicts with the target's impact, ground-clearance, and articulation envelope.`)
    } else if (!hasClass(['formula', 'gt', 'rally'], targetClass)) {
      requiredAdaptations.push('Retune span, ground clearance, cooling flow, and drag target for the target package.')
      score -= 16
    }
  }

  if (asset.component === 'wheel' && asset.sourceClass !== targetClass) {
    requiredAdaptations.push('Recalculate wheel diameter, offset, tire envelope, brake clearance, and suspension travel from the target schema.')
    score -= 14
  }

  if (asset.component === 'body-language') {
    requiredAdaptations.push('Apply only proportion and surface-language cues; generate original panel boundaries and feature geometry.')
    score -= asset.sourceClass === targetClass ? 0 : 6
  }

  if (asset.sourceClass === 'formula' && targetClass !== 'formula' && !['front-wing', 'rear-wing', 'diffuser', 'body-language'].includes(asset.component)) {
    blockers.push('Formula component placement depends on open-wheel aero, suspension, and safety architecture absent from this target class.')
  }

  if (blockers.length > 0) {
    return {
      status: 'incompatible',
      score: clampScore(Math.min(score, 24)),
      reasons: [
        'Reference retained for research only; it must not be applied to the procedural design.',
        ...blockers,
      ],
      requiredAdaptations: [],
      blockers,
    }
  }

  reasons.push(asset.sourceClass === targetClass
    ? `The source and target share a ${targetClass} package, but the part still requires target-specific dimensions.`
    : `The ${asset.component.replaceAll('-', ' ')} can transfer as visual DNA only; source dimensions and mounting are not reused.`)
  const status: CompatibilityStatus = score >= 85 ? 'compatible' : 'adapt-with-changes'
  return {
    status,
    score: clampScore(score),
    reasons,
    requiredAdaptations: [...new Set(requiredAdaptations)],
    blockers: [],
  }
}

export function createReferenceDNA(
  asset: ReferenceAsset,
  targetClass: VehicleClass,
  targetSpec?: SeedReferenceInput['targetSpec'],
): ReferenceDNA {
  return {
    id: stableId('dna', `${asset.id}:${targetClass}`),
    sourceAssetId: asset.id,
    sourceVehicle: asset.sourceVehicle,
    component: asset.component,
    transferableTraits: asset.visualTraits,
    protectedTraits: asset.adaptationConstraints,
    nonTransferableTraits: copyProtectedTraits,
    landmarkRatios: asset.landmarkRatios,
    targetClass,
    assessment: assessReferenceCompatibility(asset, targetClass, targetSpec),
  }
}

function buildCompactLogs(assets: readonly ReferenceAsset[], dna: readonly ReferenceDNA[], targetClass: VehicleClass): CompactResearchLog[] {
  const compatible = dna.filter(({ assessment }) => assessment.status === 'compatible').length
  const adaptable = dna.filter(({ assessment }) => assessment.status === 'adapt-with-changes').length
  const incompatible = dna.filter(({ assessment }) => assessment.status === 'incompatible')
  const logs: CompactResearchLog[] = [
    { stage: 'seed', message: `Seeded ${assets.length} component cue${assets.length === 1 ? '' : 's'} for ${targetClass}.` },
    { stage: 'assess', message: `${compatible} direct, ${adaptable} adapted, ${incompatible.length} blocked.` },
  ]
  if (incompatible[0]) {
    logs.push({ stage: 'guard', message: compactText(incompatible[0].assessment.blockers[0] ?? 'Unsafe transplant blocked.', 150) })
  }
  return logs.slice(0, 3)
}

/**
 * Extracts a compact, local research candidate from a prompt or existing
 * reference cue. It never performs web calls or treats a generated image as
 * evidence. Unknown names remain an explicitly low-confidence design cue.
 */
export function seedReferenceResearch(input: SeedReferenceInput): ReferenceResearchPack {
  const query = compactText(input.prompt || input.referenceCue || 'Untitled reference cue', 480)
  const text = `${input.prompt} ${input.referenceCue ?? ''}`.toLowerCase()
  const targetClass = input.targetSpec?.vehicleClass ?? input.targetClass ?? inferTargetClass(input.prompt)
  const template = findTemplate(text)
  const requestedComponents = componentsIn(text)
  const components = requestedComponents.length > 0 ? requestedComponents : [defaultComponent(template)]
  const provenanceKind: ReferenceProvenance['kind'] = template ? 'prompt-seed' : 'reference-cue'
  const assets = components.map((component) => makeAsset(template, component, provenanceKind))
  const dna = assets.map((asset) => createReferenceDNA(asset, targetClass, input.targetSpec))
  const blocked = dna.filter(({ assessment }) => assessment.status === 'incompatible').length
  const status: ResearchPackStatus = blocked === dna.length
    ? 'rejected'
    : blocked > 0
      ? 'partial'
      : 'candidate'

  return {
    id: stableId('research', `${query}:${targetClass}`),
    query,
    targetClass,
    createdAt: input.now ?? Date.now(),
    status,
    assets,
    dna,
    logs: buildCompactLogs(assets, dna, targetClass),
  }
}

/** Alias that reads naturally at the call-site when planning a design turn. */
export const planReferenceAdaptation = seedReferenceResearch

export function applicableReferenceDNA(pack: ReferenceResearchPack) {
  return pack.dna.filter(({ assessment }) => assessment.status !== 'incompatible')
}

export function formatReferenceResearchSummary(pack: ReferenceResearchPack) {
  const usable = applicableReferenceDNA(pack)
  const blocked = pack.dna.length - usable.length
  const components = usable.map(({ component }) => component.replaceAll('-', ' ')).join(', ') || 'none'
  return compactText(`${pack.status.toUpperCase()}: ${components}; ${blocked} blocked reference cue${blocked === 1 ? '' : 's'}.`, 180)
}

const CACHE_VERSION = 1
const MAX_PACKS = 40
const MAX_CACHE_BYTES = 320_000
const memoryStorage = new Map<string, string>()

export type ReferenceCatalogCacheOptions = {
  projectId?: string
  key?: string
  /** Injected storage makes this independently testable and safe in embedded apps. */
  storage?: Storage | null
}

function cacheKey(options: ReferenceCatalogCacheOptions) {
  if (options.key) return options.key
  const project = (options.projectId ?? 'default').replace(/[^a-z0-9_-]/gi, '-').slice(0, 64) || 'default'
  return `aether.reference-catalog.v${CACHE_VERSION}.${project}`
}

function browserStorage(storage: Storage | null | undefined) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function parsePacks(raw: string | null): ReferenceResearchPack[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; packs?: unknown }
    if (parsed.version !== CACHE_VERSION || !Array.isArray(parsed.packs)) return []
    return parsed.packs.filter((pack): pack is ReferenceResearchPack => {
      return Boolean(pack)
        && typeof pack === 'object'
        && typeof (pack as { id?: unknown }).id === 'string'
        && Array.isArray((pack as { assets?: unknown }).assets)
        && Array.isArray((pack as { dna?: unknown }).dna)
    }).slice(-MAX_PACKS)
  } catch {
    return []
  }
}

function serialisePacks(packs: readonly ReferenceResearchPack[]) {
  const encoded = JSON.stringify({ version: CACHE_VERSION, packs: packs.slice(-MAX_PACKS) })
  return encoded.length <= MAX_CACHE_BYTES ? encoded : null
}

/**
 * Safe, project-local cache. In SSR, private browsing, and storage failures it
 * degrades to an in-memory map; callers can keep functioning without probing
 * `window` or leaking research outside the selected project.
 */
export class ReferenceCatalogCache {
  private readonly key: string
  private readonly storage: Storage | null

  constructor(options: ReferenceCatalogCacheOptions = {}) {
    this.key = cacheKey(options)
    this.storage = browserStorage(options.storage)
  }

  list(): readonly ReferenceResearchPack[] {
    const fallback = memoryStorage.get(this.key)
    if (fallback !== undefined) return parsePacks(fallback)
    try {
      const persisted = this.storage?.getItem(this.key)
      if (persisted !== null && persisted !== undefined) {
        memoryStorage.set(this.key, persisted)
        return parsePacks(persisted)
      }
    } catch {
      // Fall through to the memory mirror; storage is optional infrastructure.
    }
    return parsePacks(memoryStorage.get(this.key) ?? null)
  }

  save(pack: ReferenceResearchPack): readonly ReferenceResearchPack[] {
    const next = [...this.list().filter((item) => item.id !== pack.id), pack].slice(-MAX_PACKS)
    const encoded = serialisePacks(next)
    if (!encoded) return this.list()
    memoryStorage.set(this.key, encoded)
    try {
      this.storage?.setItem(this.key, encoded)
    } catch {
      // In-memory storage already holds the compact, safe representation.
    }
    return next
  }

  remove(packId: string): readonly ReferenceResearchPack[] {
    const next = this.list().filter((pack) => pack.id !== packId)
    const encoded = serialisePacks(next)
    if (!encoded) return next
    memoryStorage.set(this.key, encoded)
    try {
      this.storage?.setItem(this.key, encoded)
    } catch {
      // Leave the per-process fallback updated.
    }
    return next
  }

  clear(): void {
    memoryStorage.delete(this.key)
    try {
      this.storage?.removeItem(this.key)
    } catch {
      // Storage access can be denied in SSR shells and privacy modes.
    }
  }
}

export function createReferenceCatalogCache(options: ReferenceCatalogCacheOptions = {}) {
  return new ReferenceCatalogCache(options)
}
