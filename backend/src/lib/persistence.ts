/**
 * Thin helper for proxying requests to the Persistence BridgeKitty API.
 *
 * Our backend is an adapter in front of https://api.bridgekitty.persistence.one —
 * routing, quoting, status, analytics, and user data all live there. Everything
 * in this repo's /api/* tree forwards through these helpers.
 */

import { env } from '../config/env.js';

export interface ProxyRequest {
  method: 'GET' | 'POST';
  path: string;               // e.g. "/wallets" or "/status/lifi:0x..."
  query?: Record<string, string | number | undefined>;
  body?: unknown;             // JSON-serializable
}

export interface ProxyResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  errorText?: string;
}

function buildUrl(path: string, query?: ProxyRequest['query']): string {
  const url = new URL(`${env.PERSISTENCE_API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function persistenceRequest<T = unknown>(req: ProxyRequest): Promise<ProxyResult<T>> {
  const url = buildUrl(req.path, req.query);
  const init: RequestInit = {
    method: req.method,
    headers: req.body != null ? { 'Content-Type': 'application/json' } : undefined,
    body: req.body != null ? JSON.stringify(req.body) : undefined,
  };

  const response = await fetch(url, init);
  const text = await response.text();

  let data: T | null = null;
  if (text.length > 0) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      // Non-JSON response — surface the raw text as error detail.
      return { ok: response.ok, status: response.status, data: null, errorText: text };
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    errorText: response.ok ? undefined : text,
  };
}
