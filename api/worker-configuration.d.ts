/// <reference types="@cloudflare/vitest-plugin/types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CORS_ALLOWED_ORIGINS?: string;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
