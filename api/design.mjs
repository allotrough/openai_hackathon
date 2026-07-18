const vehiclePatchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    patch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' }, vehicleClass: { type: 'string' }, wheelbase: { type: 'number' },
        frontTrack: { type: 'number' }, rearTrack: { type: 'number' }, rideHeight: { type: 'number' },
        overallLength: { type: 'number' }, overallWidth: { type: 'number' }, overallHeight: { type: 'number' },
        wheelRadius: { type: 'number' }, tireWidth: { type: 'number' }, roofProfile: { type: 'string' },
        suspensionType: { type: 'string' }, engineLayout: { type: 'string' }, powertrain: { type: 'string' },
        massKg: { type: 'number' }, frontWing: { type: 'number' }, rearWing: { type: 'number' },
        diffuserDepth: { type: 'number' }, downforceBias: { type: 'number' }, coolingIntake: { type: 'number' },
        groundClearance: { type: 'number' }, bodyColor: { type: 'string' }, accentColor: { type: 'string' },
        referenceCue: { type: 'string' }, assumptions: { type: 'array', items: { type: 'string' } },
      },
      required: [],
    },
    research: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
  required: ['patch', 'research', 'confidence'],
}

const systemPrompt = `You are the orchestration layer for Aether, a physics-grounded automotive concept studio.
Run these roles internally: Intent/Planner, optional Reference Research, Vehicle Engineering, Geometry validation, Critic, and Renderer.
Return only a semantic VehicleSpec patch in the supplied JSON schema. Never return meshes, vertices, GLTF, shaders, geometry code, scene graphs, or raw chain-of-thought.
The procedural renderer consumes typed dimensions and component parameters. Respect the supplied class knowledge context: its component graph is a required engineering constraint, not optional style prose. Do not apply regulations unless the user explicitly asks. Preserve imaginative intent but adapt it to plausible scale, clearance, cooling, mounting, packaging, structural load paths, airflow, and stability. For named production-car references, use web research to extract usable design cues and function; adapt them rather than pasting an incompatible component. Keep research to 3 terse evidence bullets and assumptions to 6 terse items.`

function asSafeKnowledgeContext(input) {
  return typeof input === 'string'
    ? input.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2400)
    : ''
}

function outputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string') return content.text
    }
  }
  return ''
}

async function runOpenAI({ prompt, current, wantsResearch, imageDataUrl, knowledgeContext }) {
  const userText = `User request:\n${prompt}\n\nCurrent VehicleSpec:\n${JSON.stringify(current)}${knowledgeContext ? `\n\nClass knowledge context:\n${knowledgeContext}` : ''}`
  const apiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.6-terra',
      reasoning: { effort: 'high' },
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: imageDataUrl ? [{ type: 'input_text', text: userText }, { type: 'input_image', image_url: imageDataUrl }] : userText },
      ],
      ...(wantsResearch ? { tools: [{ type: 'web_search' }] } : {}),
      text: { format: { type: 'json_schema', name: 'vehicle_patch', strict: true, schema: vehiclePatchSchema } },
    }),
  })
  if (!apiResponse.ok) throw new Error(await apiResponse.text())
  return JSON.parse(outputText(await apiResponse.json()))
}

async function runOpenRouter({ prompt, current, wantsResearch, imageDataUrl, knowledgeContext }) {
  const userText = `User request:\n${prompt}\n\nCurrent VehicleSpec:\n${JSON.stringify(current)}${knowledgeContext ? `\n\nClass knowledge context:\n${knowledgeContext}` : ''}`
  const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
      ...(process.env.APP_URL ? { 'HTTP-Referer': process.env.APP_URL } : {}),
      'X-Title': 'Aether Automotive Intelligence',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-5.6-terra',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: imageDataUrl ? [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: imageDataUrl } }] : userText },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'vehicle_patch', strict: true, schema: vehiclePatchSchema } },
      ...(wantsResearch ? { plugins: [{ id: 'web' }] } : {}),
    }),
  })
  if (!apiResponse.ok) throw new Error(await apiResponse.text())
  const payload = await apiResponse.json()
  const content = payload.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('OpenRouter returned no structured message content')
  return JSON.parse(content)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()
  const hasKey = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY
  if (!hasKey) return res.status(503).json({ error: `${provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'} is not configured` })
  const { prompt, current, imageDataUrl } = req.body ?? {}
  const knowledgeContext = asSafeKnowledgeContext(req.body?.knowledgeContext)
  if (typeof prompt !== 'string' || !current || typeof current !== 'object') return res.status(400).json({ error: 'prompt and current design are required' })
  if (imageDataUrl !== undefined && (typeof imageDataUrl !== 'string' || imageDataUrl.length > 3_000_000 || !imageDataUrl.startsWith('data:image/'))) return res.status(400).json({ error: 'image must be an image data URL below 3 MB' })
  const wantsResearch = /\b(911|porsche|ferrari|tesla|ford|toyota|honda|bmw|audi|mercedes|lamborghini|side mirror|frunk|reference)\b/i.test(prompt)
  try {
    const args = { prompt, current, wantsResearch, imageDataUrl, knowledgeContext }
    const result = provider === 'openrouter' ? await runOpenRouter(args) : await runOpenAI(args)
    return res.status(200).json(result)
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Model returned an unreadable structured result' })
  }
}
