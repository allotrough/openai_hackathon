# Aether architecture

## Purpose and priority

Aether is primarily a **constraint-driven automotive design harness**. Its job is to turn a design request into a typed, explainable `VehicleSpec`, test that proposal against class-specific engineering heuristics, revise the weakest constraint, and retain a traceable design history.

The 3D viewport and AI photo render are supporting presentation capabilities. They consume the approved design state; they must not become the source of truth for dimensions, component choices, or engineering claims.

> Current terminology matters: the application has a procedural 3D viewport and an optional 2D AI photo renderer. It does not yet produce an exportable, production-grade 3D car model.

## System overview

```mermaid
flowchart LR
  U[User request or reference image] --> UI[React design desk]
  UI --> H[Design harness]
  H --> P[Intent planner]
  P --> K[Class knowledge pack and component graph]
  K --> E[Engineering scorer and revision loop]
  E --> S[(Typed VehicleSpec + design revision)]
  S --> V[Procedural Three.js viewport]
  S --> A[Aero and structural overlays]
  S --> R[Optional photo-render sidecar]

  UI -. live mode only .-> API[/api/design]
  API --> M[Remote planning model]
  M --> API
  API --> G[Schema and bounds guard]
  G --> H

  R --> RR[Engineering reference sheet]
  RR --> IMG[Reference-capable image model]
  IMG --> VC[Optional visual critic]
  VC --> UI
```

## Design harness: the core system

The harness is intentionally a logical multi-agent system, not a collection of unconstrained autonomous processes. Each role has a narrow input/output contract and all durable state is a `VehicleSpec` plus an iteration log.

| Logical role | Responsibility | Current implementation |
| --- | --- | --- |
| Intent / Planner | Classifies vehicle intent and starts from an appropriate vehicle pack. | `compileIntent()` in `src/lib/engineering.ts` |
| Research | Captures compatible cues from a named vehicle or user image. | Local reference catalogue; optional web-enabled remote planner |
| Vehicle Engineering | Applies packaging, powertrain, suspension, clearance, cooling, and aero assumptions. | Class packs and deterministic intent rules |
| Geometry | Converts the approved spec into a class-aware geometry recipe and component layout. | `vehicleGeometry.ts` and `VehicleViewport.tsx` |
| Critic | Scores realism, aero, manufacturability, packaging, stability, originality, and consistency; identifies the weakest dimension. | `scoreSpec()`, `weightedScore()`, and `reviseForLowestScore()` |
| Renderer | Presents the same approved spec in solid, wireframe, blueprint, structural, and studio views. | React Three Fiber viewport and overlays |

`runAgenticLoop()` is the harness coordinator. For each iteration it scores the design, applies one focused revision to the lowest-scoring concern when needed, records the decision, and stops when it reaches the class quality gate or iteration limit. The UI exposes those role states as an execution trace.

This is deliberately sequential and deterministic in the default runtime. It provides repeatable results, makes individual stages testable, and prevents a visual-generation model from silently changing the vehicle's semantic design. It should be described as a **multi-agent workflow** or **logical agent harness**; it is not currently a fleet of concurrently running LLM agents.

## Authoritative data flow

`VehicleSpec` in `src/types.ts` is the canonical contract. It contains the vehicle class, dimensions, wheel package, ride height, powertrain, component-relevant aero values, colours, assumptions, and reference cues.

1. The design desk receives a request and optional image attachment.
2. `runDesignTurn()` compiles intent into a candidate `VehicleSpec`.
3. The harness consults the class knowledge pack and required component graph.
4. The critic scores and may revise the candidate.
5. A `DesignRevision` stores the resulting spec, summary, research cache, score logs, and branch/version metadata in browser local storage.
6. All renderers and overlays consume that stored spec.

No renderer is allowed to write dimensions back into the spec. This one-way flow is what keeps the design explainable and makes revision history meaningful.

## Optional remote-planning boundary

Live mode is opt-in through `VITE_TERRA_LIVE=true`. The browser calls `/api/design`; provider credentials remain on the server.

The remote model is an advisor, not an authority:

- It is given the current spec and a compact class-knowledge context.
- It can return only a JSON semantic patch, not mesh data, shaders, scene graphs, or arbitrary application state.
- The API uses a strict JSON schema, and `sanitizePatch()` clamps numerical fields, accepts only supported classes/roof/powertrain values, and discards unknown data.
- The local harness merges only the validated patch, then runs the same deterministic evaluation loop.

This boundary lets a model improve interpretation or research while preserving a reproducible engineering and rendering pipeline.

## Primary use cases

### 1. Constraint-aware concept exploration

**User need:** An automotive designer wants to explore a new vehicle direction without losing track of packaging, stance, vehicle class, or manufacturability.

**Flow:** The designer enters a request such as “a compact electric GT with a low canopy and usable front storage.” The intent role selects the EV or GT starting pack, the knowledge harness provides its required systems, and the critic revises only the weakest concern until the concept gate passes. The result is a versioned `VehicleSpec`, explicit assumptions, scores, and a renderable explanation of the decision.

**Value:** Fast ideation without allowing visual style alone to erase functional constraints.

### 2. Design-review decision trace

**User need:** A product, engineering, or hackathon-review team needs to understand why a design changed between revisions.

**Flow:** Each iteration records the score breakdown, the identified issue, the targeted revision, agent-stage status, and the final assumptions. Branching, undo, and redo retain alternatives without overwriting the approved path.

**Value:** The team can discuss a decision such as “widened rear track to improve stability” instead of comparing unexplained images.

### 3. Reference-aware adaptation

**User need:** A designer wants inspiration from a named vehicle or user-provided image without copying an incompatible design.

**Flow:** The research role extracts adaptable cues, such as lamp graphic, glasshouse posture, or intake character. The knowledge harness checks mounting, scale, component compatibility, and class requirements before the cue is included in the active spec.

**Value:** References remain auditable design inputs, not hidden mesh copying or brand replication.

### 4. Live planning with controlled model assistance

**User need:** A team wants richer interpretation of vague requests or concise research evidence while keeping the application reliable.

**Flow:** In opt-in live mode, the remote model returns a strict semantic patch. Server-side schema enforcement and client-side bounds sanitisation reject unsupported fields; the deterministic local harness then performs the actual scoring and revision.

**Value:** Model capability improves planning while typed state, security, and repeatability remain under application control.

### 5. Stakeholder visual communication (secondary)

**User need:** A stakeholder needs to see the approved concept in a studio, blueprint, structural, or airflow view.

**Flow:** The procedural viewport renders the canonical spec. The optional AI photo sidecar may create a realistic mood image from the same approved reference sheet and label or withhold it according to visual-fidelity review.

**Value:** Visual communication supports the review process without replacing its authoritative data.

## Knowledge, reference, and quality harnesses

The system has three complementary harnesses:

1. **Design harness** — the planner, knowledge pack, deterministic critic, targeted revision, and iteration log.
2. **Knowledge harness** — class-specific required systems, fidelity policies, geometry recipes, and reference-compatibility rules. A named production car is translated into compatible cues rather than copied as a mesh or brand identity.
3. **Verification harness** — Vitest coverage for intent/design turns, geometry profiles, knowledge packs, fidelity policies, aero-flow plans, reference catalogues, studio prompts, and image-model routing.

For stronger regression coverage, maintain a small golden fixture matrix across road, Formula, GT, rally, SUV, truck, EV, and monster-truck classes. Each fixture should assert dimensional bounds, required components, quality-gate behaviour, and expected revision direction. Photo-quality checks should remain separate from deterministic engineering tests because an image model is probabilistic.

## Presentation sidecars

### Procedural 3D viewport

The Three.js viewport is a deterministic visual explanation of the approved spec. `getGeometryProfile()` chooses a class-aware recipe; `VehicleViewport` adds the body, cabin, wheels, aero components, structural view, and airflow overlays. It is useful for discussing proportions and systems, but its current primitive-based geometry is a concept representation rather than CAD or a deliverable car mesh.

### Optional AI photo render

The Photo tab creates a technical reference sheet from the active spec and sends that image, a component brief, and the approved dimensions to a reference-capable image model. A visual critic can request one refinement pass; a failed review withholds the image and leaves the procedural model as the canonical view.

This sidecar is intentionally downstream of the harness:

```text
approved VehicleSpec -> technical reference -> AI photo -> optional fidelity review
```

It must never be treated as evidence that a real 3D model, exact CAD surface, or production-car replica exists. If the critic is unavailable, the UI should identify the photo as unverified rather than implying geometry certification.

## Path to a real exportable 3D asset

When an actual 3D deliverable is needed, extend the authoritative path rather than asking an image model to invent a car:

1. Move vehicle assembly into a pure `createVehicleScene(spec)` factory shared by the viewport and exporter.
2. Export the resulting scene as GLB/glTF with metre units, named nodes, PBR materials, and preserved wheel transforms.
3. Add deterministic geometry checks: bounding box, wheelbase, tracks, wheel diameter, ground clearance, component presence, and clearance/collision constraints.
4. Render fixed orthographic and hero views from the exported asset for visual regression tests and photo-reference generation.
5. Use AI only for material/look-development variants or non-authoritative marketing imagery.

An exact replica of an existing production car needs licensed CAD, scans, or measured reference data plus manual/topology-controlled modelling. Image-to-image generation cannot guarantee panel geometry or multi-view consistency.

## Operating principles

- Typed design state is authoritative; generated pixels are not.
- Every model boundary is schema-limited and validated.
- Deterministic stages are preferred for dimensions, component placement, scoring, and history.
- Heuristic aero/engineering scores are transparent concept guidance, not CFD or certification.
- Reference inspiration is adapted to the active vehicle package and must not become a copied production design.
- The main product is the auditable design harness; rendering exists to help people inspect and communicate its decisions.
