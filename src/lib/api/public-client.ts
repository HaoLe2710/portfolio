import { requestApi } from "./http-client";

export type ApiQueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

export async function publicGet<T>(
  path: string,
  params?: ApiQueryParams
): Promise<T> {
  return requestApi<T>({
    method: "GET",
    params,
    url: path,
  });
}
