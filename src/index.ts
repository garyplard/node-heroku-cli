import { App, Domain, Pipeline } from "./models";

export class Heroku {
  private _apiKey: string;

  constructor(apiKey: string) {
    this._apiKey = apiKey;
  }

  private async _fetch(props: {
    route: string;
    method?: RequestInit["method"];
    body?: RequestInit["body"];
  }) {
    const { route, method = "GET", body } = props;
    const response = await fetch(`https://api.heroku.com${route}`, {
      method,
      body,
      headers: {
        ...(["PATCH", "POST", "PUT"].includes(method) && {
          "Content-Type": "application/json",
        }),
        Accept: "application/vnd.heroku+json; version=3",
        Authorization: `Bearer ${this._apiKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response;
  }

  async getApps(): Promise<App[]> {
    return await (await this._fetch({ route: "/apps" })).json();
  }

  async getApp(props: { appName: string }): Promise<App> {
    const { appName } = props;
    const doc = await (await this._fetch({ route: `/apps/${appName}` })).json();
    return doc.id === "not_found" ? undefined : doc;
  }

  async updateAppBuildpacks(props: {
    appName: string;
    buildpacks: string[];
  }): Promise<boolean> {
    const { appName, buildpacks } = props;
    return (
      await this._fetch({
        route: `/apps/${appName}/buildpack-installations`,
        method: "PUT",
        body: JSON.stringify({
          updates: buildpacks.map((buildpack) => ({ buildpack })),
        }),
      })
    ).ok;
  }

  async createApp(props: {
    appName: string;
    region?: string;
    team?: string;
  }): Promise<App> {
    const { appName: name, region, team } = props;
    if (team) {
      return await (
        await this._fetch({
          route: "/teams/apps",
          method: "POST",
          body: JSON.stringify({ name, region, team }),
        })
      ).json();
    }
    return await (
      await this._fetch({
        route: "/apps",
        method: "POST",
        body: JSON.stringify({ name, region }),
      })
    ).json();
  }

  private async _getPipeline(props: {
    pipelineName: string;
  }): Promise<Pipeline> {
    const { pipelineName } = props;
    const doc = await (
      await this._fetch({ route: `/pipelines/${pipelineName}` })
    ).json();
    return doc.id === "not_found" ? undefined : doc;
  }

  async addAppToPipeline(props: {
    appName: string;
    pipelineName: string;
    stage: "test" | "review" | "development" | "staging" | "production";
  }): Promise<boolean> {
    const { appName: app, pipelineName, stage } = props;
    const pipeline = await this._getPipeline({ pipelineName });
    if (pipeline) {
      return (
        await this._fetch({
          route: "/pipeline-couplings",
          method: "POST",
          body: JSON.stringify({ app, pipeline: pipeline.id, stage }),
        })
      ).ok;
    }
    return false;
  }

  async getAppEnvVars(props: {
    appName: string;
  }): Promise<Record<string, string>> {
    const { appName } = props;
    return await (
      await this._fetch({ route: `/apps/${appName}/config-vars` })
    ).json();
  }

  async updateAppEnvVars(props: {
    appName: string;
    envVars: Record<string, string>;
  }): Promise<Boolean> {
    const { appName, envVars } = props;
    return (
      await this._fetch({
        route: `/apps/${appName}/config-vars`,
        method: "PATCH",
        body: JSON.stringify(envVars),
      })
    ).ok;
  }

  async addAppDomain(props: {
    appName: string;
    hostname: string;
    sni_endpoint?: string;
  }): Promise<Domain> {
    const { appName, hostname, sni_endpoint } = props;
    return await (
      await this._fetch({
        route: `/apps/${appName}/domains`,
        method: "POST",
        body: JSON.stringify({ hostname, sni_endpoint }),
      })
    ).json();
  }

  async enableAppAutoCerts(props: { appName: string }): Promise<boolean> {
    const { appName } = props;
    return (
      await this._fetch({ route: `/apps/${appName}/acm`, method: "POST" })
    ).ok;
  }
}
