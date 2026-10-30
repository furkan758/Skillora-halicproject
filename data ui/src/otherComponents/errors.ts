import axios from "axios";
import type { ApiError } from "../types";
export function apiError(
  error: unknown,
  fallback = "Could not complete the request. Please try again.",
): ApiError {
  if (axios.isAxiosError<ApiError>(error)) {
    if (error.response?.data?.message) return error.response.data;
    if (!error.response)
      return {
        code: "network_error",
        message:
          "Cannot reach the backend. Start the Skillora backend and try again.",
      };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return {
      message: error.message,
      ...("retiredSkillId" in error && typeof error.retiredSkillId === "number"
        ? { retiredSkillId: error.retiredSkillId }
        : {}),
      ...("code" in error && typeof error.code === "string"
        ? { code: error.code }
        : {}),
      ...("details" in error && Array.isArray(error.details)
        ? { details: error.details }
        : {}),
      ...("affectedEmployees" in error && Array.isArray(error.affectedEmployees)
        ? { affectedEmployees: error.affectedEmployees }
        : {}),
    };
  }
  return { message: fallback };
}
