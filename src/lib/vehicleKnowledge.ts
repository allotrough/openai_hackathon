import type { VehicleClass, VehicleSpec } from '../types'

/**
 * Stable, typed design knowledge used by the planner, geometry engine, and
 * visual critic. This is deliberately structured data rather than retrieved
 * prose: a renderer can ask for a component by id without letting an LLM
 * invent meshes or silently substitute one vehicle architecture for another.
 */
export type VehicleComponentCategory =
  | 'structure'
  | 'body'
  | 'greenhouse'
  | 'visibility'
  | 'cabin'
  | 'safety'
  | 'corner'
  | 'suspension'
  | 'steering'
  | 'braking'
  | 'powertrain'
  | 'thermal'
  | 'underbody'
  | 'aero'
  | 'lighting'
  | 'cargo'
  | 'electronics'

export type ComponentDetailTier = 'silhouette' | 'system' | 'close-up'

export type ComponentRequirement =
  | 'aero-package'
  | 'front-wing'
  | 'rear-wing'
  | 'diffuser'
  | 'battery-electric'
  | 'combustion-or-hybrid'
  | 'cargo-bed'
  | 'high-clearance'
  | 'road-legal'

export type ReferenceAdaptationMode = 'preserve-proportions' | 'style-only' | 'reengineer'

export type VehicleComponentDefinition = {
  /** Stable id for a geometry node, reference retrieval label, and critic check. */
  id: string
  category: VehicleComponentCategory
  label: string
  detailTier: ComponentDetailTier
  required: boolean
  requiredWhen?: readonly ComponentRequirement[]
  geometryIntent: string
  referenceAdaptation: ReferenceAdaptationMode
}

export type ReferenceView = 'front' | 'side' | 'top' | 'rear' | 'front-three-quarter' | 'rear-three-quarter'

export type FidelityPolicy = {
  tier: 'production' | 'competition' | 'extreme-mechanical'
  minimumOverallScore: number
  maximumRevisionIterations: number
  requiredViews: readonly ReferenceView[]
  requiredChecks: readonly string[]
  rejectIfMissingCategories: readonly VehicleComponentCategory[]
}

export type VehicleKnowledgePack = {
  id: string
  vehicleClass: VehicleClass
  title: string
  summary: string
  components: readonly VehicleComponentDefinition[]
  designAssumptions: readonly string[]
  fidelityPolicy: FidelityPolicy
}

export type ReferenceComponentRequest = {
  /** A catalog id when known, for example `side-mirrors` or `front-storage`. */
  componentId: string
  category: VehicleComponentCategory
  sourceVehicleClass?: VehicleClass
  sourceLabel?: string
}

export type ReferenceAdaptationDecision = {
  status: 'compatible' | 'adaptable' | 'blocked'
  targetComponent?: VehicleComponentDefinition
  reason: string
  requiredChanges: readonly string[]
}

const component = (
  id: string,
  category: VehicleComponentCategory,
  label: string,
  detailTier: ComponentDetailTier,
  geometryIntent: string,
  referenceAdaptation: ReferenceAdaptationMode,
  options: Pick<VehicleComponentDefinition, 'required' | 'requiredWhen'> = { required: true },
): VehicleComponentDefinition => ({ id, category, label, detailTier, geometryIntent, referenceAdaptation, ...options })

const roadFidelity: FidelityPolicy = {
  tier: 'production',
  minimumOverallScore: 78,
  maximumRevisionIterations: 4,
  requiredViews: ['front', 'side', 'rear', 'front-three-quarter'],
  requiredChecks: [
    'wheel centres sit inside believable wheel arches',
    'greenhouse, hood, and trunk volumes read as separate production stampings',
    'lighting and glazing remain physically mountable',
    'powertrain and luggage volumes do not occupy the same envelope',
  ],
  rejectIfMissingCategories: ['structure', 'body', 'greenhouse', 'corner', 'suspension', 'powertrain', 'lighting'],
}

const formulaFidelity: FidelityPolicy = {
  tier: 'competition',
  minimumOverallScore: 84,
  maximumRevisionIterations: 5,
  requiredViews: ['front', 'side', 'top', 'rear', 'front-three-quarter', 'rear-three-quarter'],
  requiredChecks: [
    'all four tyres remain visually separate from the narrow centreline chassis',
    'front wing, floor, diffuser, beam wing, and rear wing resolve as separate aero systems',
    'cockpit, halo, airbox, and suspension links are readable from their validation views',
    'long, low wheelbase and tyre diameter avoid a toy-kart silhouette',
  ],
  rejectIfMissingCategories: ['structure', 'safety', 'corner', 'suspension', 'aero', 'underbody', 'powertrain'],
}

const monsterFidelity: FidelityPolicy = {
  tier: 'extreme-mechanical',
  minimumOverallScore: 81,
  maximumRevisionIterations: 5,
  requiredViews: ['front', 'side', 'rear', 'front-three-quarter', 'rear-three-quarter'],
  requiredChecks: [
    'tube frame, cab shell, solid axles, links, and dampers remain visibly separate',
    'large tyres retain steering, suspension-travel, and body-clearance envelopes',
    'driver safety cell remains protected inside the tube frame',
    'engine, cooling, and steering do not consume the same front volume',
  ],
  rejectIfMissingCategories: ['structure', 'body', 'safety', 'corner', 'suspension', 'steering', 'powertrain', 'thermal'],
}

const ROAD_GOLDEN_PACK: VehicleKnowledgePack = {
  id: 'road-production-v1',
  vehicleClass: 'road',
  title: 'Production road vehicle',
  summary: 'A road-legal passenger-car grammar with distinct stamped volumes, human packaging, and serviceable systems.',
  components: [
    component('unibody-safety-cell', 'structure', 'Unibody safety cell', 'system', 'Define a rigid passenger cell, front and rear crash paths, and wheelhouse hard points.', 'reengineer'),
    component('front-crash-module', 'structure', 'Front crash module', 'system', 'Keep a sacrificial impact structure ahead of the primary cabin envelope.', 'reengineer'),
    component('exterior-body-shell', 'body', 'Exterior body shell', 'silhouette', 'Resolve hood, fenders, beltline, and rear volume as related stamped surfaces rather than one smooth pod.', 'style-only'),
    component('hood-and-fender-volumes', 'body', 'Hood and fender volumes', 'silhouette', 'Maintain clear hood shut-lines and fender crowns above the wheel arches.', 'preserve-proportions'),
    component('greenhouse-and-pillars', 'greenhouse', 'Greenhouse and pillars', 'silhouette', 'Use a believable windshield rake, roof crown, pillars, and side-glass opening.', 'preserve-proportions'),
    component('door-cutlines-and-handles', 'body', 'Door cut-lines and handles', 'close-up', 'Place serviceable door openings, handles, and rocker structure below the glass line.', 'style-only'),
    component('side-mirrors', 'visibility', 'Side mirrors', 'system', 'Mount mirrors where the driver can see them without colliding with glazing, A-pillars, or door sweep.', 'preserve-proportions'),
    component('road-lighting-signature', 'lighting', 'Road lighting signature', 'system', 'Integrate headlamps, tail lamps, reflectors, and mounting depth into the body shell.', 'style-only'),
    component('wheel-arches', 'body', 'Wheel arches', 'silhouette', 'Maintain tyre clearance through steering and bump travel, with an arch radius tied to wheel diameter.', 'preserve-proportions'),
    component('road-wheels-and-tyres', 'corner', 'Road wheels and tyres', 'system', 'Use tyre sidewall, rim diameter, and track width appropriate to ride height and intended use.', 'preserve-proportions'),
    component('suspension-kinematics', 'suspension', 'Suspension hard points', 'system', 'Anchor struts or control arms at credible wheelhouse and subframe locations.', 'reengineer'),
    component('steering-and-brakes', 'steering', 'Steering and brakes', 'close-up', 'Leave steering, brake rotor, and caliper packaging inside each wheel envelope.', 'reengineer'),
    component('occupant-cabin', 'cabin', 'Occupant cabin', 'system', 'Reserve seating, visibility, ingress, and dashboard volume beneath the greenhouse.', 'reengineer'),
    component('powertrain-envelope', 'powertrain', 'Powertrain envelope', 'system', 'Keep engine, motors, gearbox, exhaust, or inverter volumes compatible with the selected layout.', 'reengineer'),
    component('thermal-inlets-and-exits', 'thermal', 'Thermal inlets and exits', 'system', 'Size cooling openings as functional intake and outlet paths, not decorative black shapes.', 'reengineer'),
    component('rear-luggage-volume', 'cargo', 'Rear luggage volume', 'system', 'Reserve a serviceable luggage volume behind or beneath the rear seating/cabin package.', 'reengineer'),
    component('front-storage', 'cargo', 'Front storage volume', 'system', 'Add a frunk only when the front axle volume is not occupied by an engine, crash structure, or thermal module.', 'reengineer', { required: false, requiredWhen: ['battery-electric'] }),
    component('front-spoiler', 'aero', 'Front aero treatment', 'close-up', 'Treat splitters or small spoilers as body-integrated surfaces with practical approach clearance.', 'reengineer', { required: false, requiredWhen: ['front-wing', 'aero-package'] }),
    component('rear-spoiler', 'aero', 'Rear aero treatment', 'close-up', 'Mount a lip or wing to a credible deck or body support, sized for the vehicle envelope.', 'reengineer', { required: false, requiredWhen: ['rear-wing', 'aero-package'] }),
    component('underbody-diffuser', 'underbody', 'Underbody and diffuser', 'system', 'Use a protected floor and a modest rear expansion without compromising road clearance.', 'reengineer', { required: false, requiredWhen: ['diffuser', 'aero-package'] }),
  ],
  designAssumptions: [
    'Human ingress, visibility, lighting, and service access are first-class constraints.',
    'Production body surfaces use separate panels and believable shut-line logic.',
    'A reference cue may influence visual language, but its mounting geometry is recalculated for the target car.',
  ],
  fidelityPolicy: roadFidelity,
}

const FORMULA_GOLDEN_PACK: VehicleKnowledgePack = {
  id: 'formula-ground-effect-v1',
  vehicleClass: 'formula',
  title: 'Ground-effect Formula single-seater',
  summary: 'An original, open-wheel competition grammar with exposed mechanical systems and layered aero architecture.',
  components: [
    component('carbon-monocoque', 'structure', 'Carbon monocoque', 'silhouette', 'Keep a narrow centreline survival cell visibly independent from the exposed wheels.', 'reengineer'),
    component('front-crash-nose', 'structure', 'Front crash nose', 'system', 'Connect a narrow impact structure from monocoque to layered front wing.', 'reengineer'),
    component('open-cockpit', 'cabin', 'Open cockpit', 'silhouette', 'Use one shallow, open seating bay behind the front axle; never substitute a glazed road-car cabin.', 'reengineer'),
    component('halo', 'safety', 'Halo safety structure', 'system', 'Show a three-legged halo around the cockpit with a central forward pylon.', 'preserve-proportions'),
    component('formula-mirrors', 'visibility', 'Formula mirrors', 'close-up', 'Mount compact mirrors to the cockpit/sidepod structure outside the driver sightline.', 'reengineer'),
    component('front-wing-mainplane', 'aero', 'Front wing mainplane', 'silhouette', 'Span low and wide toward the front wheel planes as a distinct aero assembly.', 'preserve-proportions'),
    component('front-wing-flaps', 'aero', 'Front wing flap stack', 'system', 'Show multiple separated horizontal flap elements, not a single bumper blade.', 'preserve-proportions'),
    component('front-wing-endplates', 'aero', 'Front wing endplates', 'system', 'Use shaped vertical boundaries that route wake around the front tyres.', 'reengineer'),
    component('front-slick-tyres', 'corner', 'Front slick tyres', 'silhouette', 'Keep broad circular tyres uncovered and visually outside the chassis width.', 'preserve-proportions'),
    component('front-uprights-and-brake-ducts', 'braking', 'Front uprights and brake ducts', 'close-up', 'Package compact brake duct forms and upright detail inside each exposed wheel.', 'reengineer'),
    component('front-wishbones', 'suspension', 'Front wishbones', 'system', 'Expose paired suspension members between chassis, upright, and wheel centre.', 'reengineer'),
    component('sidepod-inlets', 'thermal', 'Sidepod cooling inlets', 'system', 'Place compact radiator inlets beside the cockpit, not as a road-car grille.', 'reengineer'),
    component('sidepod-undercuts', 'body', 'Sidepod undercuts', 'silhouette', 'Carve a deep undercut below the sidepod shoulder and taper it toward the rear floor.', 'preserve-proportions'),
    component('engine-cover-and-airbox', 'body', 'Engine cover and airbox', 'silhouette', 'Use a compact dorsal spine and roof-level intake behind the halo.', 'preserve-proportions'),
    component('floor-edge', 'underbody', 'Floor edge', 'silhouette', 'Run a low, long floor between both axles below the sidepod shoulder.', 'preserve-proportions'),
    component('floor-fences', 'aero', 'Floor fences', 'close-up', 'Use repeated thin vertical blades at the leading floor edge rather than a solid skirt.', 'reengineer'),
    component('venturi-tunnels', 'underbody', 'Venturi tunnels', 'system', 'Carry underfloor tunnel volume rearward into the diffuser without merging it into the body shell.', 'reengineer'),
    component('hybrid-power-unit-and-gearbox', 'powertrain', 'Hybrid power unit and gearbox', 'system', 'Package the power unit tightly behind the cockpit with a structural rear gearbox case.', 'reengineer'),
    component('rear-slick-tyres', 'corner', 'Rear slick tyres', 'silhouette', 'Use rear tyres wider than the fronts and visibly outside the diffuser and wing supports.', 'preserve-proportions'),
    component('rear-suspension', 'suspension', 'Rear suspension', 'system', 'Expose link members around gearbox, uprights, and rear wheel centres.', 'reengineer'),
    component('rear-brake-ducts', 'braking', 'Rear brake ducts', 'close-up', 'Keep compact ducting within each rear-wheel envelope.', 'reengineer'),
    component('diffuser-and-strakes', 'underbody', 'Diffuser and strakes', 'system', 'Show a wide diffuser exit divided into channels by vertical strakes.', 'preserve-proportions'),
    component('beam-wing', 'aero', 'Beam wing', 'system', 'Keep a lower wing visibly separated from the main rear wing and diffuser.', 'preserve-proportions'),
    component('rear-wing-and-endplates', 'aero', 'Rear wing and endplates', 'silhouette', 'Use a tall multi-element wing above the rear axle with shaped vertical endplates.', 'preserve-proportions'),
    component('rear-rain-light', 'lighting', 'Rear rain light', 'close-up', 'Place one small centreline rain light between rear wing and diffuser exit.', 'preserve-proportions'),
  ],
  designAssumptions: [
    'The target is an original competition car, never a replica of a named team chassis or livery.',
    'All four wheels, suspension members, and major aero assemblies must remain visually distinct.',
    'Downforce features are evaluated with cooling, ride height, tyre wake, and rear packaging together.',
  ],
  fidelityPolicy: formulaFidelity,
}

const MONSTER_GOLDEN_PACK: VehicleKnowledgePack = {
  id: 'monster-truck-mechanical-v1',
  vehicleClass: 'monster',
  title: 'Monster truck mechanical package',
  summary: 'A high-clearance tube-frame vehicle grammar where suspension travel, tyre clearance, and driver protection dominate styling.',
  components: [
    component('tube-frame-safety-cage', 'structure', 'Tube-frame safety cage', 'silhouette', 'Make the primary frame a readable set of triangulated tubes around the driver and drivetrain.', 'reengineer'),
    component('front-and-rear-crush-structure', 'structure', 'Front and rear crush structure', 'system', 'Keep bumper/crush members separate from the occupied safety cell.', 'reengineer'),
    component('fibreglass-body-shell', 'body', 'Fibreglass body shell', 'silhouette', 'Float a lightweight, removable body shell over the frame rather than treating it as a load-bearing pickup body.', 'style-only'),
    component('high-visibility-cab', 'greenhouse', 'High-visibility cab', 'silhouette', 'Use a simple windscreen and side opening that preserve driver sightlines above the front tyres.', 'preserve-proportions'),
    component('side-mirrors', 'visibility', 'Side mirrors', 'system', 'Mount mirrors to the body shell or cage outside tyre travel and door/cab sweep.', 'preserve-proportions'),
    component('driver-safety-cell', 'safety', 'Driver safety cell', 'system', 'Reserve seat, harness, roof bars, and egress space inside the cage.', 'reengineer'),
    component('solid-front-axle', 'corner', 'Solid front axle', 'system', 'Keep a visibly separate axle housing and steering knuckles beneath the chassis.', 'reengineer'),
    component('solid-rear-axle', 'corner', 'Solid rear axle', 'system', 'Show a rear axle housing that remains clear of the body throughout articulation.', 'reengineer'),
    component('beadlock-wheels-and-tyres', 'corner', 'Beadlock wheels and monster tyres', 'silhouette', 'Use massive tyre sidewalls and beadlock rims sized around suspension travel and track width.', 'preserve-proportions'),
    component('four-link-suspension', 'suspension', 'Four-link suspension', 'system', 'Expose four-link bars and joints running between frame rails and axle housings.', 'reengineer'),
    component('nitrogen-coilover-dampers', 'suspension', 'Nitrogen coilover dampers', 'system', 'Mount long-travel dampers at credible cage and axle brackets with full compression clearance.', 'reengineer'),
    component('steering-linkage', 'steering', 'Steering linkage', 'system', 'Keep steering links, drag link, and tie rod clear of axle and tyre travel.', 'reengineer'),
    component('large-brake-package', 'braking', 'Large brake package', 'close-up', 'Package brakes inside the wheels or near the axle without competing with steering and beadlocks.', 'reengineer'),
    component('front-engine-and-driveline', 'powertrain', 'Front engine and driveline', 'system', 'Reserve the front bay for engine, transmission, driveshaft, and axle routing.', 'reengineer'),
    component('high-capacity-radiator', 'thermal', 'High-capacity radiator', 'system', 'Feed cooling air through a protected front opening with a clear outlet path.', 'reengineer'),
    component('exhaust-and-fuel-safety', 'thermal', 'Exhaust and fuel safety', 'system', 'Route hot exhaust and protected fuel away from the driver cell and tyre envelopes.', 'reengineer'),
    component('approach-and-departure-protection', 'underbody', 'Approach and departure protection', 'system', 'Protect drivetrain and frame rails while preserving extreme approach, breakover, and departure angles.', 'reengineer'),
    component('front-storage', 'cargo', 'Front equipment bay', 'system', 'A front storage bay is possible only after an EV or rear-mounted powertrain leaves the front volume clear.', 'reengineer', { required: false, requiredWhen: ['battery-electric'] }),
    component('roof-and-work-lights', 'lighting', 'Roof and work lights', 'close-up', 'Mount lighting to protected cage/body hard points without blocking the driver view.', 'style-only'),
    component('rear-stabilising-wing', 'aero', 'Rear stabilising wing', 'close-up', 'Use only a modest, robust rear aero surface that survives high-clearance off-road operation.', 'reengineer', { required: false, requiredWhen: ['rear-wing'] }),
  ],
  designAssumptions: [
    'Tyre clearance and suspension articulation take priority over flush production-car surfacing.',
    'The body shell is visually and structurally separate from the tube frame.',
    'Any borrowed road-car feature must clear the front engine, axle sweep, approach angle, and cage mounting points.',
  ],
  fidelityPolicy: monsterFidelity,
}

function derivedPack(
  vehicleClass: VehicleClass,
  id: string,
  title: string,
  summary: string,
  base: VehicleKnowledgePack,
  additions: readonly VehicleComponentDefinition[],
  assumptions: readonly string[],
  fidelityPolicy: FidelityPolicy = roadFidelity,
): VehicleKnowledgePack {
  return {
    id,
    vehicleClass,
    title,
    summary,
    components: [...base.components, ...additions],
    designAssumptions: [...base.designAssumptions, ...assumptions],
    fidelityPolicy,
  }
}

export const VEHICLE_KNOWLEDGE_PACKS: Readonly<Record<VehicleClass, VehicleKnowledgePack>> = {
  road: ROAD_GOLDEN_PACK,
  formula: FORMULA_GOLDEN_PACK,
  monster: MONSTER_GOLDEN_PACK,
  gt: derivedPack(
    'gt', 'gt-long-distance-v1', 'Grand touring vehicle',
    'A long-distance performance car with high-speed stability, thermal capacity, and a defined luggage/cabin package.',
    ROAD_GOLDEN_PACK,
    [
      component('rear-transaxle', 'powertrain', 'Rear transaxle', 'system', 'Balance front-mid engine packaging with a credible rear gearbox/differential envelope.', 'reengineer'),
      component('high-speed-underbody', 'underbody', 'High-speed underbody', 'system', 'Control lift with a protected floor and diffuser tuned for road clearance.', 'reengineer'),
    ],
    ['Long-distance thermal margin and occupant comfort remain valid even for aggressive exterior aero.'],
  ),
  rally: derivedPack(
    'rally', 'rally-loose-surface-v1', 'Loose-surface rally vehicle',
    'A compact competition shell with raised clearance, protection, cooling resilience, and visibly functional wheel travel.',
    ROAD_GOLDEN_PACK,
    [
      component('roll-cage', 'safety', 'Roll cage', 'system', 'Integrate a visible safety cage inside the production-derived passenger cell.', 'reengineer'),
      component('gravel-guards', 'body', 'Gravel guards', 'system', 'Protect lower bodywork, lamps, and wheel openings from loose-surface damage.', 'reengineer'),
      component('long-travel-dampers', 'suspension', 'Long-travel dampers', 'system', 'Maintain tyre clearance through raised ride height and loose-surface wheel travel.', 'reengineer'),
    ],
    ['Loose-surface durability, cooling protection, and serviceability outweigh flush aero surfacing.'],
  ),
  suv: derivedPack(
    'suv', 'suv-utility-v1', 'Utility SUV',
    'A five-seat utility vehicle with a tall greenhouse, protected underbody, and all-weather packaging.',
    ROAD_GOLDEN_PACK,
    [
      component('raised-roof-and-third-row-envelope', 'cabin', 'Raised cabin envelope', 'system', 'Reserve vertical seating, headroom, and optional third-row packaging.', 'reengineer'),
      component('underbody-protection', 'underbody', 'Underbody protection', 'system', 'Protect the battery/exhaust and suspension while retaining useful ground clearance.', 'reengineer'),
    ],
    ['Cabin volume, weather sealing, and all-weather stability take priority over sports-car roof height.'],
  ),
  truck: derivedPack(
    'truck', 'pickup-workhorse-v1', 'Pickup truck',
    'A body-on-frame work vehicle with a separate cab, cargo bed, towing loads, and high payload hard points.',
    ROAD_GOLDEN_PACK,
    [
      component('ladder-frame', 'structure', 'Ladder frame', 'system', 'Separate cab, bed, drivetrain, and towing loads across a durable frame.', 'reengineer'),
      component('cargo-bed', 'cargo', 'Cargo bed', 'silhouette', 'Use a clearly independent bed with wheel tubs, tailgate, and payload floor.', 'preserve-proportions', { required: false, requiredWhen: ['cargo-bed'] }),
      component('tow-hitch-and-recovery', 'structure', 'Tow hitch and recovery points', 'system', 'Anchor towing and recovery hardware to the frame rather than decorative bumper skin.', 'reengineer'),
    ],
    ['Cargo volume, payload, towing paths, and cab/bed separation remain visible design constraints.'],
  ),
  ev: derivedPack(
    'ev', 'ev-skateboard-v1', 'Electric performance vehicle',
    'A battery-electric passenger vehicle with a protected floor battery, thermal hardware, and optional front cargo volume.',
    ROAD_GOLDEN_PACK,
    [
      component('structural-battery-pack', 'powertrain', 'Structural battery pack', 'system', 'Use a protected, low floor battery envelope between the axles.', 'reengineer'),
      component('inverters-and-e-axles', 'powertrain', 'Inverters and e-axles', 'system', 'Package motors, inverters, and cooling loops at credible axle locations.', 'reengineer'),
      component('charge-port-and-high-voltage-safety', 'electronics', 'Charge port and high-voltage safety', 'close-up', 'Place charging access and high-voltage isolation hardware outside crash and water-intrusion paths.', 'reengineer'),
    ],
    ['Battery protection, thermal rejection, and charging access are engineered systems, not styling afterthoughts.'],
  ),
}

export function getVehicleKnowledgePack(vehicleClass: VehicleClass): VehicleKnowledgePack {
  return VEHICLE_KNOWLEDGE_PACKS[vehicleClass]
}

/** A small integration hook for evaluators that only need quality thresholds. */
export function getFidelityPolicy(target: VehicleClass | VehicleSpec): FidelityPolicy {
  return getVehicleKnowledgePack(typeof target === 'string' ? target : target.vehicleClass).fidelityPolicy
}

function satisfiesRequirement(spec: VehicleSpec, requirement: ComponentRequirement): boolean {
  switch (requirement) {
    case 'aero-package': return spec.frontWing >= 0.12 || spec.rearWing >= 0.12 || spec.diffuserDepth >= 0.1
    case 'front-wing': return spec.frontWing >= 0.12
    case 'rear-wing': return spec.rearWing >= 0.12
    case 'diffuser': return spec.diffuserDepth >= 0.1
    case 'battery-electric': return spec.powertrain === 'EV'
    case 'combustion-or-hybrid': return spec.powertrain === 'ICE' || spec.powertrain === 'Hybrid'
    case 'cargo-bed': return spec.vehicleClass === 'truck' || spec.vehicleClass === 'monster'
    case 'high-clearance': return spec.rideHeight >= 0.2
    case 'road-legal': return spec.vehicleClass !== 'formula'
  }
}

/** Returns the component graph nodes the target design must resolve at this revision. */
export function getRequiredComponents(spec: VehicleSpec): readonly VehicleComponentDefinition[] {
  return getVehicleKnowledgePack(spec.vehicleClass).components.filter((definition) => (
    definition.required || definition.requiredWhen?.some((requirement) => satisfiesRequirement(spec, requirement))
  ))
}

const unique = (items: readonly string[]) => [...new Set(items)]

/**
 * Compiles explicit, inspectable assumptions from class knowledge and the
 * active vehicle schema. It makes implicit packaging trade-offs visible in
 * the chat/log without adding LLM-generated hidden reasoning.
 */
export function getDesignAssumptions(spec: VehicleSpec): readonly string[] {
  const assumptions = [...getVehicleKnowledgePack(spec.vehicleClass).designAssumptions]

  if (spec.powertrain === 'EV') {
    assumptions.push('Battery, high-voltage isolation, and thermal paths are reserved between or near the axles.')
  } else if (spec.powertrain === 'Hybrid') {
    assumptions.push('Combustion, hybrid energy storage, exhaust, and cooling are packaged as separate serviceable volumes.')
  } else {
    assumptions.push('Combustion powertrain, exhaust heat shielding, fuel storage, and cooling paths remain physically separated.')
  }

  if (spec.frontWing >= 0.12 || spec.rearWing >= 0.12 || spec.diffuserDepth >= 0.1) {
    assumptions.push('Aero surfaces are scaled against ride height, cooling flow, tyre wake, and mounting loads rather than pasted onto the body.')
  }
  if (spec.rideHeight >= 0.2) {
    assumptions.push('Raised ride height requires additional wheel-travel, rollover, and underbody-protection checks.')
  }
  if (spec.referenceCue) {
    assumptions.push('The named reference is translated into compatible visual cues; its original dimensions and mounting points are not copied directly.')
  }

  return unique([...assumptions, ...spec.assumptions])
}

const foundationalCategories = new Set<VehicleComponentCategory>(['structure', 'suspension', 'steering', 'braking', 'powertrain', 'safety'])

/**
 * Decides whether a named-market reference can be applied to this design.
 * It intentionally returns adaptation work, not a yes/no style transfer:
 * a familiar mirror may transfer; an ICE monster truck cannot gain a frunk
 * without first changing its powertrain and front packaging.
 */
export function assessReferenceComponentAdaptation(
  target: VehicleSpec,
  reference: ReferenceComponentRequest,
): ReferenceAdaptationDecision {
  const pack = getVehicleKnowledgePack(target.vehicleClass)
  const required = getRequiredComponents(target)
  const exactMatch = pack.components.find((componentDefinition) => componentDefinition.id === reference.componentId)
  const categoryMatch = pack.components.find((componentDefinition) => componentDefinition.category === reference.category)
  const targetComponent = exactMatch ?? categoryMatch

  if (!targetComponent) {
    return {
      status: 'blocked',
      reason: `The ${pack.title} pack has no compatible ${reference.category} component for ${reference.componentId}.`,
      requiredChanges: ['Choose a target component already supported by the vehicle architecture or explicitly redesign the package.'],
    }
  }

  if (reference.componentId === 'front-storage' && target.powertrain !== 'EV') {
    return {
      status: 'blocked',
      targetComponent,
      reason: 'The target front volume is reserved for a combustion/hybrid powertrain, crash structure, or thermal package.',
      requiredChanges: [
        'Move the powertrain away from the front axle or select an EV architecture.',
        'Re-run crash, cooling, steering, and approach-angle packaging before adding storage.',
      ],
    }
  }

  if (foundationalCategories.has(reference.category) && reference.sourceVehicleClass && reference.sourceVehicleClass !== target.vehicleClass) {
    return {
      status: 'blocked',
      targetComponent,
      reason: `${reference.category} architecture cannot be copied across vehicle classes as a visual accessory.`,
      requiredChanges: ['Use the target class component as the engineering base and transfer only non-structural visual cues.'],
    }
  }

  if (reference.sourceVehicleClass === target.vehicleClass && exactMatch) {
    return {
      status: 'compatible',
      targetComponent,
      reason: 'The requested reference component exists in the same vehicle architecture and can preserve its measured visual proportions.',
      requiredChanges: ['Verify local mounting points, clearance, visibility, and regulatory/physical constraints for the active dimensions.'],
    }
  }

  const adaptationAction = targetComponent.referenceAdaptation === 'style-only'
    ? 'Transfer the visual language only; redraw the target geometry from its own hard points.'
    : targetComponent.referenceAdaptation === 'preserve-proportions'
      ? 'Preserve the recognisable ratio or silhouette cue, then scale and remount it for the target envelope.'
      : 'Re-engineer the part around target hard points, loads, safety structure, and service access.'

  return {
    status: 'adaptable',
    targetComponent,
    reason: `The ${reference.sourceLabel ?? reference.componentId} can inform ${targetComponent.label}, but requires class-aware adaptation.`,
    requiredChanges: [
      adaptationAction,
      'Check wheel travel, visibility, cooling, crash paths, and occupied volumes before committing the revision.',
      `Keep the target component ${required.some((componentDefinition) => componentDefinition.id === targetComponent.id) ? 'visible in the required component graph' : 'as an optional, explicitly approved package'}.`,
    ],
  }
}
