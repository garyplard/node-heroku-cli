export enum CouplingStage {
  Test = 'test',
  Review = 'review',
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

export interface Coupling {
  app: {
    id: string
  }
  created_at: string
  id: string
  pipeline: {
    id: string
  }
  stage: CouplingStage
  updated_at: string
}
