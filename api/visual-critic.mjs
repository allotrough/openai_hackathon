function asSafeDataUrl(input, maxBytes) {
  if (typeof input !== 'string' || input.length > maxBytes * 1.5) return null
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input)
  if (!match) return null
  const encoded = match[2]
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const bytes = Math.floor(encoded.length * 3 / 4) - padding
  return bytes > 0 && bytes <= maxBytes ? input : null
}

function cleanText(input, maxLength) {
  return typeof input === 'string'
    ? input.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : ''
}

function asSafeSpec(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const source = input
  const text = (key, fallback = '') => typeof source[key] === 'string' ? source[key].slice(0, 120) : fallback
  const number = (key, fallback = 0) => typeof source[key] === 'number' && Number.isFinite(source[key]) ? source[key] : fallback
  return {
    vehicleClass: text('vehicleClass', 'road'), roofProfile: text('roofProfile', 'fastback'), engineLayout: text('engineLayout', 'unknown'),
    wheelbase: number('wheelbase'), frontTrack: number('frontTrack'), rearTrack: number('rearTrack'), wheelRadius: number('wheelRadius'),
    overallLength: number('overallLength'), overallWidth: number('overallWidth'), overallHeight: number('overallHeight'),
  }
}

function defaultReview(spec) {
  return {
    label: `${spec.vehicleClass} vehicle`,
    brief: '',
    requiredSystems: spec.vehicleClass === 'formula'
      ? ['open-wheel layout', 'layered front wing', 'exposed suspension', 'open cockpit and halo', 'ground-effect floor', 'rear diffuser and wing']
      : ['body silhouette', 'wheel positions', 'cabin placement', 'lighting', 'functional exterior systems'],
    thresholds: { passScore: 76, retryBelow: 70, maxMissingRequiredSystems: 1, maxMajorDrifts: 1, minimumReferenceViews: 4 },
  }
}

function asSafeReview(input, fallback) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fallback
  const source = input
  const thresholdInput = source.thresholds && typeof source.thresholds === 'object' && !Array.isArray(source.thresholds)
    ? source.thresholds
    : {}
  const boundedInteger = (value, fallbackValue, minimum, maximum) => {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallbackValue
    return Math.max(minimum, Math.min(maximum, numeric))
  }
  const requiredSystems = Array.isArray(source.requiredSystems)
    ? source.requiredSystems.map((item) => cleanText(item, 180)).filter(Boolean).slice(0, 12)
    : fallback.requiredSystems
  return {
    label: cleanText(source.label, 96) || fallback.label,
    brief: cleanText(source.brief, 2100),
    requiredSystems: requiredSystems.length ? requiredSystems : fallback.requiredSystems,
    thresholds: {
      passScore: boundedInteger(thresholdInput.passScore, fallback.thresholds.passScore, 60, 96),
      retryBelow: boundedInteger(thresholdInput.retryBelow, fallback.thresholds.retryBelow, 45, 92),
      maxMissingRequiredSystems: boundedInteger(thresholdInput.maxMissingRequiredSystems, fallback.thresholds.maxMissingRequiredSystems, 0, 4),
      maxMajorDrifts: boundedInteger(thresholdInput.maxMajorDrifts, fallback.thresholds.maxMajorDrifts, 0, 4),
      minimumReferenceViews: boundedInteger(thresholdInput.minimumReferenceViews, fallback.thresholds.minimumReferenceViews, 2, 6),
    },
  }
}

function parseJson(content) {
  if (typeof content !== 'string') return null
  const candidate = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try { return JSON.parse(candidate) } catch { return null }
}

function sanitizeCritique(value, review) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const textList = (key) => Array.isArray(value[key]) ? value[key].filter((item) => typeof item === 'string').slice(0, 8) : []
  const score = Math.max(0, Math.min(100, Math.round(Number(value.score) || 0)))
  const missingComponents = textList('missingComponents')
  const drift = textList('drift')
  return {
    score,
    pass: Boolean(value.pass)
      && score >= review.thresholds.passScore
      && missingComponents.length <= review.thresholds.maxMissingRequiredSystems
      && drift.length <= review.thresholds.maxMajorDrifts,
    missingComponents,
    drift,
    summary: typeof value.summary === 'string' ? value.summary.slice(0, 280) : 'No usable visual-fidelity summary returned.',
    retryInstruction: typeof value.retryInstruction === 'string' ? value.retryInstruction.slice(0, 700) : '',
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
  if ((process.env.LLM_PROVIDER || '').toLowerCase() !== 'openrouter') return res.status(503).json({ error: 'Visual critic requires LLM_PROVIDER=openrouter' })
  if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured' })
  const spec = asSafeSpec(req.body?.spec)
  const alignmentReference = asSafeDataUrl(req.body?.alignmentReference, 1_400_000)
  const renderedImage = asSafeDataUrl(req.body?.renderedImage, 4_000_000)
  if (!spec || !alignmentReference || !renderedImage) return res.status(400).json({ error: 'Spec, reference sheet, and rendered image are required' })
  const review = asSafeReview(req.body?.review, defaultReview(spec))

  const requiredComponents = review.requiredSystems.join('; ')
  const system = `You are a strict automotive visual-fidelity critic. Compare an engineering reference sheet (first image) to a generated automotive photo (second image). Do not assess artistic quality. Score only whether the generated photo preserves geometry and required components. Target policy: ${review.label}. Required visible systems: ${requiredComponents}. Return JSON only: {"score":0-100,"pass":boolean,"missingComponents":[string],"drift":[string],"summary":string,"retryInstruction":string}. Pass only at ${review.thresholds.passScore} or above, with at most ${review.thresholds.maxMissingRequiredSystems} missing systems and ${review.thresholds.maxMajorDrifts} major drifts. The retry instruction must tell an image generator exactly what to correct, with no prose explanation.`
  const userText = `Target: ${spec.vehicleClass}; ${Math.round(spec.overallLength * 1000)} mm length, ${Math.round(spec.overallWidth * 1000)} mm width, ${Math.round(spec.overallHeight * 1000)} mm height; ${Math.round(spec.wheelbase * 1000)} mm wheelbase; ${Math.round(spec.frontTrack * 1000)}/${Math.round(spec.rearTrack * 1000)} mm tracks; ${Math.round(spec.wheelRadius * 2000)} mm wheel diameter; ${spec.roofProfile} roof; ${spec.engineLayout} layout. Policy context: ${review.brief}`
  try {
    const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        ...(process.env.APP_URL ? { 'HTTP-Referer': process.env.APP_URL } : {}),
        'X-Title': 'Aether Automotive Intelligence',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: alignmentReference } }, { type: 'image_url', image_url: { url: renderedImage } }] },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      try {
        const parsed = JSON.parse(errorText)
        return res.status(apiResponse.status).json({ error: parsed?.error?.message || errorText })
      } catch {
        return res.status(apiResponse.status).json({ error: errorText })
      }
    }
    const payload = await apiResponse.json()
    const result = sanitizeCritique(parseJson(payload.choices?.[0]?.message?.content), review)
    if (!result) return res.status(502).json({ error: 'Visual critic returned unreadable structured output' })
    return res.status(200).json(result)
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Visual critic failed' })
  }
}
