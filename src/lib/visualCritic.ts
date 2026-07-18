import type { VehicleSpec } from '../types'
import { buildVisualCriticBrief, getVisualFidelityPolicy, type VisualFidelityPolicy } from './fidelityPolicy'

export type VisualFidelity = {
  score: number
  pass: boolean
  retryRecommended: boolean
  policyLabel: string
  missingComponents: string[]
  drift: string[]
  summary: string
  retryInstruction: string
}

function normalizeCritique(value: Partial<VisualFidelity>, policy: VisualFidelityPolicy): VisualFidelity {
  const score = Math.max(0, Math.min(100, Math.round(Number(value.score) || 0)))
  const missingComponents = Array.isArray(value.missingComponents) ? value.missingComponents.filter((item): item is string => typeof item === 'string').slice(0, 8) : []
  const drift = Array.isArray(value.drift) ? value.drift.filter((item): item is string => typeof item === 'string').slice(0, 8) : []
  const thresholds = policy.thresholds
  const pass = Boolean(value.pass)
    && score >= thresholds.passScore
    && missingComponents.length <= thresholds.maxMissingRequiredSystems
    && drift.length <= thresholds.maxMajorDrifts
  return {
    score,
    pass,
    retryRecommended: !pass && (score <= thresholds.retryBelow || missingComponents.length > thresholds.maxMissingRequiredSystems || drift.length > thresholds.maxMajorDrifts),
    policyLabel: policy.label,
    missingComponents,
    drift,
    summary: typeof value.summary === 'string' ? value.summary.slice(0, 280) : 'Visual fidelity could not be assessed.',
    retryInstruction: typeof value.retryInstruction === 'string' ? value.retryInstruction.slice(0, 700) : '',
  }
}

export async function requestVisualCritique(args: {
  spec: VehicleSpec
  alignmentReference: string
  renderedImage: string
}): Promise<VisualFidelity> {
  const policy = getVisualFidelityPolicy(args.spec.vehicleClass)
  const response = await fetch('/api/visual-critic', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...args,
      review: {
        label: policy.label,
        brief: buildVisualCriticBrief(args.spec),
        requiredSystems: policy.requiredVisibleSystems.map((system) => `${system.id}: ${system.label}`),
        thresholds: policy.thresholds,
      },
    }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error || 'Visual alignment review failed')
  }
  return normalizeCritique(await response.json() as Partial<VisualFidelity>, policy)
}
