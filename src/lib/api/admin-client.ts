import { ApiError, toApiError } from "./api-error";
import {
  clearAdminAccessToken,
  getAdminAccessToken,
} from "./auth-token-store";
import { requestApi } from "./http-client";
import type { ApiQueryParams } from "./public-client";

function getAuthorizationHeader() {
  const token = getAdminAccessToken();

  if (!token) {
    throw new ApiError("Admin access token is missing.", {
      code: "UNAUTHORIZED",
      status: 401,
    });
  }

  return `Bearer ${token}`;
}

async function requestAdmin<TResponse>(
  method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT",
  path: string,
  options: {
    body?: unknown;
    params?: ApiQueryParams;
  } = {}
): Promise<TResponse> {
  try {
    return await requestApi<TResponse>({
      data: options.body,
      headers: {
        Authorization: getAuthorizationHeader(),
      },
      method,
      params: options.params,
      url: path,
    });
  } catch (error) {
    const apiError = toApiError(error);

    if (apiError.status === 401 || apiError.code === "UNAUTHORIZED") {
      clearAdminAccessToken();
    }

    throw apiError;
  }
}

export async function adminPublicPost<TResponse, TBody = unknown>(
  path: string,
  body?: TBody
): Promise<TResponse> {
  return requestApi<TResponse>({
    data: body,
    method: "POST",
    url: path,
  });
}

export async function adminGet<T>(
  path: string,
  params?: ApiQueryParams
): Promise<T> {
  return requestAdmin<T>("GET", path, { params });
}

export async function adminPost<TResponse, TBody = unknown>(
  path: string,
  body?: TBody
): Promise<TResponse> {
  return requestAdmin<TResponse>("POST", path, { body });
}

export async function adminPut<TResponse, TBody = unknown>(
  path: string,
  body?: TBody
): Promise<TResponse> {
  return requestAdmin<TResponse>("PUT", path, { body });
}

export async function adminPatch<TResponse, TBody = unknown>(
  path: string,
  body?: TBody
): Promise<TResponse> {
  return requestAdmin<TResponse>("PATCH", path, { body });
}

export async function adminDelete<TResponse = void>(
  path: string
): Promise<TResponse> {
  return requestAdmin<TResponse>("DELETE", path);
}
