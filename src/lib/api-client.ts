import axios from "axios";

const DEFAULT_API_BASE_URL = "http://localhost:8080/api";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  timeout: 5000,
});

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function safeApiGet<TResponse>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<TResponse> {
  try {
    const response = await apiClient.get<TResponse>(path, { params });

    return response.data;
  } catch (error) {
    throw new ApiError(`Failed to fetch ${path}`, error);
  }
}
