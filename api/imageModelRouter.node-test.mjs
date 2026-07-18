// Run with: node --test api/imageModelRouter.node-test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_REFERENCE_IMAGE_MODEL,
  ImageModelCapabilityError,
  buildSupportedImagePayloadOptions,
  clearImageModelDiscoveryCache,
  selectReferenceLockedImageModel,
} from './imageModelRouter.mjs'

function imageModel(id, supportedParameters = {}) {
  return {
    id,
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
    supported_parameters: supportedParameters,
    endpoints: `/api/v1/images/models/${id}/endpoints`,
  }
}

function fakeFetch(routes, calls) {
  return async (url) => {
    calls.push(url)
    const payload = routes[url]
    return new Response(JSON.stringify(payload ?? { error: 'not found' }), { status: payload ? 200 : 404 })
  }
}

test('prefers a reference-capable configured model and omits unsupported payload fields', async () => {
  clearImageModelDiscoveryCache()
  const configured = 'acme/render-pro'
  const calls = []
  const configuredRecord = imageModel(configured, {
    input_references: { type: 'boolean' },
    n: { type: 'range', min: 1, max: 4 },
    aspect_ratio: { type: 'enum', values: ['16:9'] },
    output_format: { type: 'enum', values: ['webp'] },
  })
  const routes = {
    'https://openrouter.ai/api/v1/images/models': { data: [configuredRecord] },
    'https://openrouter.ai/api/v1/images/models/acme/render-pro/endpoints': {
      endpoints: [{ provider_tag: 'acme', supported_parameters: { input_references: { type: 'boolean' } } }],
    },
  }

  const selected = await selectReferenceLockedImageModel({
    configuredModel: configured,
    hasGeometryReference: true,
    fetchImpl: fakeFetch(routes, calls),
  })

  assert.equal(selected.model, configured)
  assert.equal(selected.configured, true)
  const options = buildSupportedImagePayloadOptions(selected.capabilities, {
    n: 1,
    aspectRatio: '16:9',
    outputFormat: 'webp',
    quality: 'high',
    inputReferences: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }],
    requireReference: true,
  })
  assert.deepEqual(options, {
    n: 1,
    aspect_ratio: '16:9',
    output_format: 'webp',
    input_references: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }],
    provider: { only: ['acme'], allow_fallbacks: false },
  })
  assert.equal(calls.length, 2)
})

test('falls back to Seedream only when its capability record supports a locked reference', async () => {
  clearImageModelDiscoveryCache()
  const calls = []
  const fallback = imageModel(DEFAULT_REFERENCE_IMAGE_MODEL, { input_references: { type: 'boolean' } })
  const routes = {
    'https://openrouter.ai/api/v1/images/models': {
      data: [
        { id: 'acme/text-only', architecture: { input_modalities: ['text'], output_modalities: ['image'] }, supported_parameters: {} },
        fallback,
      ],
    },
    'https://openrouter.ai/api/v1/images/models/acme/text-only/endpoints': { endpoints: [] },
    'https://openrouter.ai/api/v1/images/models/bytedance-seed/seedream-4.5/endpoints': { endpoints: [] },
  }

  const selected = await selectReferenceLockedImageModel({
    configuredModel: 'acme/text-only',
    hasGeometryReference: true,
    fetchImpl: fakeFetch(routes, calls),
  })

  assert.equal(selected.model, DEFAULT_REFERENCE_IMAGE_MODEL)
  assert.equal(selected.fallback, true)
})

test('rejects a required geometry reference instead of silently dropping it', () => {
  assert.throws(() => buildSupportedImagePayloadOptions({
    inputModalities: ['text'],
    outputModalities: ['image'],
    supportedParameters: ['output_format'],
    referenceInput: false,
  }, {
    outputFormat: 'webp',
    inputReferences: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }],
    requireReference: true,
  }), ImageModelCapabilityError)
})

test('caches catalogue and endpoint discovery within the configured TTL', async () => {
  clearImageModelDiscoveryCache()
  const calls = []
  const model = imageModel('acme/cached', { input_references: { type: 'boolean' } })
  const routes = {
    'https://openrouter.ai/api/v1/images/models': { data: [model] },
    'https://openrouter.ai/api/v1/images/models/acme/cached/endpoints': { endpoints: [] },
  }
  const options = { configuredModel: 'acme/cached', hasGeometryReference: true, fetchImpl: fakeFetch(routes, calls), ttlMs: 60_000 }

  await selectReferenceLockedImageModel(options)
  await selectReferenceLockedImageModel(options)

  assert.equal(calls.length, 2)
})
