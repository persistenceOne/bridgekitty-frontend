import { resolveApiBaseUrl } from '../lib/apiBaseUrl';

export interface UserTransactionRecord {
  /** Persistence uses `id`; legacy Mongo-era records may carry `_id`. */
  id?: string;
  _id?: string;
  userAddress: string;
  txHash: string;
  quoteId?: string;
  provider?: string;
  fromChain: string;
  toChain: string;
  fromTokenSymbol: string;
  toTokenSymbol: string;
  amount: string;
  volumeUsd?: number;
  status?: string;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchUserTransactionHistory(
  userAddress: string,
  limit = 50
): Promise<UserTransactionRecord[]> {
  const base = resolveApiBaseUrl();
  if (!base) {
    throw new Error('Backend API URL unavailable.');
  }

  const params = new URLSearchParams({
    userAddress,
    limit: String(limit)
  });

  const response = await fetch(`${base}/transactions?${params.toString()}`, {
    method: 'GET'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Failed to fetch transaction history (${response.status}).`);
  }

  const payload = (await response.json()) as {
    records?: UserTransactionRecord[];
  };

  return payload.records ?? [];
}
