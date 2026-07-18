import { buildAeroFlowPlan } from '../lib/aeroFlow'
import type { VehicleSpec } from '../types'

type AeroPlanRequest = {
  id: number
  spec: VehicleSpec
}

type AeroPlanResponse =
  | { id: number; plan: ReturnType<typeof buildAeroFlowPlan> }
  | { id: number; error: string }

self.onmessage = ({ data }: MessageEvent<AeroPlanRequest>) => {
  try {
    const response: AeroPlanResponse = {
      id: data.id,
      plan: buildAeroFlowPlan(data.spec),
    }
    self.postMessage(response)
  } catch (error) {
    const response: AeroPlanResponse = {
      id: data.id,
      error: error instanceof Error ? error.message : 'Aerodynamic estimate could not be prepared.',
    }
    self.postMessage(response)
  }
}
