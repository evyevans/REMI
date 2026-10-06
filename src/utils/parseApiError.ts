/**
 * parseApiError — Safely extract human-readable messages from FastAPI errors.
 *
 * FastAPI 422 returns:
 *   { "detail": [{ "loc": ["body", "tenure"], "msg": "...", "type": "..." }] }
 *
 * This utility handles all FastAPI and REMI error shapes and NEVER returns
 * "[object Object]".
 */

interface FastAPIValidationError {
  loc: string[];
  msg: string;
  type: string;
}

export function parseApiError(errorData: unknown): string {
  if (!errorData || typeof errorData !== 'object') {
    return 'Request failed. Please try again.';
  }

  const data = errorData as Record<string, unknown>;

  // Case 1: FastAPI 422 — detail is an array of validation errors
  if (Array.isArray(data.detail)) {
    return (data.detail as FastAPIValidationError[])
      .map(err => {
        const field = err.loc?.slice(1).join(' → ') || 'field';
        return `${field}: ${err.msg}`;
      })
      .join(' | ');
  }

  // Case 2: FastAPI string detail (e.g., 404, 500 with message)
  if (typeof data.detail === 'string') {
    return data.detail;
  }

  // Case 3: FastAPI detail is an object with a message property
  if (data.detail && typeof data.detail === 'object' && 'message' in (data.detail as Record<string, unknown>)) {
    return String((data.detail as Record<string, unknown>).message);
  }

  // Case 4: Custom REMI error formats
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;

  // Case 5: Absolute fallback — NEVER return raw object
  return 'Request failed. Please try again.';
}
