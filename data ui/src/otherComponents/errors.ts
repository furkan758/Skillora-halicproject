import axios from "axios";
import type { ApiError } from "../types";

export function apiError(
  error: unknown,
  fallback = "Could not complete the request. Please try again.",
): ApiError {
  if (axios.isAxiosError<ApiError>(error) && error.response?.data?.message)
    return error.response.data;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return {
      message: error.message,
      ...("affectedEmployees" in error && Array.isArray(error.affectedEmployees)
        ? { affectedEmployees: error.affectedEmployees }
        : {}),
    };
  }
  return { message: fallback };
}
