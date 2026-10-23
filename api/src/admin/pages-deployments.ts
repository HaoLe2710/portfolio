import type { WorkerBindings } from "../types/env";
import { AdminError } from "./errors";

type PagesStage = {
  name: string;
  status: string;
  started_on?: string | null;
  ended_on?: string | null;
};

export type PagesDeployment = {
  id: string;
  url: string;
  environment: "preview" | "production";
  project_name: string;
  deployment_trigger?: {
    metadata?: { branch?: string; commit_hash?: string; commit_message?: string };
    type?: string;
  };
  latest_stage?: PagesStage;
  stages?: PagesStage[];
  uses_functions?: boolean;
};

type PagesApiEnvelope<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ code?: number; message?: string }>;
};

export type PagesApiConfiguration = WorkerBindings & {
  PAGES_STAGING_BRANCH?: string;
};

export function assertPagesDeploymentConfigured(context: PagesApiConfiguration) {
  configuration(context);
}

export class PagesApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "PagesApiError";
  }
}

function configuration(context: PagesApiConfiguration) {
  const accountId = context.CLOUDFLARE_ACCOUNT_ID?.trim();
  const project = context.PAGES_PROJECT_NAME?.trim();
  const token = context.CLOUDFLARE_API_TOKEN?.trim();
  const branch = context.PAGES_STAGING_BRANCH?.trim();
  const buildToken = context.PAGES_BUILD_TOKEN?.trim();
  if (!accountId || !project || !token || !branch || !buildToken) {
    throw new AdminError(503, "PAGES_DEPLOYMENT_NOT_CONFIGURED", "Staging Pages deployment credentials or target configuration are missing.");
  }
  if (project !== "web-porfolio") {
    throw new AdminError(503, "PAGES_PROJECT_NOT_ALLOWED", "The configured Pages project is not the portfolio project.");
  }
  return { accountId, project, token, branch, buildToken };
}

function projectPath(accountId: string, project: string) {
  return `/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(project)}`;
}

async function apiRequest<T>(
  context: PagesApiConfiguration,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { token } = configuration(context);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null) as PagesApiEnvelope<T> | null;
    if (!response.ok || !body?.success || body.result === undefined) {
      const providerMessage = body?.errors?.map((error) => error.message).filter(Boolean).join("; ");
      const status = response.status || 502;
      const retryable = status === 408 || status === 429 || status >= 500;
      throw new PagesApiError(
        status,
        status === 401 ? "CLOUDFLARE_UNAUTHORIZED"
          : status === 403 ? "CLOUDFLARE_FORBIDDEN"
            : status === 429 ? "CLOUDFLARE_RATE_LIMITED"
              : "CLOUDFLARE_API_ERROR",
        (providerMessage || `Cloudflare Pages API returned HTTP ${status}.`).slice(0, 500),
        retryable
      );
    }
    return body.result;
  } catch (error) {
    if (error instanceof PagesApiError || error instanceof AdminError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PagesApiError(408, "CLOUDFLARE_TIMEOUT", "Cloudflare Pages API request timed out.", true);
    }
    throw new PagesApiError(502, "CLOUDFLARE_NETWORK_ERROR", "Cloudflare Pages API could not be reached.", true);
  } finally {
    clearTimeout(timeout);
  }
}

type PagesProject = {
  name: string;
  source?: {
    type?: string;
    config?: {
      owner?: string;
      repo_name?: string;
      production_branch?: string;
      preview_deployment_setting?: "all" | "none" | "custom";
      preview_branch_includes?: string[];
      preview_branch_excludes?: string[];
    };
  };
};

async function verifyStagingProject(context: PagesApiConfiguration) {
  const { accountId, project, branch } = configuration(context);
  const details = await apiRequest<PagesProject>(context, projectPath(accountId, project));
  const source = details.source?.config;
  if (details.name !== project || details.source?.type !== "github" || source?.owner !== "HaoLe2710" ||
      source.repo_name !== "portfolio" || source.production_branch !== "main") {
    throw new AdminError(503, "PAGES_SOURCE_MISMATCH", "Cloudflare Pages source does not match the expected portfolio repository and main production branch.");
  }
  const previewAllowed = source.preview_deployment_setting === "all" ||
    (source.preview_deployment_setting === "custom" &&
      (source.preview_branch_includes ?? []).some((pattern) => branchMatches(pattern, branch)) &&
      !(source.preview_branch_excludes ?? []).some((pattern) => branchMatches(pattern, branch)));
  if (!previewAllowed) {
    throw new AdminError(503, "PAGES_PREVIEW_BRANCH_DISABLED", "The staging branch is not enabled for Pages Preview deployments.");
  }

}

function branchMatches(pattern: string, branch: string) {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return pattern === branch;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(branch);
}

export async function preparePagesReleaseBuild(
  context: PagesApiConfiguration,
  releaseId: string,
  checksum: string
) {
  await verifyStagingProject(context);
  const { accountId, project, branch, buildToken } = configuration(context);
  await apiRequest<PagesProject>(context, projectPath(accountId, project), {
    method: "PATCH",
    body: JSON.stringify({
      deployment_configs: {
        preview: {
          env_vars: {
            PORTFOLIO_RELEASE_ID: { type: "plain_text", value: releaseId },
            PORTFOLIO_RELEASE_CHECKSUM: { type: "plain_text", value: checksum },
            PORTFOLIO_BUILD_TOKEN: { type: "secret_text", value: buildToken },
          },
        },
      },
    }),
  });
  return { branch, project, accountId };
}

export async function resolveGitBranchHead(
  context: PagesApiConfiguration,
  branch: string
) {
  const repository = context.GITHUB_REPOSITORY?.trim() || "HaoLe2710/portfolio";
  if (repository.toLowerCase() !== "haole2710/portfolio") {
    throw new AdminError(503, "GITHUB_REPOSITORY_NOT_ALLOWED", "The configured Git repository is not the portfolio repository.");
  }
  const response = await fetch(
    `https://api.github.com/repos/${repository}/branches/${encodeURIComponent(branch)}`,
    { headers: { Accept: "application/vnd.github+json", "User-Agent": "Hao.dev-Portfolio-CMS" } }
  );
  if (!response.ok) {
    throw new PagesApiError(response.status, "GITHUB_BRANCH_LOOKUP_FAILED", "Could not resolve the staging branch commit from GitHub.", response.status === 429 || response.status >= 500);
  }
  const body = await response.json() as { commit?: { sha?: string } };
  const sha = body.commit?.sha;
  if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw new PagesApiError(502, "GITHUB_COMMIT_INVALID", "GitHub returned an invalid staging commit SHA.", false);
  }
  return sha.toLowerCase();
}

export async function triggerPagesPreviewDeployment(
  context: PagesApiConfiguration,
  branch: string,
  commitSha: string,
  requestMarker: string
) {
  const { accountId, project } = configuration(context);
  const form = new FormData();
  form.set("branch", branch);
  form.set("commit_dirty", "false");
  form.set("commit_hash", commitSha);
  form.set("commit_message", requestMarker);
  return apiRequest<PagesDeployment>(context, `${projectPath(accountId, project)}/deployments`, {
    method: "POST",
    body: form,
  });
}

export async function getPagesDeployment(
  context: PagesApiConfiguration,
  deploymentId: string
) {
  const { accountId, project } = configuration(context);
  return apiRequest<PagesDeployment>(context,
    `${projectPath(accountId, project)}/deployments/${encodeURIComponent(deploymentId)}`);
}

export async function findPagesDeploymentForRelease(
  context: PagesApiConfiguration,
  branch: string,
  commitSha: string,
  requestMarker: string
) {
  const { accountId, project } = configuration(context);
  const query = new URLSearchParams({ env: "preview", page: "1" });
  const result = await apiRequest<PagesDeployment[]>(context,
    `${projectPath(accountId, project)}/deployments?${query.toString()}`);
  return result.find((deployment) =>
    deployment.project_name === project &&
    deployment.environment === "preview" &&
    deployment.deployment_trigger?.metadata?.branch === branch &&
    deployment.deployment_trigger?.metadata?.commit_hash?.toLowerCase() === commitSha.toLowerCase() &&
    deployment.deployment_trigger?.metadata?.commit_message === requestMarker
  ) ?? null;
}

export async function rollbackProductionPagesDeployment(
  context: PagesApiConfiguration,
  deploymentId: string
) {
  const { accountId, project } = configuration(context);
  const deployment = await getPagesDeployment(context, deploymentId);
  if (deployment.environment !== "production" || deployment.project_name !== project) {
    throw new AdminError(403, "ROLLBACK_TARGET_INVALID", "Only a successful production deployment for this Pages project can be selected for rollback.");
  }
  return apiRequest<PagesDeployment>(
    context,
    `${projectPath(accountId, project)}/deployments/${encodeURIComponent(deploymentId)}/rollback`,
    { method: "POST" }
  );
}
