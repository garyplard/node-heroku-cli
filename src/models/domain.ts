import { Common } from './_common'

export interface Domain {
  acm_status?: string
  acm_status_reason?: string
  app: Common
  cname?: string
  created_at: string
  hostname: string
  id: string
  kind: 'heroku' | 'custom'
  sni_endpoint?: Common
  status: string
  updated_at: string
}
