import type { VehicleSpec } from '../types'

/**
 * Local, unbranded visual reference data for an original 2022–25
 * ground-effect Formula-style car. It deliberately stores cues and
 * relationships rather than source images or a team-specific livery.
 */
export type F1ReferenceEra = '2022-25-ground-effect'

export type F1ReferenceView = 'front' | 'side' | 'top' | 'rear' | 'front-three-quarter' | 'rear-three-quarter'

export type F1ComponentGroup =
  | 'front-aero'
  | 'front-corner'
  | 'cockpit'
  | 'sidepod'
  | 'floor'
  | 'rear-corner'
  | 'rear-aero'

export type F1ComponentId =
  | 'front-wing-mainplane'
  | 'front-wing-flaps'
  | 'front-wing-endplates'
  | 'nose'
  | 'front-suspension'
  | 'front-brake-ducts'
  | 'front-tyres'
  | 'cockpit'
  | 'halo'
  | 'sidepod-inlets'
  | 'sidepod-undercuts'
  | 'engine-cover'
  | 'airbox'
  | 'floor-edge'
  | 'floor-fences'
  | 'ground-effect-tunnels'
  | 'rear-suspension'
  | 'rear-brake-ducts'
  | 'rear-tyres'
  | 'diffuser'
  | 'beam-wing'
  | 'rear-wing'
  | 'rear-wing-endplates'
  | 'rear-rain-light'

export type F1ComponentCue = {
  id: F1ComponentId
  group: F1ComponentGroup
  required: true
  views: readonly F1ReferenceView[]
  visualCues: readonly string[]
  promptTerms: readonly string[]
}

export type F1ViewReference = {
  view: F1ReferenceView
  purpose: string
  mustShow: readonly F1ComponentId[]
}

export type F1RatioMetric =
  | 'wheelbase-to-overall-length'
  | 'overall-width-to-overall-length'
  | 'front-track-to-overall-width'
  | 'rear-track-to-overall-width'
  | 'wheel-diameter-to-overall-length'
  | 'wheel-diameter-to-overall-height'
  | 'ride-height-to-wheel-diameter'

export type F1RatioConstraint = {
  id: string
  metric: F1RatioMetric
  label: string
  minimum: number
  maximum: number
  visualIntent: string
}

export type F1ShapeConstraint = {
  id: string
  label: string
  requiredComponents: readonly F1ComponentId[]
  visualIntent: string
}

export type F1RatioAssessment = F1RatioConstraint & {
  value: number
  status: 'within-range' | 'below-range' | 'above-range'
}

export type F1ReferencePack = {
  id: 'original-f1-2022-25-ground-effect'
  era: F1ReferenceEra
  title: string
  identityGuardrails: readonly string[]
  referenceViews: readonly F1ViewReference[]
  mandatoryComponents: readonly F1ComponentCue[]
  ratioConstraints: readonly F1RatioConstraint[]
  shapeConstraints: readonly F1ShapeConstraint[]
  negativeCues: readonly string[]
}

export type F1ReferenceRetrieval = {
  pack: F1ReferencePack
  relevance: 'primary' | 'supporting'
  confidence: number
  focusedComponents: readonly F1ComponentCue[]
  ratioAssessments: readonly F1RatioAssessment[]
  rendererBrief: string
}

const components: readonly F1ComponentCue[] = [
  {
    id: 'front-wing-mainplane', group: 'front-aero', required: true, views: ['front', 'top', 'front-three-quarter'],
    visualCues: ['wide, low mainplane close to the front axle', 'span reaches toward the tyre outer planes'],
    promptTerms: ['front wing', 'mainplane', 'nose'],
  },
  {
    id: 'front-wing-flaps', group: 'front-aero', required: true, views: ['front', 'top', 'front-three-quarter'],
    visualCues: ['stacked flap elements with visible gaps', 'flaps taper into the endplate volume'],
    promptTerms: ['front wing', 'flap', 'multi-element'],
  },
  {
    id: 'front-wing-endplates', group: 'front-aero', required: true, views: ['front', 'top', 'front-three-quarter'],
    visualCues: ['endplates are structural aero surfaces, not flat billboard panels', 'outer edges turn around the front-wheel wake'],
    promptTerms: ['endplate', 'front wing', 'wake'],
  },
  {
    id: 'nose', group: 'front-aero', required: true, views: ['front', 'side', 'top', 'front-three-quarter'],
    visualCues: ['narrow nose spine rising from the front wing', 'nose remains distinct from the cockpit monocoque'],
    promptTerms: ['nose', 'front'],
  },
  {
    id: 'front-suspension', group: 'front-corner', required: true, views: ['front', 'side', 'front-three-quarter'],
    visualCues: ['exposed paired wishbone members', 'arms visibly connect chassis, upright, and wheel'],
    promptTerms: ['suspension', 'wishbone', 'pushrod', 'pullrod'],
  },
  {
    id: 'front-brake-ducts', group: 'front-corner', required: true, views: ['front', 'front-three-quarter'],
    visualCues: ['small sculpted duct volume inside each exposed front wheel', 'ducts do not turn into road-car fenders'],
    promptTerms: ['brake duct', 'front corner', 'brakes'],
  },
  {
    id: 'front-tyres', group: 'front-corner', required: true, views: ['front', 'side', 'top', 'front-three-quarter'],
    visualCues: ['uncovered slick tyres with a broad circular sidewall', 'wheel centres sit far outside the narrow body'],
    promptTerms: ['tyre', 'tire', 'wheel', 'slick'],
  },
  {
    id: 'cockpit', group: 'cockpit', required: true, views: ['side', 'top', 'front-three-quarter'],
    visualCues: ['single-seat open cockpit behind the front axle', 'shallow opening within a narrow carbon monocoque'],
    promptTerms: ['cockpit', 'monocoque', 'driver'],
  },
  {
    id: 'halo', group: 'cockpit', required: true, views: ['front', 'side', 'top', 'front-three-quarter'],
    visualCues: ['three-legged halo arcs around the cockpit opening', 'central pylon is visibly anchored ahead of the driver'],
    promptTerms: ['halo', 'cockpit', 'safety'],
  },
  {
    id: 'sidepod-inlets', group: 'sidepod', required: true, views: ['side', 'top', 'front-three-quarter'],
    visualCues: ['cooling inlets sit beside the cockpit, not at a road-car grille', 'inlet lips feed a compact radiator volume'],
    promptTerms: ['sidepod', 'cooling', 'inlet', 'radiator'],
  },
  {
    id: 'sidepod-undercuts', group: 'sidepod', required: true, views: ['side', 'top', 'front-three-quarter', 'rear-three-quarter'],
    visualCues: ['deep undercut beneath the sidepod shoulder', 'sidepod body tapers toward the rear floor edge'],
    promptTerms: ['sidepod', 'undercut', 'coke bottle'],
  },
  {
    id: 'engine-cover', group: 'sidepod', required: true, views: ['side', 'top', 'rear-three-quarter'],
    visualCues: ['tight dorsal spine behind the cockpit', 'bodywork pinches toward the rear suspension'],
    promptTerms: ['engine cover', 'spine', 'bodywork'],
  },
  {
    id: 'airbox', group: 'cockpit', required: true, views: ['front', 'side', 'top', 'rear-three-quarter'],
    visualCues: ['roof-level intake above and behind the halo', 'compact opening integrated into the engine-cover spine'],
    promptTerms: ['airbox', 'intake', 'roll hoop'],
  },
  {
    id: 'floor-edge', group: 'floor', required: true, views: ['side', 'top', 'rear-three-quarter'],
    visualCues: ['long floor edge runs between both axles', 'outer floor silhouette is visibly lower than the sidepod shoulder'],
    promptTerms: ['floor', 'floor edge', 'ground effect'],
  },
  {
    id: 'floor-fences', group: 'floor', required: true, views: ['front-three-quarter', 'side', 'top'],
    visualCues: ['vertical fences appear at the leading floor edge', 'fences are thin repeated aero blades, not a solid skirt'],
    promptTerms: ['floor fence', 'fence', 'ground effect'],
  },
  {
    id: 'ground-effect-tunnels', group: 'floor', required: true, views: ['side', 'rear', 'rear-three-quarter'],
    visualCues: ['floor volume suggests underbody tunnels from front floor to diffuser', 'centreline floor remains visually distinct from sidepod bodywork'],
    promptTerms: ['tunnel', 'venturi', 'ground effect', 'underfloor'],
  },
  {
    id: 'rear-suspension', group: 'rear-corner', required: true, views: ['side', 'rear', 'rear-three-quarter'],
    visualCues: ['exposed link members frame the gearbox and rear wheels', 'upright and brake duct remain visible inside each rear wheel'],
    promptTerms: ['rear suspension', 'wishbone', 'gearbox'],
  },
  {
    id: 'rear-brake-ducts', group: 'rear-corner', required: true, views: ['rear', 'rear-three-quarter'],
    visualCues: ['compact ducting lives inside the rear-wheel envelope', 'do not merge it into a road-car rear fender'],
    promptTerms: ['rear brake duct', 'brake duct', 'rear corner'],
  },
  {
    id: 'rear-tyres', group: 'rear-corner', required: true, views: ['side', 'rear', 'top', 'rear-three-quarter'],
    visualCues: ['uncovered rear slicks are visibly wider than front slicks', 'rear tyre shoulders sit outside the diffuser and rear wing supports'],
    promptTerms: ['rear tyre', 'rear tire', 'wheel', 'slick'],
  },
  {
    id: 'diffuser', group: 'rear-aero', required: true, views: ['rear', 'side', 'rear-three-quarter'],
    visualCues: ['wide rear diffuser exits below the crash structure', 'multiple channels are separated by vertical strakes'],
    promptTerms: ['diffuser', 'floor', 'rear aero'],
  },
  {
    id: 'beam-wing', group: 'rear-aero', required: true, views: ['rear', 'side', 'rear-three-quarter'],
    visualCues: ['compact lower wing sits above the diffuser', 'kept visually separate from the main rear wing'],
    promptTerms: ['beam wing', 'rear wing', 'diffuser'],
  },
  {
    id: 'rear-wing', group: 'rear-aero', required: true, views: ['rear', 'side', 'top', 'rear-three-quarter'],
    visualCues: ['tall rear wing above the rear axle line', 'multiple horizontal elements read as a separate assembly'],
    promptTerms: ['rear wing', 'wing', 'aero'],
  },
  {
    id: 'rear-wing-endplates', group: 'rear-aero', required: true, views: ['rear', 'rear-three-quarter'],
    visualCues: ['endplates form shaped vertical boundaries around the rear-wing elements', 'supports remain slender and centred'],
    promptTerms: ['rear wing', 'endplate', 'wing support'],
  },
  {
    id: 'rear-rain-light', group: 'rear-aero', required: true, views: ['rear', 'rear-three-quarter'],
    visualCues: ['single small central red rain light below the rear wing', 'mount it on the centreline, above the diffuser exit'],
    promptTerms: ['rain light', 'rear light', 'rear'],
  },
]

const ratioConstraints: readonly F1RatioConstraint[] = [
  {
    id: 'wheelbase-length', metric: 'wheelbase-to-overall-length', label: 'Wheelbase / overall length',
    minimum: 0.64, maximum: 0.72, visualIntent: 'Long wheelbase makes the chassis read as a modern single-seater rather than a short toy kart.',
  },
  {
    id: 'width-length', metric: 'overall-width-to-overall-length', label: 'Overall width / overall length',
    minimum: 0.36, maximum: 0.41, visualIntent: 'Wide stance supports the low, planted ground-effect silhouette.',
  },
  {
    id: 'front-track-width', metric: 'front-track-to-overall-width', label: 'Front track / overall width',
    minimum: 0.82, maximum: 0.9, visualIntent: 'Front wheels should sit near the visual width envelope while remaining visibly outside the body.',
  },
  {
    id: 'rear-track-width', metric: 'rear-track-to-overall-width', label: 'Rear track / overall width',
    minimum: 0.76, maximum: 0.86, visualIntent: 'Rear wheels need a broad planted track without eliminating the visible tyre shoulders.',
  },
  {
    id: 'wheel-diameter-length', metric: 'wheel-diameter-to-overall-length', label: 'Wheel diameter / overall length',
    minimum: 0.13, maximum: 0.16, visualIntent: 'Full-size wheel diameter prevents a miniature or formula-junior appearance.',
  },
  {
    id: 'wheel-diameter-height', metric: 'wheel-diameter-to-overall-height', label: 'Wheel diameter / overall height',
    minimum: 0.68, maximum: 0.84, visualIntent: 'Tyres should dominate the car height while the monocoque remains exceptionally low.',
  },
  {
    id: 'ride-height-wheel-diameter', metric: 'ride-height-to-wheel-diameter', label: 'Ride height / wheel diameter',
    minimum: 0.04, maximum: 0.1, visualIntent: 'A very low floor preserves the ground-effect stance without visually intersecting the track.',
  },
]

const shapeConstraints: readonly F1ShapeConstraint[] = [
  {
    id: 'open-wheel-separation', label: 'Open-wheel separation', requiredComponents: ['front-tyres', 'rear-tyres', 'front-suspension', 'rear-suspension'],
    visualIntent: 'All four tyres remain exposed, with visible air gaps between the narrow centreline chassis and each wheel.',
  },
  {
    id: 'cockpit-safety-cell', label: 'Open cockpit and halo', requiredComponents: ['cockpit', 'halo', 'airbox'],
    visualIntent: 'Use a single open cockpit, a clearly readable halo, and a compact intake spine; never substitute a glazed road-car cabin.',
  },
  {
    id: 'front-aero-stack', label: 'Layered front aero', requiredComponents: ['front-wing-mainplane', 'front-wing-flaps', 'front-wing-endplates', 'nose'],
    visualIntent: 'The nose, wing planes, flaps, and endplates need distinct layered silhouettes instead of one broad front bumper.',
  },
  {
    id: 'ground-effect-body', label: 'Ground-effect floor architecture', requiredComponents: ['sidepod-undercuts', 'floor-edge', 'floor-fences', 'ground-effect-tunnels', 'diffuser'],
    visualIntent: 'Sidepod undercuts feed a low, long floor and a visible diffuser; do not use a sealed flat road-car underbody.',
  },
  {
    id: 'rear-aero-stack', label: 'Layered rear aero', requiredComponents: ['beam-wing', 'rear-wing', 'rear-wing-endplates', 'rear-rain-light'],
    visualIntent: 'Rear wing, beam wing, diffuser, and rain light should resolve as separate centreline assemblies above the rear axle.',
  },
]

const referenceViews: readonly F1ViewReference[] = [
  {
    view: 'front', purpose: 'Validate front-wing span, exposed wheels, halo, and suspension symmetry.',
    mustShow: ['front-wing-mainplane', 'front-wing-flaps', 'front-wing-endplates', 'front-suspension', 'front-tyres', 'halo'],
  },
  {
    view: 'side', purpose: 'Validate the long, low silhouette, cockpit placement, undercut, floor edge, and wheelbase.',
    mustShow: ['nose', 'cockpit', 'sidepod-undercuts', 'floor-edge', 'ground-effect-tunnels', 'rear-wing'],
  },
  {
    view: 'top', purpose: 'Validate the narrow centreline chassis, exposed tyres, sidepod shape, and wing span.',
    mustShow: ['front-wing-mainplane', 'cockpit', 'sidepod-inlets', 'sidepod-undercuts', 'rear-tyres', 'rear-wing'],
  },
  {
    view: 'rear', purpose: 'Validate diffuser channels, rear wing/endplates, beam wing, rain light, and rear tyre width.',
    mustShow: ['diffuser', 'beam-wing', 'rear-wing', 'rear-wing-endplates', 'rear-rain-light', 'rear-tyres'],
  },
  {
    view: 'front-three-quarter', purpose: 'Check front aero layering, front-corner suspension, cockpit, and sidepod inlet integration.',
    mustShow: ['front-wing-flaps', 'front-suspension', 'front-brake-ducts', 'halo', 'sidepod-inlets', 'floor-fences'],
  },
  {
    view: 'rear-three-quarter', purpose: 'Check the engine-cover taper, floor exit, rear suspension, and rear aero stack.',
    mustShow: ['engine-cover', 'ground-effect-tunnels', 'rear-suspension', 'diffuser', 'rear-wing', 'rear-rain-light'],
  },
]

export const F1_2022_25_REFERENCE_PACK: F1ReferencePack = {
  id: 'original-f1-2022-25-ground-effect',
  era: '2022-25-ground-effect',
  title: 'Original 2022–25 ground-effect Formula-style visual pack',
  identityGuardrails: [
    'Create an original, unbranded car; do not reproduce a named team car, livery, badge, or sponsor graphic.',
    'Use the era as a component and proportion reference, not as an instruction to copy a specific chassis.',
  ],
  referenceViews,
  mandatoryComponents: components,
  ratioConstraints,
  shapeConstraints,
  negativeCues: [
    'no enclosed road-car cabin',
    'no bodywork covering the tyres',
    'no single solid front bumper in place of layered wing elements',
    'no oversized cartoon wings or toy-kart proportions',
    'no team logos, sponsor marks, copied livery, or production-car headlights',
  ],
}

function measureRatio(spec: VehicleSpec, metric: F1RatioMetric): number {
  const wheelDiameter = spec.wheelRadius * 2
  switch (metric) {
    case 'wheelbase-to-overall-length': return spec.wheelbase / spec.overallLength
    case 'overall-width-to-overall-length': return spec.overallWidth / spec.overallLength
    case 'front-track-to-overall-width': return spec.frontTrack / spec.overallWidth
    case 'rear-track-to-overall-width': return spec.rearTrack / spec.overallWidth
    case 'wheel-diameter-to-overall-length': return wheelDiameter / spec.overallLength
    case 'wheel-diameter-to-overall-height': return wheelDiameter / spec.overallHeight
    case 'ride-height-to-wheel-diameter': return spec.rideHeight / wheelDiameter
  }
}

export function evaluateF1RatioConstraints(spec: VehicleSpec): readonly F1RatioAssessment[] {
  return F1_2022_25_REFERENCE_PACK.ratioConstraints.map((constraint) => {
    const value = Number(measureRatio(spec, constraint.metric).toFixed(3))
    const status = value < constraint.minimum
      ? 'below-range'
      : value > constraint.maximum
        ? 'above-range'
        : 'within-range'
    return { ...constraint, value, status }
  })
}

const formulaSignals = [
  'formula', 'f1', 'open wheel', 'open-wheel', 'single seater', 'single-seater', 'grand prix', 'ground effect', 'monocoque', 'halo',
] as const

function textIncludesSignal(text: string, signal: string) {
  return signal.includes('-') || signal.includes(' ')
    ? text.includes(signal)
    : new RegExp(`\\b${signal}(?:s|es)?\\b`).test(text)
}

function componentPromptMatch(component: F1ComponentCue, text: string) {
  return component.promptTerms.some((term) => textIncludesSignal(text, term))
}

function buildRendererBrief(focused: readonly F1ComponentCue[]): string {
  const componentList = F1_2022_25_REFERENCE_PACK.mandatoryComponents.map((component) => component.id.replaceAll('-', ' ')).join(', ')
  const focusList = focused.map((component) => component.id.replaceAll('-', ' ')).join(', ')
  const ratioList = F1_2022_25_REFERENCE_PACK.ratioConstraints
    .map((constraint) => `${constraint.label}: ${constraint.minimum.toFixed(2)}–${constraint.maximum.toFixed(2)}`)
    .join('; ')
  return [
    'Original, unbranded 2022–25 ground-effect Formula-style single-seater. Preserve an open cockpit, exposed slick tyres, and a narrow centreline carbon monocoque.',
    `Required exterior systems: ${componentList}.`,
    `Current focus: ${focusList || 'full exterior-system fidelity'}.`,
    `Proportion checks: ${ratioList}.`,
    'Use the six reference views (front, side, top, rear, front three-quarter, rear three-quarter) to keep wing layout, wheel centres, exposed suspension, floor architecture, and diffuser aligned.',
    'Do not add logos, a copied team livery, an enclosed cabin, tyre-covering fenders, or toy-like oversized aero.',
  ].join(' ')
}

/**
 * Retrieves the static F1 pack only when the prompt or current typed schema
 * identifies a Formula-style design. The result is deterministic: identical
 * prompt/spec input returns identical focus ordering, confidence, and brief.
 */
export function retrieveF1ReferencePack(prompt: string, spec?: VehicleSpec): F1ReferenceRetrieval | null {
  const text = prompt.toLowerCase()
  const matchedSignalCount = formulaSignals.filter((signal) => textIncludesSignal(text, signal)).length
  const formulaSpec = spec?.vehicleClass === 'formula'
  if (!formulaSpec && matchedSignalCount === 0) return null

  const focusedComponents = F1_2022_25_REFERENCE_PACK.mandatoryComponents.filter((component) => componentPromptMatch(component, text))
  const confidence = Math.min(1, Number(((formulaSpec ? 0.78 : 0.52) + Math.min(matchedSignalCount, 4) * 0.055).toFixed(2)))
  const relevance = formulaSpec || matchedSignalCount >= 2 ? 'primary' : 'supporting'
  return {
    pack: F1_2022_25_REFERENCE_PACK,
    relevance,
    confidence,
    focusedComponents,
    ratioAssessments: spec ? evaluateF1RatioConstraints(spec) : [],
    rendererBrief: buildRendererBrief(focusedComponents),
  }
}
