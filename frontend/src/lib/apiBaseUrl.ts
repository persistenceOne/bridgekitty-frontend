/**
 * Resolves the base URL for the BridgeKitty backend API.
 *
 * Priority:
 *  1. VITE_BRIDGEKITTY_API_BASE_URL env var (set in .env or at build time)
 *  2. localhost:8080/api when running on a local hostname (dev fallback only)
 *  3. Empty string — callers should throw 'Backend API URL unavailable.'
 */
export function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_BRIDGEKITTY_API_BASE_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/$/, '');
  }

  if (
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ) {
    return 'http://localhost:8080/api';
  }

  return '';
}
