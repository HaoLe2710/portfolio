export type WorkerBindings = {
  DB: D1Database;
  CORS_ALLOWED_ORIGINS?: string;
  RELEASE_ENVIRONMENT?: "staging" | "production";
  CLOUDFLARE_ACCOUNT_ID?: string;
  PAGES_PROJECT_NAME?: string;
  PAGES_STAGING_BRANCH?: string;
  GITHUB_REPOSITORY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  PAGES_BUILD_TOKEN?: string;
};

export type WorkerEnv = {
  Bindings: WorkerBindings;
  Variables: {
    admin: {
      id: string;
      email: string;
      role: "OWNER" | "ADMIN";
    };
  };
};
