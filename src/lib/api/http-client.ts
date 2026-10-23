import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";
import { toApiError } from "./api-error";
import { unwrapApiResponse, type ApiResponse } from "./api-response";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787/api";
const DEFAULT_TIMEOUT_MS = 10000;

function resolveApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;

  if (
    process.env.CF_PAGES === "1" &&
    (dataSource === "api" || dataSource === "hybrid") &&
    !configuredUrl
  ) {
    throw new Error(
      "Set NEXT_PUBLIC_API_BASE_URL to the deployed Worker API /api URL before building Cloudflare Pages in api or hybrid mode."
    );
  }

  const apiBaseUrl = configuredUrl || DEFAULT_API_BASE_URL;

  if (process.env.CF_PAGES === "1" && (dataSource === "api" || dataSource === "hybrid")) {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(apiBaseUrl);
    } catch (error) {
      throw new Error(
        "NEXT_PUBLIC_API_BASE_URL must be an absolute https URL ending in /api for Cloudflare Pages builds.",
        { cause: error }
      );
    }

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.pathname.replace(/\/+$/, "") !== "/api" ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new Error(
        "NEXT_PUBLIC_API_BASE_URL must be an absolute https URL ending in /api for Cloudflare Pages builds."
      );
    }
  }

  return apiBaseUrl;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const httpClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  timeout: DEFAULT_TIMEOUT_MS,
  withCredentials: false,
});

export async function requestApi<T>(
  config: AxiosRequestConfig
): Promise<T> {
  try {
    const response = await httpClient.request<ApiResponse<T>>(config);

    return unwrapApiResponse<T>(response.data);
  } catch (error) {
    throw toApiError(error);
  }
}
