# Aether Automotive Intelligence

A local-first, physics-grounded automotive concept studio built for a hackathon. It treats the model as an engineering planner—not a mesh generator: every visual revision is built from a typed `VehicleSpec` consumed by a procedural React Three Fiber scene.

## Run locally

```bash
npm install
npm run dev
```

The default runtime is fully local and deterministic. It supports road cars, Formula-style cars, GTs, rally cars, SUVs, pickups, EVs, and monster trucks; the prompt determines the active vehicle pack.

## What is included

- 30/70 desktop CAD layout with a conversational design desk and live Three.js workspace.
- Solid, wireframe, blueprint, structural, exploded, and component-aware aerodynamic-flow views. The overlay traces body, wheel-wake, cooling, underbody, and aero-surface paths from the active component graph rather than running one generic particle field through every vehicle.
- Typed, schema-only design engine with Planner → Research → Engineering → Geometry → Critic → Renderer stages.
- Class-aware `VehicleKnowledgePack` component graphs for road, Formula, GT, rally, SUV, truck, EV, and monster-truck packages; road, Formula, and monster are the first detailed golden packs.
- Compact generate → critique → score → revise loop with realism, aero, manufacturability, packaging, stability, originality, and consistency metrics.
- Local version history, undo/redo, branching, and animated procedural revision changes.
- Reference-aware design cues: a named production-car feature is translated, scaled, mounted, and validated for the requested target vehicle rather than copied as a mesh.
- Project-local reference research cache with compatibility guards, so an unsafe transplant is recorded and blocked rather than cosmetically pasted onto a different vehicle class.
- Physics-grounded default behavior without applying regulations unless requested.

## Terra runtime (optional)

The UI falls back to the deterministic local engine unless `VITE_TERRA_LIVE=true`. For a serverless deployment, `api/design.mjs` supports `LLM_PROVIDER=openrouter` with `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`, or direct OpenAI with `OPENAI_API_KEY` and `OPENAI_MODEL`. It keeps the key server-side and asks the model for a constrained semantic patch only. Named vehicle references enable the provider's web-search capability. The client validates the patch and discards anything outside the vehicle schema, including any mesh/scene-shaped payload.

For local live testing, create an untracked `.env.local` beside `package.json` (never put a key in source control):

```bash
VITE_TERRA_LIVE=true
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=replace-with-a-fresh-key
OPENROUTER_MODEL=openai/gpt-5.6-terra
OPENROUTER_IMAGE_MODEL=bytedance-seed/seedream-4.5
OPENROUTER_REFERENCE_IMAGE_MODEL=bytedance-seed/seedream-4.5
OPENROUTER_IMAGE_RESOLUTION=2K
```

`npm run dev` now serves the same local `/api/design` and `/api/render` routes, so no separate deployment is needed for the hackathon demo. The default reference-locked Photo model is Seedream 4.5; change `OPENROUTER_REFERENCE_IMAGE_MODEL` when you want another model. Before a photo request, the server queries OpenRouter's image-capability metadata and refuses a model that cannot accept the generated geometry reference. The **Photo** tab remains a fast parametric studio preview offline; with OpenRouter configured, **Generate Photo Render** sends a generated multi-view engineering sheet, class component brief, and active schema to `api/render.mjs`. The visual critic may make one correction pass, and a photo that still drifts is withheld so the procedural model remains canonical. Images are invalidated automatically when a newer revision is created.

The current model routing intentionally uses Terra as the balanced default; keep the model ID configurable for hackathon deployment.

## Important framing

Scores, flow, structural, and packaging feedback are transparent concept-engineering heuristics. The aero view identifies every required system and reports pressure/wake cues plus a conceptual drag/load estimate, but it is not a CFD solve. Final aerodynamic decisions require a watertight mesh, boundary conditions, mesh-quality checks, a validated turbulence model, and wind-tunnel or track correlation; the app says this directly instead of inventing precision.

## Terra UltraHigh directions

1. Reference DNA Fusion — extract and adapt functional design cues from a vehicle name, URL, or image.
2. Pareto Design Forge — branch into aero-first, utility-first, and originality-first schema alternatives.
3. Physics X-Ray — expose CG, suspension travel, wheel clearance, cooling path, and load-path overlays.
4. Red-Team Failure Lab — ask what breaks first under braking, cornering, heat, jumps, or high speed.
5. Evidence drawer — show concise source links and parameter deltas without dumping an agent transcript.
