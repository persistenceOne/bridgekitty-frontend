import type { ChainKey } from '../lib/chains';
import { getChainByKey } from '../lib/catalogStore';
import { resolveApiBaseUrl } from '../lib/apiBaseUrl';

export type TxStage = 'submitted' | 'confirming' | 'bridging' | 'completed' | 'failed' | 'pending';

export interface TxStatusResult {
  status: TxStage;
  substatus?: string;         // Human-readable message
  substatusCode?: string;     // Reserved for upstream enum codes (kept for UI compat)
  sendingTxHash?: string;     // Source-chain tx
  receivingTxHash?: string;   // Destination-chain tx (cross-chain only, appears late)
  explorerLink?: string;      // Best explorer link (destination tx if available)
  lifiExplorerLink?: string;  // LI.FI cross-chain explorer (kept for UI compat)
}

/** bridgekitty-backend `/status` response shape. */
interface BackendStatus {
  state: 'pending' | 'in_progress' | 'completed' | 'failed' | 'refunded' | 'unknown';
  humanReadable: string;
  sourceTxHash?: string;
  destTxHash?: string;
  provider: string;
  elapsed: number;
  estimatedRemaining?: number;
}

function mapState(state: BackendStatus['state']): TxStage {
  switch (state) {
    case 'pending': return 'pending';
    case 'in_progress': return 'bridging';
    case 'completed': return 'completed';
    case 'failed':
    case 'refunded':
      return 'failed';
    case 'unknown':
    default:
      return 'confirming';
  }
}

export async function fetchTransactionStatus(
  txHash: string,
  trackingId: string,
  fromChain: ChainKey,
  toChain?: ChainKey
): Promise<TxStatusResult> {
  const base = resolveApiBaseUrl();
  if (!base) throw new Error('Backend API URL unavailable.');

  const fromChainId = getChainByKey(fromChain)?.chainId;
  const toChainId = getChainByKey(toChain ?? fromChain)?.chainId;

  const params = new URLSearchParams();
  if (txHash) params.set('txHash', txHash);
  if (fromChainId) params.set('fromChain', String(fromChainId));
  if (toChainId) params.set('toChain', String(toChainId));

  const url = `${base}/status/${encodeURIComponent(trackingId)}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Status check failed (${response.status}).`);
  }

  const data = (await response.json()) as BackendStatus;

  return {
    status: mapState(data.state),
    substatus: data.humanReadable,
    sendingTxHash: data.sourceTxHash ?? txHash,
    receivingTxHash: data.destTxHash,
  };
}

const STAGE_PROGRESS: Record<TxStage, number> = {
  submitted: 10,
  pending: 15,
  confirming: 30,
  bridging: 60,
  completed: 100,
  // Keep the progress bar visible on failure — the UI recolors it red
  // instead of collapsing to 0 so the user sees a clear failed state.
  failed: 100
};

export function stageToProgress(stage: TxStage): number {
  return STAGE_PROGRESS[stage] ?? 10;
}

/**
 * Poll transaction status until a terminal state is reached.
 * Calls onUpdate with each new status. Returns a stop handle.
 *
 * `trackingId` is what `/execute` returned (e.g. "lifi:0xhash", "debridge:0xorder").
 */
export function pollTransactionStatus(
  txHash: string,
  trackingId: string,
  fromChain: ChainKey,
  onUpdate: (result: TxStatusResult) => void,
  toChain?: ChainKey,
  intervalMs = 5000,
  maxAttempts = 120
): { stop: () => void } {
  let stopped = false;
  let attempts = 0;
  let consecutiveErrors = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const poll = async () => {
    if (stopped) return;
    attempts++;

    try {
      const result = await fetchTransactionStatus(txHash, trackingId, fromChain, toChain);
      if (stopped) return;
      consecutiveErrors = 0;
      onUpdate(result);

      if (result.status === 'completed' || result.status === 'failed') {
        return; // Terminal — stop polling
      }
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors >= 6 && !stopped) {
        onUpdate({
          status: 'failed',
          substatus: 'Status check unavailable. Check the explorer link for the latest state.'
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.warn('[status-poll] fetch failed, will retry', err);
    }

    if (attempts < maxAttempts && !stopped) {
      timeoutId = setTimeout(poll, intervalMs);
    } else if (attempts >= maxAttempts && !stopped) {
      onUpdate({
        status: 'failed',
        substatus: 'Timed out waiting for confirmation. Check the explorer link for the latest state.'
      });
    }
  };

  // Start after initial delay (tx needs time to propagate)
  timeoutId = setTimeout(poll, 3000);

  return {
    stop: () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
    }
  };
}
