import { Common } from './_common'

export interface Pipeline extends Common {
  created_at: string
  owner?: {
    id: string
    type: string
  }
  updated_at: string
}
