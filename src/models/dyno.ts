import { Common } from './_common'

export enum DynoState {
  Crashed = 'crashed',
  Down = 'down',
  Idle = 'idle',
  Starting = 'starting',
  Up = 'up',
}

export enum DynoSize {
  Free = 'free',
  Hobby = 'hobby',
  Standard1x = 'standard-1x',
  Standard2x = 'standard-2x',
  performanceM = 'performance-m',
  performanceL = 'performance-l',
}

export interface Dyno extends Common {
  attach_url: string | null
  command: string
  created_at: string
  app: {
    id: string
    name: string
  }
  release: {
    id: string
    version: number
  }
  size: DynoSize
  state: DynoState
  type: string
  updated_at: string
}
