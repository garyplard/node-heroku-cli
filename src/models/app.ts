import {Common} from './_common';

export interface App extends Common {
  acm: boolean;
  archived_at?: string;
  build_stack: Common;
  buildpack_provided_description?: string;
  created_at: string;
  git_url: string;
  internal_routing?: boolean;
  maintenance: boolean;
  organization?: Common;
  owner: {
    email: string;
    id: string;
  };
  region: Common;
  released_at?: string;
  repo_size?: number;
  slug_size?: number;
  space?: Common & {
    shield: boolean;
  };
  stack: Common;
  team?: Common;
  updated_at: string;
  web_url: string;
}
