const OPENROUTER_ORIGIN = 'https://openrouter.ai'
const IMAGE_MODELS_URL = `${OPENROUTER_ORIGIN}/api/v1/images/models`

export const DEFAULT_REFERENCE_IMAGE_MODEL = 'bytedance-seed/seedream-4.5'
export const IMAGE_MODEL_DISCOVERY_TTL_MS = 5 * 60 * 1000

export class ImageModelCapabilityError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ImageModelCapabilityError'
  }
}

let discoveryCache = null
let discoveryPromise = null

function safeModelId(value) {
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(id) ? id : null
}

function capabilityNames(record) {
  if (!record || typeof record !== 'object') return []
  return Object.keys(record.supported_parameters || {})
}

function normalizedModalities(record, key) {
  const modalities = record?.architecture?.[key]
  return Array.isArray(modalities)
    ? modalities.filter((value) => typeof value === 'string').map((value) => value.toLowerCase())
    : []
}

function isEndpointReferenceCapable(endpoint) {
  return capabilityNames(endpoint).includes('input_references')
}

function selectedProviderTag(endpoints, requiresReference) {
  if (!requiresReference) return undefined
  const endpoint = endpoints.find((candidate) => isEndpointReferenceCapable(candidate) && typeof candidate.provider_tag === 'string')
  return endpoint?.provider_tag
}

function makeCapabilities(model, record, endpoints) {
  const supportedParameters = new Set([
    ...capabilityNames(record),
    ...endpoints.flatMap((endpoint) => capabilityNames(endpoint)),
  ])
  const inputModalities = normalizedModalities(record, 'input_modalities')
  const outputModalities = normalizedModalities(record, 'output_modalities')
  return {
    model,
    inputModalities,
    outputModalities,
    supportedParameters: [...supportedParameters].sort(),
    referenceInput: inputModalities.includes('image') && supportedParameters.has('input_references'),
    providerTag: selectedProviderTag(endpoints, inputModalities.includes('image') && supportedParameters.has('input_references')),
  }
}

function isEligible(capabilities, requiresReference) {
  if (!capabilities.outputModalities.includes('image')) return false
  return !requiresReference || capabilities.referenceInput
}

function headersFor(apiKey) {
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {}
}

async function readJson(fetchImpl, url, apiKey) {
  const response = await fetchImpl(url, { headers: headersFor(apiKey) })
  if (!response?.ok) throw new ImageModelCapabilityError(`OpenRouter image-model discovery failed (${response?.status || 'network error'})`)
  return response.json()
}

function endpointUrl(record, model) {
  const candidate = typeof record?.endpoints === 'string' ? record.endpoints : null
  if (candidate && candidate.startsWith('/api/v1/images/models/')) return new URL(candidate, OPENROUTER_ORIGIN).toString()
  const [publisher, slug] = model.split('/')
  return `${IMAGE_MODELS_URL}/${encodeURIComponent(publisher)}/${encodeURIComponent(slug)}/endpoints`
}

async function fetchEndpointRecords(fetchImpl, record, model, apiKey) {
  const cached = discoveryCache?.endpointRecords?.get(model)
  if (cached) return cached
  try {
    const payload = await readJson(fetchImpl, endpointUrl(record, model), apiKey)
    const endpoints = Array.isArray(payload?.endpoints) ? payload.endpoints.filter((entry) => entry && typeof entry === 'object') : []
    discoveryCache?.endpointRecords?.set(model, endpoints)
    return endpoints
  } catch {
    // The top-level model capability is still useful. A missing endpoint-detail
    // record must never cause an unvalidated provider-specific option to be sent.
    discoveryCache?.endpointRecords?.set(model, [])
    return []
  }
}

/**
 * Fetches the OpenRouter Image Models catalogue and briefly caches it. This is
 * metadata discovery only; it never invokes an image-generation endpoint.
 */
export async function discoverImageModels({
  fetchImpl = globalThis.fetch,
  apiKey,
  now = Date.now,
  ttlMs = IMAGE_MODEL_DISCOVERY_TTL_MS,
  forceRefresh = false,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new ImageModelCapabilityError('A fetch implementation is required for image-model discovery')
  const timestamp = now()
  if (!forceRefresh && discoveryCache && discoveryCache.expiresAt > timestamp) return discoveryCache.models
  if (!forceRefresh && discoveryPromise) return discoveryPromise

  discoveryPromise = (async () => {
    const payload = await readJson(fetchImpl, IMAGE_MODELS_URL, apiKey)
    const models = new Map()
    for (const record of Array.isArray(payload?.data) ? payload.data : []) {
      const model = safeModelId(record?.id)
      if (model) models.set(model, record)
    }
    discoveryCache = { expiresAt: now() + Math.max(1, ttlMs), models, endpointRecords: new Map() }
    return models
  })()

  try {
    return await discoveryPromise
  } finally {
    discoveryPromise = null
  }
}

export function clearImageModelDiscoveryCache() {
  discoveryCache = null
  discoveryPromise = null
}

/**
 * Selects an image-output model that can safely accept a geometry reference.
 * The configured choice wins when it has the required capabilities. Otherwise
 * the validated Seedream fallback is selected.
 */
export async function selectReferenceLockedImageModel({
  configuredModel,
  hasGeometryReference = false,
  fetchImpl = globalThis.fetch,
  apiKey,
  now = Date.now,
  ttlMs = IMAGE_MODEL_DISCOVERY_TTL_MS,
  forceRefresh = false,
} = {}) {
  const models = await discoverImageModels({ fetchImpl, apiKey, now, ttlMs, forceRefresh })
  const configured = safeModelId(configuredModel)
  const candidates = [...new Set([configured, DEFAULT_REFERENCE_IMAGE_MODEL].filter(Boolean))]

  for (const model of candidates) {
    const record = models.get(model)
    if (!record) continue
    const endpoints = await fetchEndpointRecords(fetchImpl, record, model, apiKey)
    const capabilities = makeCapabilities(model, record, endpoints)
    if (!isEligible(capabilities, hasGeometryReference)) continue
    return {
      model,
      configured: Boolean(configured && model === configured),
      fallback: model === DEFAULT_REFERENCE_IMAGE_MODEL && model !== configured,
      capabilities,
    }
  }

  const requirement = hasGeometryReference
    ? 'image input and input_references support'
    : 'image output support'
  throw new ImageModelCapabilityError(`No configured OpenRouter image model has ${requirement}.`)
}

function asReferenceArray(inputReferences) {
  return Array.isArray(inputReferences) && inputReferences.length > 0 ? inputReferences : null
}

/**
 * Pure helper for /api/v1/images option fields. It deliberately omits settings
 * not advertised by the selected capability record. A required geometry
 * reference is rejected rather than silently dropped.
 */
export function buildSupportedImagePayloadOptions(capabilities, {
  n,
  resolution,
  aspectRatio,
  size,
  quality,
  outputFormat,
  background,
  outputCompression,
  seed,
  inputReferences,
  requireReference = false,
} = {}) {
  const supported = new Set(Array.isArray(capabilities?.supportedParameters) ? capabilities.supportedParameters : [])
  const options = {}
  const include = (parameter, value) => {
    if (value !== undefined && value !== null && supported.has(parameter)) options[parameter] = value
  }

  include('n', n)
  include('resolution', resolution)
  include('aspect_ratio', aspectRatio)
  // Explicit pixels conflict with resolution/aspect_ratio in OpenRouter's API.
  if (size !== undefined && size !== null && !('resolution' in options) && !('aspect_ratio' in options)) include('size', size)
  include('quality', quality)
  include('output_format', outputFormat)
  include('background', background)
  include('output_compression', outputCompression)
  include('seed', seed)

  const references = asReferenceArray(inputReferences)
  if (references) {
    if (!capabilities?.referenceInput || !supported.has('input_references')) {
      if (requireReference) throw new ImageModelCapabilityError('The selected image model cannot accept the required geometry reference.')
    } else {
      options.input_references = references
      if (typeof capabilities.providerTag === 'string' && capabilities.providerTag) {
        options.provider = { only: [capabilities.providerTag], allow_fallbacks: false }
      }
    }
  } else if (requireReference) {
    throw new ImageModelCapabilityError('A geometry reference is required for this render.')
  }

  return options
}
