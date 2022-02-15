import { App, Coupling, CouplingStage, Domain, Pipeline } from './models'

type withPartialApp = { app: Partial<App> }
type withEnvVars = { envVars: Record<string, RegExp> }

export class Heroku {
  private _apiKey: string

  constructor(apiKey: string) {
    this._apiKey = apiKey
  }

  private async _fetch(props: {
    route: string
    method?: RequestInit['method']
    body?: RequestInit['body']
  }): Promise<Response> {
    const { route, method = 'GET', body } = props
    return fetch(`https://api.heroku.com${route}`, {
      method,
      body,
      headers: {
        ...(['PATCH', 'POST', 'PUT'].includes(method) && {
          'Content-Type': 'application/json',
        }),
        Accept: 'application/vnd.heroku+json; version=3',
        Authorization: `Bearer ${this._apiKey}`,
      },
    })
  }

  async getApps(): Promise<App[]> {
    return await (await this._fetch({ route: '/apps' })).json()
  }

  async getApp(props: { appName: string }): Promise<App> {
    const { appName } = props
    const doc = await (await this._fetch({ route: `/apps/${appName}` })).json()
    return doc.id === 'not_found' ? undefined : doc
  }

  async getPipelineApps(props: {
    pipelineName: string
    stage?: CouplingStage
  }): Promise<App[]> {
    const { pipelineName, stage } = props
    const pipeline = await this._getPipeline({ pipelineName })
    const couplings: Coupling[] = await (
      await this._fetch({
        route: `/pipelines/${pipeline.id}/pipeline-couplings`,
      })
    ).json()
    const promises = couplings.reduce((acc, coupling) => {
      if (!stage || coupling.stage === stage) {
        acc.push(this.getApp({ appName: coupling.app.id }))
      }
      return acc
    }, [] as Promise<App>[])
    return await Promise.all(promises)
  }

  async searchApps(props: {
    filters: withPartialApp | withEnvVars | (withPartialApp & withEnvVars)
    pipelineName?: string
  }): Promise<App[]> {
    const { filters, pipelineName } = props
    const apps = await (pipelineName
      ? this.getPipelineApps({ pipelineName, stage: CouplingStage.Production })
      : this.getApps())

    const partialAppEntries =
      'app' in filters ? Object.entries(filters.app) : []
    const envVarsEntries =
      'envVars' in filters ? Object.entries(filters.envVars) : []
    const filteredApps = []

    for (let index = 0; index < apps.length; index++) {
      const app = apps[index]

      if (
        !partialAppEntries.every(
          ([key, value]) => app[key as keyof App] === value
        )
      ) {
        continue
      }

      if (envVarsEntries.length) {
        const appEnvVars = await this.getAppEnvVars({ appName: app.name })
        if (
          !envVarsEntries.every(([key, value]) => value.test(appEnvVars[key]))
        ) {
          continue
        }
      }

      filteredApps.push(app)
    }

    return filteredApps
  }

  async updateAppBuildpacks(props: {
    appName: string
    buildpacks: string[]
  }): Promise<boolean> {
    const { appName, buildpacks } = props
    return (
      await this._fetch({
        route: `/apps/${appName}/buildpack-installations`,
        method: 'PUT',
        body: JSON.stringify({
          updates: buildpacks.map((buildpack) => ({ buildpack })),
        }),
      })
    ).ok
  }

  async createApp(props: {
    appName: string
    region?: string
    team?: string
  }): Promise<App> {
    const { appName: name, region, team } = props
    if (team) {
      return await (
        await this._fetch({
          route: '/teams/apps',
          method: 'POST',
          body: JSON.stringify({ name, region, team }),
        })
      ).json()
    }
    return await (
      await this._fetch({
        route: '/apps',
        method: 'POST',
        body: JSON.stringify({ name, region }),
      })
    ).json()
  }

  private async _getPipeline(props: {
    pipelineName: string
  }): Promise<Pipeline> {
    const { pipelineName } = props
    const doc = await (
      await this._fetch({ route: `/pipelines/${pipelineName}` })
    ).json()
    return doc.id === 'not_found' ? undefined : doc
  }

  async addAppToPipeline(props: {
    appName: string
    pipelineName: string
    stage: 'test' | 'review' | 'development' | 'staging' | 'production'
  }): Promise<boolean> {
    const { appName: app, pipelineName, stage } = props
    const pipeline = await this._getPipeline({ pipelineName })
    if (pipeline) {
      return (
        await this._fetch({
          route: '/pipeline-couplings',
          method: 'POST',
          body: JSON.stringify({ app, pipeline: pipeline.id, stage }),
        })
      ).ok
    }
    return false
  }

  async getAppEnvVars(props: {
    appName: string
  }): Promise<Record<string, string>> {
    const { appName } = props
    return await (
      await this._fetch({ route: `/apps/${appName}/config-vars` })
    ).json()
  }

  async updateAppEnvVars(props: {
    appName: string
    envVars: Record<string, string>
  }): Promise<boolean> {
    const { appName, envVars } = props
    return (
      await this._fetch({
        route: `/apps/${appName}/config-vars`,
        method: 'PATCH',
        body: JSON.stringify(envVars),
      })
    ).ok
  }

  async addAppDomain(props: {
    appName: string
    hostname: string
    sni_endpoint?: string
  }): Promise<Domain> {
    const { appName, hostname, sni_endpoint } = props
    return await (
      await this._fetch({
        route: `/apps/${appName}/domains`,
        method: 'POST',
        body: JSON.stringify({ hostname, sni_endpoint }),
      })
    ).json()
  }

  async enableAppAutoCerts(props: { appName: string }): Promise<boolean> {
    const { appName } = props
    return (
      await this._fetch({ route: `/apps/${appName}/acm`, method: 'POST' })
    ).ok
  }

  async getAppDynos(props: { appName: string }): Promise<App[]> {
    const { appName } = props
    return await (await this._fetch({ route: `/apps/${appName}/dynos` })).json()
  }
}
