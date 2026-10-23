import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
} from "axios";
import { toApiError } from "./api-error";
import { unwrapApiResponse, type ApiResponse } from "./api-response";

const DEFAULT_API_BASE_URL = "http://localhost:8080/api";
const DEFAULT_TIMEOUT_MS = 10000;

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;

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
