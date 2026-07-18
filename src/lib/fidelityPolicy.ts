import type { VehicleClass, VehicleSpec } from '../types'

export type FidelityView = 'front' | 'side' | 'rear' | 'top' | 'three-quarter'

export type VisibleSystemRequirement = {
  /** Stable component identifier used by a critic, retrieval layer, or UI. */
  id: string
  label: string
  requiredViews: readonly FidelityView[]
  rationale: string
}

export type VisualFidelityThresholds = {
  /** Minimum aggregate visual-fidelity score that may pass without a retry. */
  passScore: number
  /** Scores at or below this value should request a corrective render. */
  retryBelow: number
  /** A design cannot pass if more critical systems than this are absent. */
  maxMissingRequiredSystems: number
  /** A design cannot pass if more major proportion/component drifts than this remain. */
  maxMajorDrifts: number
  /** Minimum distinct reference views expected for a production fidelity check. */
  minimumReferenceViews: number
}

export type ReferenceUseGuidance = {
  sourcePriority: readonly string[]
  useReferencesFor: readonly string[]
  adaptationRules: readonly string[]
  doNotUseReferencesFor: readonly string[]
}

export type VisualFidelityPolicy = {
  vehicleClass: VehicleClass
  label: string
  requiredVisibleSystems: readonly VisibleSystemRequirement[]
  thresholds: VisualFidelityThresholds
  referenceGuidance: ReferenceUseGuidance
  criticFocus: readonly string[]
}

const views = (...items: FidelityView[]) => items

const system = (
  id: string,
  label: string,
  requiredViews: readonly FidelityView[],
  rationale: string,
): VisibleSystemRequirement => ({ id, label, requiredViews, rationale })

const commonReferenceGuidance: ReferenceUseGuidance = {
  sourcePriority: [
    'the active procedural multi-view geometry sheet',
    'approved component-level reference assets with known view labels',
    'project-approved named-vehicle research packs',
  ],
  useReferencesFor: [
    'component proportions, mounting relationships, surface breaks, and material separation',
    'multi-view landmark alignment before beauty-render styling',
  ],
  adaptationRules: [
    'Treat the active vehicle schema as the dimensional authority.',
    'Scale, mount, and reshape a borrowed design cue for the target package before rendering it.',
    'Keep the final vehicle original even when a named production component informed the cue.',
  ],
  doNotUseReferencesFor: [
    'logos, badges, sponsor graphics, copied liveries, or unverified dimensions',
    'overriding wheelbase, track, ride height, or component packaging from the active schema',
  ],
}

const roadThresholds: VisualFidelityThresholds = {
  passScore: 80,
  retryBelow: 72,
  maxMissingRequiredSystems: 1,
  maxMajorDrifts: 1,
  minimumReferenceViews: 4,
}

const policies: Record<VehicleClass, VisualFidelityPolicy> = {
  road: {
    vehicleClass: 'road',
    label: 'road vehicle',
    requiredVisibleSystems: [
      system('body-volume', 'coherent body volumes and wheel-arch geometry', views('side', 'three-quarter'), 'Prevents a single undifferentiated vehicle blob.'),
      system('greenhouse', 'greenhouse, glazing, pillars, and roof-to-deck transition', views('side', 'three-quarter'), 'Makes the cabin proportion and seating envelope legible.'),
      system('lighting', 'front and rear lighting assemblies', views('front', 'rear', 'three-quarter'), 'Road-going identity requires convincing lighting hardware rather than painted marks.'),
      system('wheel-package', 'four wheels, tyres, brakes, and believable arch clearance', views('front', 'side', 'three-quarter'), 'Anchors stance and establishes full-scale proportions.'),
      system('closures', 'doors, shut lines, mirrors, and functional surface breaks', views('side', 'three-quarter'), 'Separates manufactured body panels from a toy-like shell.'),
      system('cooling-and-underbody', 'class-appropriate cooling apertures and lower-body treatment', views('front', 'rear', 'three-quarter'), 'Preserves functional detail without forcing race-car aero on a normal car.'),
    ],
    thresholds: roadThresholds,
    referenceGuidance: commonReferenceGuidance,
    criticFocus: ['cab-to-wheel proportion', 'wheel arch clearance', 'glasshouse plausibility', 'lamp and panel integration', 'full-scale material separation'],
  },
  formula: {
    vehicleClass: 'formula',
    label: 'ground-effect Formula-style single-seater',
    requiredVisibleSystems: [
      system('open-wheel-layout', 'four exposed slick tyres with visible air gaps to the centreline chassis', views('front', 'side', 'top', 'three-quarter'), 'Rejects enclosed-body or kart-like interpretations.'),
      system('front-aero', 'layered front wing, flaps, endplates, and a separate nose spine', views('front', 'top', 'three-quarter'), 'The front must read as a stacked aero assembly, not a bumper.'),
      system('front-suspension', 'exposed front wishbones, uprights, brake ducts, and steering links', views('front', 'three-quarter'), 'Makes the wheel-to-chassis relationship mechanically credible.'),
      system('cockpit-safety-cell', 'open cockpit, halo, monocoque, roll hoop, and airbox', views('side', 'top', 'three-quarter'), 'Defines a contemporary Formula safety-cell silhouette.'),
      system('ground-effect-floor', 'sidepod inlets and undercuts, floor edge, fences, and underfloor tunnel volume', views('side', 'top', 'three-quarter'), 'Ground-effect architecture must be visibly separate from the upper body.'),
      system('rear-corner', 'exposed rear suspension, brake ducts, and wider rear tyres', views('rear', 'three-quarter'), 'Maintains a believable gearbox and rear-corner package.'),
      system('rear-aero', 'diffuser strakes, beam wing, rear wing/endplates, and central rain light', views('rear', 'side', 'three-quarter'), 'Rear aero needs layered, independent systems instead of a single spoiler.'),
    ],
    thresholds: {
      passScore: 84,
      retryBelow: 76,
      maxMissingRequiredSystems: 0,
      maxMajorDrifts: 0,
      minimumReferenceViews: 6,
    },
    referenceGuidance: {
      ...commonReferenceGuidance,
      useReferencesFor: [
        ...commonReferenceGuidance.useReferencesFor,
        'open-wheel proportions, aero component separation, suspension visibility, and floor architecture',
      ],
      doNotUseReferencesFor: [
        ...commonReferenceGuidance.doNotUseReferencesFor,
        'a named team chassis, sponsor layout, or team-specific livery',
      ],
    },
    criticFocus: ['open-wheel separation', 'long low wheelbase-to-length silhouette', 'aero layer count', 'cockpit/halo legibility', 'underfloor and diffuser continuity'],
  },
  gt: {
    vehicleClass: 'gt',
    label: 'grand touring performance car',
    requiredVisibleSystems: [
      system('body-proportion', 'low two-door body, long-hood or cab-rearward proportion, and coherent rear haunches', views('side', 'three-quarter'), 'A GT should read as a full-scale performance road car before aero is considered.'),
      system('greenhouse-and-closures', 'two-door greenhouse, glazing, mirrors, panel lines, and door cuts', views('side', 'three-quarter'), 'Maintains manufacturable road-car character.'),
      system('wheel-and-brake-package', 'large wheel, tyre, brake, and arch-clearance package', views('front', 'side', 'three-quarter'), 'Carries the intended stance and performance credibility.'),
      system('lighting-and-cooling', 'integrated lamps plus class-appropriate cooling apertures', views('front', 'rear', 'three-quarter'), 'Prevents a generic smooth shell.'),
      system('performance-aero', 'subtle splitter, diffuser, spoiler or wing sized to the active schema', views('front', 'rear', 'three-quarter'), 'Checks that aero is integrated rather than pasted onto a road body.'),
    ],
    thresholds: { ...roadThresholds, passScore: 81, retryBelow: 73 },
    referenceGuidance: commonReferenceGuidance,
    criticFocus: ['cabin placement', 'front-to-rear visual mass', 'wheel fitment', 'aero restraint', 'premium panel and lamp detailing'],
  },
  rally: {
    vehicleClass: 'rally',
    label: 'rally competition car',
    requiredVisibleSystems: [
      system('competition-shell', 'recognizable road-derived body shell, greenhouse, doors, and widened arches', views('side', 'three-quarter'), 'Keeps the design rooted in a practical competition shell.'),
      system('suspension-and-tyres', 'raised long-travel stance, gravel tyres, wheel clearance, and visible suspension travel intent', views('front', 'side', 'three-quarter'), 'Off-road capability must be legible at a glance.'),
      system('protection-and-cooling', 'robust bumper, cooling apertures, underbody guard, and recovery-friendly lower body', views('front', 'three-quarter'), 'Adds realistic loose-surface durability details.'),
      system('roof-and-aero', 'roof intake or vent treatment and a restrained rear aero device', views('side', 'rear', 'three-quarter'), 'Separates a rally car from a road hatch with decals.'),
      system('lighting', 'functional headlamps, tail lamps, and optional auxiliary rally-light mounting', views('front', 'rear'), 'Ensures usable stage-night visual systems.'),
    ],
    thresholds: { ...roadThresholds, passScore: 80, retryBelow: 72, maxMajorDrifts: 1 },
    referenceGuidance: commonReferenceGuidance,
    criticFocus: ['ride height', 'arch clearance', 'durability hardware', 'road-shell identity', 'surface-ready tyre scale'],
  },
  suv: {
    vehicleClass: 'suv',
    label: 'sport-utility vehicle',
    requiredVisibleSystems: [
      system('utility-body', 'upright cabin, usable greenhouse, doors, and rear cargo volume', views('side', 'three-quarter'), 'Preserves passenger and cargo packaging.'),
      system('lighting-and-fascia', 'integrated front and rear lamps, grille or EV fascia, and bumper volumes', views('front', 'rear', 'three-quarter'), 'Avoids treating an SUV as an enlarged sports-car shell.'),
      system('wheel-and-clearance', 'wheel arches, tyres, brakes, ride height, and suspension-clearance intent', views('front', 'side', 'three-quarter'), 'Checks all-weather stance and practical wheel travel.'),
      system('utility-details', 'mirrors, roof treatment, lower cladding or underbody protection, and tailgate separation', views('side', 'rear', 'three-quarter'), 'Makes the vehicle functionally legible.'),
    ],
    thresholds: { ...roadThresholds, passScore: 79, retryBelow: 71, maxMajorDrifts: 2 },
    referenceGuidance: commonReferenceGuidance,
    criticFocus: ['cabin volume', 'beltline and roof height', 'wheel-to-body scale', 'cargo/tailgate readability', 'all-weather utility stance'],
  },
  truck: {
    vehicleClass: 'truck',
    label: 'pickup or utility truck',
    requiredVisibleSystems: [
      system('cab-and-bed', 'separate cab, passenger greenhouse, cargo bed, and tailgate', views('side', 'rear', 'three-quarter'), 'The cab-to-bed relationship is the primary truck identity cue.'),
      system('front-fascia', 'upright grille or cooling fascia, bumper, lamps, and tow-capable lower structure', views('front', 'three-quarter'), 'Anchors the heavy-duty visual character.'),
      system('wheel-and-frame', 'tyres, arch clearance, chassis-height intent, and visible suspension/frame cues', views('front', 'side', 'three-quarter'), 'Prevents a truck from becoming a tall road-car body.'),
      system('utility-hardware', 'mirrors, door cuts, bed rails, tailgate seams, and towing or payload hardware', views('side', 'rear', 'three-quarter'), 'Makes work capability visible and believable.'),
    ],
    thresholds: { ...roadThresholds, passScore: 80, retryBelow: 72, maxMajorDrifts: 1 },
    referenceGuidance: commonReferenceGuidance,
    criticFocus: ['cab-to-bed proportion', 'wheelbase and overhangs', 'load-capable stance', 'front cooling scale', 'tailgate and bed clarity'],
  },
  monster: {
    vehicleClass: 'monster',
    label: 'monster truck',
    requiredVisibleSystems: [
      system('tube-frame', 'visible tube-frame chassis, safety cage, and body-to-frame separation', views('side', 'rear', 'three-quarter'), 'The frame must carry the vehicle rather than hide beneath a giant body shell.'),
      system('axles-and-suspension', 'solid axles, four-link members, steering links, long-travel shocks, and limiting hardware', views('front', 'side', 'rear', 'three-quarter'), 'Extreme articulation needs a mechanically readable suspension system.'),
      system('tyres-and-wheel-package', 'oversized low-pressure tyres, beadlock-style wheels, hubs, and generous body clearance', views('front', 'side', 'three-quarter'), 'Tyre scale and clearance define the category.'),
      system('body-shell-and-cab', 'compact body shell, windshield or window apertures, hood, cab, and fender treatment', views('front', 'side', 'three-quarter'), 'Keeps the vehicle a truck rather than only a chassis.'),
      system('driveline-and-safety', 'visible driveshaft/differential intent, bumpers, recovery points, and safety lighting', views('front', 'rear', 'three-quarter'), 'Adds event-ready structural and safety credibility.'),
    ],
    thresholds: {
      passScore: 82,
      retryBelow: 74,
      maxMissingRequiredSystems: 0,
      maxMajorDrifts: 1,
      minimumReferenceViews: 5,
    },
    referenceGuidance: {
      ...commonReferenceGuidance,
      useReferencesFor: [
        ...commonReferenceGuidance.useReferencesFor,
        'suspension articulation, axle/frame relationships, tyre scale, and safety-cage layout',
      ],
    },
    criticFocus: ['tyre-to-cab scale', 'frame visibility', 'suspension travel', 'axle alignment', 'high-centre-of-gravity plausibility'],
  },
  ev: {
    vehicleClass: 'ev',
    label: 'electric road vehicle',
    requiredVisibleSystems: [
      system('battery-package', 'low floor or skateboard-volume implication with believable rocker and underbody depth', views('side', 'three-quarter'), 'EV packaging should affect the silhouette, not just the badge.'),
      system('front-storage-and-cooling', 'class-appropriate closed fascia or cooling aperture and a plausible front-storage volume', views('front', 'three-quarter'), 'Separates EV packaging from an ICE vehicle with the grille deleted.'),
      system('greenhouse-and-closures', 'glazing, pillars, doors, mirrors, roof transition, and panel boundaries', views('side', 'three-quarter'), 'Preserves real vehicle construction detail.'),
      system('lighting-and-charging', 'integrated front/rear lighting plus a plausible charge-port location', views('front', 'rear', 'three-quarter'), 'Gives the EV a functional exterior system.'),
      system('wheel-and-aero', 'wheel, tyre, brake package and smooth lower-body aero appropriate to the active schema', views('front', 'side', 'rear', 'three-quarter'), 'Maintains mass, range, and stance credibility.'),
    ],
    thresholds: { ...roadThresholds, passScore: 80, retryBelow: 72 },
    referenceGuidance: commonReferenceGuidance,
    criticFocus: ['battery-floor proportion', 'frunk or cooling packaging', 'aero cleanliness', 'glasshouse scale', 'charging-system plausibility'],
  },
}

/**
 * A complete class-keyed policy table. Keep it structured rather than free-form
 * prompt text so future retrieval, UI, and evaluators share the same criteria.
 */
export const VISUAL_FIDELITY_POLICIES: Readonly<Record<VehicleClass, VisualFidelityPolicy>> = policies

export function getVisualFidelityPolicy(vehicleClass: VehicleClass): VisualFidelityPolicy {
  return VISUAL_FIDELITY_POLICIES[vehicleClass]
}

const millimetres = (metres: number) => `${Math.round(metres * 1000)} mm`

const systemLabels = (policy: VisualFidelityPolicy) => policy.requiredVisibleSystems.map((item) => item.label).join('; ')

/**
 * Produces a compact, class-aware instruction for an image or vision critic.
 * It intentionally describes evaluation criteria, not hidden reasoning, so it
 * can be shown in an iteration log without exposing implementation internals.
 */
export function buildVisualCriticBrief(spec: VehicleSpec): string {
  const policy = getVisualFidelityPolicy(spec.vehicleClass)
  const thresholds = policy.thresholds
  const propulsionDetail = spec.powertrain === 'EV'
    ? 'Preserve the EV cooling, charge-port, and battery-floor implications.'
    : spec.powertrain === 'ICE'
      ? 'Preserve credible combustion cooling and exhaust/driveline implications where visible.'
      : `Preserve the ${spec.powertrain.toLowerCase()} powertrain packaging cues.`

  return [
    `Class-aware visual fidelity review: ${policy.label}, \"${spec.name}\".`,
    `Geometry lock: ${millimetres(spec.overallLength)} L × ${millimetres(spec.overallWidth)} W × ${millimetres(spec.overallHeight)} H; ${millimetres(spec.wheelbase)} wheelbase; ${millimetres(spec.frontTrack)}/${millimetres(spec.rearTrack)} tracks; ${millimetres(spec.rideHeight)} ride height; ${spec.roofProfile} roof profile.`,
    `Required visible systems: ${systemLabels(policy)}.`,
    `Pass only at ${thresholds.passScore}/100 or above, with no more than ${thresholds.maxMissingRequiredSystems} missing required systems and ${thresholds.maxMajorDrifts} major drifts. Inspect at least ${thresholds.minimumReferenceViews} distinct views.`,
    `Focus: ${policy.criticFocus.join('; ')}. ${propulsionDetail}`,
    `Reference use: ${policy.referenceGuidance.sourcePriority[0]} is authoritative; use other references only for ${policy.referenceGuidance.useReferencesFor[0].toLowerCase()} ${policy.referenceGuidance.adaptationRules[1]}`,
  ].join(' ')
}
