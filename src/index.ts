import { App, Coupling, CouplingStage, Domain, Dyno, Pipeline } from './models'
import fetch, { Response, RequestInfo, RequestInit, Headers } from 'node-fetch'

type withPartialApp = { app: Partial<App> }
type withEnvVars = { envVars: Record<string, RegExp> }
type Result<T> = Promise<{ data: T; headers: Headers }>

interface FetchProps {
  route: RequestInfo
  method?: RequestInit['method']
  body?: RequestInit['body']
}

export class Heroku {
  private apiKey

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async _fetch(props: FetchProps): Promise<Response> {
    const { route, method = 'GET', body } = props

    return fetch(`https://api.heroku.com${route}`, {
      method,
      body,
      headers: {
        ...(['PATCH', 'POST', 'PUT'].includes(method) && {
          'Content-Type': 'application/json',
        }),
        Accept: 'application/vnd.heroku+json; version=3',
        Authorization: `Bearer ${this.apiKey}`,
      },
    })
  }

  private async fetchJson<T>(props: FetchProps): Result<T> {
    const response = await this._fetch(props)
    return {
      headers: response.headers,
      data: (await response.json()) as T,
    }
  }

  private async fetchBool(props: FetchProps): Result<boolean> {
    const response = await this._fetch(props)
    return {
      headers: response.headers,
      data: response.ok,
    }
  }

  async getApps(): Result<App[]> {
    return this.fetchJson<App[]>({ route: '/apps' })
  }

  async getApp(props: { appName: string }): Result<App | undefined> {
    const { appName } = props
    const { data, headers } = await this.fetchJson<App>({
      route: `/apps/${appName}`,
    })
    return { headers, data: data.id === 'not_found' ? undefined : data }
  }

  async getPipelineApps(props: {
    pipelineName: string
    stage?: CouplingStage
  }): Result<App[]> {
    const { pipelineName, stage } = props
    const { data: pipeline, headers } = await this.getPipeline({ pipelineName })
    if (!pipeline) return { data: [], headers }

    const [{ data: couplings }, { data: apps, headers: lastHeaders }] =
      await Promise.all([
        this.fetchJson<Coupling[]>({
          route: `/pipelines/${pipeline.id}/pipeline-couplings`,
        }),
        this.getApps(),
      ])

    return {
      data: couplings.reduce((acc, coupling) => {
        if (!stage || coupling.stage === stage) {
          const match = apps.find(({ id }) => id === coupling.app.id)
          if (match) acc.push(match)
        }
        return acc
      }, [] as App[]),
      headers: lastHeaders,
    }
  }

  async searchApps(props: {
    filters: withPartialApp | withEnvVars | (withPartialApp & withEnvVars)
    pipelineName?: string
  }): Result<App[]> {
    const { filters, pipelineName } = props
    const response = await (pipelineName
      ? this.getPipelineApps({
          pipelineName,
          stage: CouplingStage.Production,
        })
      : this.getApps())

    const { data: apps } = response
    let { headers } = response
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
        const response = await this.getAppEnvVars({
          appName: app.name,
        })
        const { data: appEnvVars } = response
        ;({ headers } = response)
        if (
          !envVarsEntries.every(([key, value]) => value.test(appEnvVars[key]))
        ) {
          continue
        }
      }

      filteredApps.push(app)
    }

    return { data: filteredApps, headers }
  }

  async updateAppBuildpacks(props: {
    appName: string
    buildpacks: string[]
  }): Result<boolean> {
    const { appName, buildpacks } = props
    return this.fetchBool({
      route: `/apps/${appName}/buildpack-installations`,
      method: 'PUT',
      body: JSON.stringify({
        updates: buildpacks.map((buildpack) => ({ buildpack })),
      }),
    })
  }

  async createApp(props: {
    appName: string
    region?: string
    team?: string
  }): Result<App> {
    const { appName: name, region, team } = props
    if (team) {
      return this.fetchJson<App>({
        route: '/teams/apps',
        method: 'POST',
        body: JSON.stringify({ name, region, team }),
      })
    }
    return this.fetchJson<App>({
      route: '/apps',
      method: 'POST',
      body: JSON.stringify({ name, region }),
    })
  }

  private async getPipeline(props: {
    pipelineName: string
  }): Result<Pipeline | undefined> {
    const { pipelineName } = props
    const { data, headers } = await this.fetchJson<Pipeline>({
      route: `/pipelines/${pipelineName}`,
    })
    return { headers, data: data.id === 'not_found' ? undefined : data }
  }

  async addAppToPipeline(props: {
    appName: string
    pipelineName: string
    stage: 'test' | 'review' | 'development' | 'staging' | 'production'
  }): Result<boolean> {
    const { appName: app, pipelineName, stage } = props
    const { data: pipeline, headers } = await this.getPipeline({ pipelineName })
    if (pipeline) {
      return this.fetchBool({
        route: '/pipeline-couplings',
        method: 'POST',
        body: JSON.stringify({ app, pipeline: pipeline.id, stage }),
      })
    }
    return { data: false, headers }
  }

  async getAppEnvVars(props: {
    appName: string
  }): Result<Record<string, string>> {
    const { appName } = props
    return this.fetchJson<Record<string, string>>({
      route: `/apps/${appName}/config-vars`,
    })
  }

  async updateAppEnvVars(props: {
    appName: string
    envVars: Record<string, string>
  }): Result<boolean> {
    const { appName, envVars } = props
    return this.fetchBool({
      route: `/apps/${appName}/config-vars`,
      method: 'PATCH',
      body: JSON.stringify(envVars),
    })
  }

  async addAppDomain(props: {
    appName: string
    hostname: string
    sni_endpoint?: string
  }): Result<Domain> {
    const { appName, hostname, sni_endpoint } = props
    return this.fetchJson({
      route: `/apps/${appName}/domains`,
      method: 'POST',
      body: JSON.stringify({ hostname, sni_endpoint }),
    })
  }

  async getAppDomains(props: { appName: string }): Result<Domain[]> {
    const { appName } = props
    return this.fetchJson({ route: `/apps/${appName}/domains` })
  }

  async enableAppAutoCerts(props: { appName: string }): Result<boolean> {
    const { appName } = props
    return this.fetchBool({ route: `/apps/${appName}/acm`, method: 'POST' })
  }

  async getAppDynos(props: { appName: string }): Result<Dyno[]> {
    const { appName } = props
    return this.fetchJson({ route: `/apps/${appName}/dynos` })
  }

  async restartAppDynos(props: {
    appName: string
    dynoName?: string
  }): Result<boolean> {
    const { appName, dynoName } = props
    let route = `/apps/${appName}/dynos`
    if (dynoName) route += `/${dynoName}`
    return this.fetchBool({ route, method: 'DELETE' })
  }
}

export * from './models'
