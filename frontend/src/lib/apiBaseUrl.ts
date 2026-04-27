/**
 * Resolves the base URL for the BridgeKitty backend API.
 *
 * The frontend talks directly to the production bridgekitty-backend at
 * https://api.bridgekitty.persistence.one/api/v1 (no local proxy).
 *
 * Priority:
 *  1. VITE_BRIDGEKITTY_API_BASE_URL env var (set in .env or at build time)
 *  2. Production default: https://api.bridgekitty.persistence.one/api/v1
 */
const PRODUCTION_API_BASE_URL = 'https://api.bridgekitty.persistence.one/api/v1';

export function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_BRIDGEKITTY_API_BASE_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/$/, '');
  }
  return PRODUCTION_API_BASE_URL;
}
