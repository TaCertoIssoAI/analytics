/**
 * HTTP Client with Token Injection
 *
 * This module provides authenticated HTTP client functions that automatically
 * inject Firebase ID tokens into requests. It supports both fetch and can be
 * easily adapted for axios or other HTTP libraries.
 */

import { auth } from './firebaseConfig';
import { getMockCurrentUser, mockGetIdToken } from './mockFirebase';
import { isUsingMockAuth } from './firebaseConfig';

/**
 * Get the current authentication token
 * Works in both real Firebase and mock modes
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    if (isUsingMockAuth) {
      const mockUser = getMockCurrentUser();
      if (!mockUser) {
        return null;
      }
      return await mockGetIdToken(mockUser);
    } else if (auth?.currentUser) {
      return await auth.currentUser.getIdToken();
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to get auth token:', error);
    return null;
  }
};

/**
 * Fetch wrapper with automatic token injection
 *
 * This function wraps the standard fetch API and automatically adds
 * the Authorization header with the Firebase ID token.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @returns Promise with the fetch response
 *
 * @example
 * ```ts
 * const response = await fetchWithAuth('/api/protected-endpoint', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' }),
 * });
 * ```
 */
export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getAuthToken();

  // Merge headers with authorization token
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
};

/**
 * Type for common HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Generic authenticated HTTP request helper
 *
 * @param method - HTTP method
 * @param url - The URL to fetch
 * @param body - Optional request body (will be JSON stringified)
 * @param options - Additional fetch options
 * @returns Promise with parsed JSON response
 */
export const authenticatedRequest = async <T = unknown>(
  method: HttpMethod,
  url: string,
  body?: unknown,
  options: RequestInit = {}
): Promise<T> => {
  const fetchOptions: RequestInit = {
    method,
    ...options,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetchWithAuth(url, fetchOptions);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Convenience method for GET requests
 */
export const get = <T = unknown>(url: string, options?: RequestInit): Promise<T> => {
  return authenticatedRequest<T>('GET', url, undefined, options);
};

/**
 * Convenience method for POST requests
 */
export const post = <T = unknown>(url: string, body?: unknown, options?: RequestInit): Promise<T> => {
  return authenticatedRequest<T>('POST', url, body, options);
};

/**
 * Convenience method for PUT requests
 */
export const put = <T = unknown>(url: string, body?: unknown, options?: RequestInit): Promise<T> => {
  return authenticatedRequest<T>('PUT', url, body, options);
};

/**
 * Convenience method for PATCH requests
 */
export const patch = <T = unknown>(url: string, body?: unknown, options?: RequestInit): Promise<T> => {
  return authenticatedRequest<T>('PATCH', url, body, options);
};

/**
 * Convenience method for DELETE requests
 */
export const del = <T = unknown>(url: string, options?: RequestInit): Promise<T> => {
  return authenticatedRequest<T>('DELETE', url, undefined, options);
};

/**
 * Create an axios-like interceptor for fetch (optional)
 * This can be used with libraries that support request interceptors
 */
export const createAuthInterceptor = () => {
  return async (config: RequestInit & { url?: string }) => {
    const token = await getAuthToken();

    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    return config;
  };
};

// Example: How to use with axios (if installed)
// import axios from 'axios';
//
// axios.interceptors.request.use(async (config) => {
//   const token = await getAuthToken();
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });
