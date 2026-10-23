export type DataSourceMode = "api" | "hybrid" | "mock";

const DEFAULT_DATA_SOURCE_MODE: DataSourceMode = "mock";
const SUPPORTED_DATA_SOURCE_MODES = new Set<DataSourceMode>([
  "api",
  "hybrid",
  "mock",
]);

export function getDataSourceMode(): DataSourceMode {
  const configuredMode = process.env.NEXT_PUBLIC_DATA_SOURCE;

  if (SUPPORTED_DATA_SOURCE_MODES.has(configuredMode as DataSourceMode)) {
    return configuredMode as DataSourceMode;
  }

  if (process.env.CF_PAGES === "1") {
    throw new Error(
      "Set NEXT_PUBLIC_DATA_SOURCE to api, hybrid, or mock in Cloudflare Pages build settings."
    );
  }

  return DEFAULT_DATA_SOURCE_MODE;
}

export function isApiMode() {
  const mode = getDataSourceMode();

  return mode === "api" || mode === "hybrid";
}

export function isMockMode() {
  return getDataSourceMode() === "mock";
}
