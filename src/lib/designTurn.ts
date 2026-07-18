import type { VehicleSpec } from '../types'
import { compileIntent, runAgenticLoop } from './engineering'

export function runDesignTurn(
  prompt: string,
  current: VehicleSpec,
  options: { remotePatch?: Partial<VehicleSpec> | null; referenceImageName?: string } = {},
) {
  const compiled = compileIntent(prompt, current)
  if (options.referenceImageName) {
    compiled.referenceCue ??= `User-provided image reference: ${options.referenceImageName}`
    compiled.assumptions = [...new Set([...compiled.assumptions, 'Visual reference will be adapted for target scale and mounting'])]
  }
  const candidate = options.remotePatch
    ? {
        ...compiled,
        ...options.remotePatch,
        id: compiled.id,
        assumptions: [...new Set([...compiled.assumptions, ...(options.remotePatch.assumptions ?? [])])],
      }
    : compiled
  return runAgenticLoop(candidate)
}
