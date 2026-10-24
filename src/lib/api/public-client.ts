import type { AxiosRequestConfig } from "axios";
import { requestApi } from "./http-client";

export type ApiQueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

export async function publicGet<T>(
  path: string,
  params?: ApiQueryParams,
  headers?: AxiosRequestConfig["headers"]
): Promise<T> {
  return requestApi<T>({
    headers,
    method: "GET",
    params,
    url: path,
  });
}
