/**
 * Jules API client helper
 * Handles authentication, error handling, and request/response processing
 */

import type { JulesApiError } from "./types.js";

// Jules API configuration
export const JULES_API_BASE = "https://jules.googleapis.com/v1alpha";

/**
 * Get Jules API key from environment
 * @throws {Error} if JULES_API_KEY is not set
 */
export function getApiKey(): string {
  const apiKey = process.env.JULES_API_KEY;
  if (!apiKey) {
    throw new Error(
      "JULES_API_KEY environment variable is required. " +
      "Get your API key from https://jules.google.com/settings#api"
    );
  }
  return apiKey;
}

/**
 * Make a request to the Jules API
 * @param endpoint - API endpoint path (e.g., "/sources", "/sessions")
 * @param options - Fetch options (method, body, etc.)
 * @returns Parsed JSON response
 * @throws {Error} on API errors with descriptive messages
 */
export async function julesRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const url = `${JULES_API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    // Handle non-OK responses
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let errorMessage = `Jules API error ${response.status}: ${response.statusText}`;

      // Try to parse error body if it's JSON
      if (contentType?.includes("application/json")) {
        try {
          const errorData = (await response.json()) as JulesApiError;
          if (errorData.error?.message) {
            errorMessage = `Jules API error ${response.status}: ${errorData.error.message}`;
          }
        } catch {
          // If JSON parsing fails, use the original error message
        }
      } else {
        // For non-JSON errors, try to get text body
        const errorText = await response.text();
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      throw new Error(errorMessage);
    }

    // Parse successful response
    return (await response.json()) as T;
  } catch (error) {
    // Re-throw with additional context if it's a network error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Network error connecting to Jules API: ${error.message}`
      );
    }
    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Format error for MCP tool response
 * Extracts user-friendly message without exposing sensitive details
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unknown error occurred";
}
