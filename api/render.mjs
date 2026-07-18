import { buildSupportedImagePayloadOptions, selectReferenceLockedImageModel } from './imageModelRouter.mjs'

function asSafeSpec(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const source = input
  const text = (key, fallback = '') => typeof source[key] === 'string' ? source[key].slice(0, 180) : fallback
  const number = (key, fallback = 0) => typeof source[key] === 'number' && Number.isFinite(source[key]) ? source[key] : fallback
  return {
    name: text('name', 'Aether Concept'), vehicleClass: text('vehicleClass', 'road'), bodyColor: text('bodyColor', '#d8d8d8'),
    accentColor: text('accentColor', '#67d9cf'), powertrain: text('powertrain', 'EV'), engineLayout: text('engineLayout', 'dual motor'),
    roofProfile: text('roofProfile', 'fastback'), suspensionType: text('suspensionType', 'adaptive suspension'),
    overallLength: number('overallLength', 4.7), overallWidth: number('overallWidth', 1.9), overallHeight: number('overallHeight', 1.3),
    wheelbase: number('wheelbase', 2.9), frontTrack: number('frontTrack', 1.65), rearTrack: number('rearTrack', 1.65),
    wheelRadius: number('wheelRadius', 0.35), tireWidth: number('tireWidth', 0.27), rideHeight: number('rideHeight', 0.12),
    groundClearance: number('groundClearance', 0.12), coolingIntake: number('coolingIntake', 0.2), frontWing: number('frontWing'),
    rearWing: number('rearWing'), diffuserDepth: number('diffuserDepth'),
  }
}

function asSafeAlignmentReference(input) {
  if (typeof input !== 'string' || input.length > 2_000_000) return null
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input)
  if (!match) return null
  const encoded = match[2]
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const bytes = Math.floor(encoded.length * 3 / 4) - padding
  return bytes > 0 && bytes <= 1_400_000 ? input : null
}

function asSafeBrief(input) {
  return typeof input === 'string' ? input.replace(/[\r\n]+/g, ' ').slice(0, 1400) : ''
}

function buildPrompt(spec, alignmentBrief, hasReference, refinementInstruction) {
  const kind = spec.vehicleClass === 'formula' ? 'open-wheel Formula-style racing car' : `${spec.vehicleClass} vehicle`
  return [
    'Photorealistic premium automotive press photograph, not a toy, not a scale model, not low-poly 3D, not a concept sketch.',
    hasReference
      ? 'GEOMETRY LOCK: the attached engineering reference sheet is the source of truth. Preserve its exact silhouette, wheel centers and diameter, wheelbase and track proportions, cabin/roof placement, body class, aero placement, and camera-side orientation. Improve materials, panel surfacing, glass, lighting, and manufacturing detail only. Do not add, delete, stretch, shrink, or relocate visible geometry.'
      : 'GEOMETRY LOCK: preserve the following dimensions and body proportions exactly; do not invent a different vehicle silhouette.',
    `An original ${kind} called ${spec.name}, with realistic full-size automotive proportions.`,
    `Body: ${spec.bodyColor}; accents: ${spec.accentColor}; powertrain: ${spec.powertrain}; layout: ${spec.engineLayout}.`,
    `Envelope: ${Math.round(spec.overallLength * 1000)} mm overall length, ${Math.round(spec.overallWidth * 1000)} mm width, ${Math.round(spec.overallHeight * 1000)} mm height.`,
    `Rolling geometry: ${Math.round(spec.wheelbase * 1000)} mm wheelbase, ${Math.round(spec.frontTrack * 1000)} mm front track, ${Math.round(spec.rearTrack * 1000)} mm rear track, ${Math.round(spec.wheelRadius * 2000)} mm wheel diameter, ${Math.round(spec.tireWidth * 1000)} mm tire width, ${Math.round(spec.rideHeight * 1000)} mm ride height.`,
    `Architecture: ${spec.roofProfile} roof, ${spec.suspensionType} suspension, ${Math.round(spec.groundClearance * 1000)} mm clearance, ${Math.round(spec.coolingIntake * 100)}% cooling intake.`,
    alignmentBrief,
    refinementInstruction ? `MANDATORY REFINEMENT: ${refinementInstruction}` : '',
    `Aero: front wing ${Math.round(spec.frontWing * 100)}%, rear wing ${Math.round(spec.rearWing * 100)}%, ${Math.round(spec.diffuserDepth * 1000)} mm diffuser.`,
    'Three-quarter front exterior view at eye level, premium dark automotive photo studio, large softbox reflections, realistic paint, glass, rubber tires, panel gaps, brakes, road-scale wheels, subtle floor reflection, cinematic but believable.',
    'No text, no watermark, no visible logos, no copied production-car design, no people, no miniature diorama.',
  ].join(' ')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
  if ((process.env.LLM_PROVIDER || '').toLowerCase() !== 'openrouter') return res.status(503).json({ error: 'Set LLM_PROVIDER=openrouter in .env.local to enable Photo Render' })
  if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'Add a fresh OPENROUTER_API_KEY to .env.local to enable Photo Render' })
  const spec = asSafeSpec(req.body?.spec)
  if (!spec) return res.status(400).json({ error: 'A vehicle spec is required' })
  const requestedReference = req.body?.alignmentReference
  const alignmentReference = requestedReference ? asSafeAlignmentReference(requestedReference) : null
  if (!alignmentReference) return res.status(400).json({ error: 'Photo render requires a PNG, JPEG, or WebP geometry reference below 1.4 MB' })
  const prompt = buildPrompt(spec, asSafeBrief(req.body?.alignmentBrief), true, asSafeBrief(req.body?.refinementInstruction))
  const configuredImageModel = process.env.OPENROUTER_REFERENCE_IMAGE_MODEL || process.env.OPENROUTER_IMAGE_MODEL || 'bytedance-seed/seedream-4.5'
  try {
    const selectedImageModel = await selectReferenceLockedImageModel({
      configuredModel: configuredImageModel,
      hasGeometryReference: true,
      apiKey: process.env.OPENROUTER_API_KEY,
    })
    const imageRequest = {
      model: selectedImageModel.model,
      prompt,
      ...buildSupportedImagePayloadOptions(selectedImageModel.capabilities, {
        n: 1,
        resolution: process.env.OPENROUTER_IMAGE_RESOLUTION || '2K',
        aspectRatio: '16:9',
        outputFormat: 'webp',
        quality: 'high',
        background: 'opaque',
        inputReferences: [{ type: 'image_url', image_url: { url: alignmentReference } }],
        requireReference: true,
      }),
    }
    const apiResponse = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        ...(process.env.APP_URL ? { 'HTTP-Referer': process.env.APP_URL } : {}),
        'X-Title': 'Aether Automotive Intelligence',
      },
      body: JSON.stringify(imageRequest),
    })
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      let errorMessage = errorText
      try {
        const parsed = JSON.parse(errorText)
        errorMessage = parsed?.error?.message || parsed?.message || errorText
      } catch {
        // Retain non-JSON provider error text without exposing server configuration.
      }
      return res.status(apiResponse.status).json({ error: errorMessage })
    }
    const payload = await apiResponse.json()
    const image = payload.data?.[0]
    if (!image?.b64_json) return res.status(502).json({ error: 'Image provider returned no raster image' })
    const mediaType = image.media_type || 'image/webp'
    return res.status(200).json({ imageDataUrl: `data:${mediaType};base64,${image.b64_json}`, prompt, model: selectedImageModel.model, referenceLocked: true })
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Photo render failed' })
  }
}
