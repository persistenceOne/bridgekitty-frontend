import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrivyWalletBridge } from '../components/WalletConnector';
import { executeQuote, type QuoteResult } from '../services/quoteService';
import { pollTransactionStatus, stageToProgress, type TxStatusResult } from '../services/transactionStatusService';
import { parseUnits } from '../lib/amount';
import { ensureTokenApproval, isNativeToken } from '../lib/erc20';
import { toHexQuantity, validateTransactionRequest } from '../lib/swap';
import { appendBuilderCodeForChain } from '../lib/builderCode';
import { API_BASE_URL } from '../constants';
import type { ChainKey } from '../lib/chains';
import type { SwapDraft, TxStatus } from '../types';

export function useSwapExecution(
  walletBridge: PrivyWalletBridge | null,
  fromChainId: number,
  onPostSwap: () => void
) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);
  const [error, setError] = useState('');

  const statusPollerRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => { statusPollerRef.current?.stop(); };
  }, []);

  const startStatusPolling = useCallback((
    hash: string,
    trackingId: string,
    fromChain: ChainKey,
    toChain: ChainKey
  ) => {
    statusPollerRef.current?.stop();

    setTxStatus({ hash, stage: 'submitted', progress: stageToProgress('submitted') });

    statusPollerRef.current = pollTransactionStatus(
      hash,
      trackingId,
      fromChain,
      (result: TxStatusResult) => {
        setTxStatus((prev) => {
          if (!prev || prev.hash !== hash) return prev;
          return {
            ...prev,
            stage: result.status,
            progress: stageToProgress(result.status),
            substatus: result.substatus,
            substatusCode: result.substatusCode,
            sendingTxHash: result.sendingTxHash,
            receivingTxHash: result.receivingTxHash,
            explorerLink: result.explorerLink,
            lifiExplorerLink: result.lifiExplorerLink
          };
        });
      },
      toChain
    );
  }, []);

  const recordSwap = useCallback(async (
    txHash: string,
    address: string,
    quoteId: string,
    draft: SwapDraft,
    provider: string,
    volumeUsd: number | undefined,
    fees: {
      feeUsd?: number;
      integratorFeeUsd?: number;
      protocolFeeUsd?: number;
      gasCostUsd?: number;
      fixFeeUsd?: number;
    } | undefined
  ) => {
    const feeFields = fees ?? {};
    try {
      await fetch(`${API_BASE_URL}/swaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          quoteId,
          fromChain: draft.fromChain,
          toChain: draft.toChain,
          fromTokenSymbol: draft.fromTokenSymbol,
          toTokenSymbol: draft.toTokenSymbol,
          amount: draft.amount,
          ...(volumeUsd != null && { volumeUsd }),
          // Fee breakdown — backend persists these into swap_records and
          // transaction_history columns (added in v0.2.2). Optional fields;
          // backend treats missing values as null.
          ...(feeFields.feeUsd != null && { feeUsd: feeFields.feeUsd }),
          ...(feeFields.integratorFeeUsd != null && { integratorFeeUsd: feeFields.integratorFeeUsd }),
          ...(feeFields.protocolFeeUsd != null && { protocolFeeUsd: feeFields.protocolFeeUsd }),
          ...(feeFields.gasCostUsd != null && { gasCostUsd: feeFields.gasCostUsd }),
          ...(feeFields.fixFeeUsd != null && { fixFeeUsd: feeFields.fixFeeUsd }),
          status: 'submitted',
          txHash,
          provider,
          metadata: { txHash, provider }
        })
      });
    } catch { /* non-critical */ }
  }, []);

  const executeSwap = useCallback(async (
    draft: SwapDraft,
    bestQuote: QuoteResult,
    selectedFromToken: { address: string; decimals: number; symbol: string },
    requestedAmountRaw: bigint | null,
    privyLogin: () => void,
    hasPrivy: boolean,
    isAuthenticated: boolean,
    isAmountInsufficient: boolean,
    volumeUsd?: number
  ) => {
    if (!walletBridge) {
      if (hasPrivy && !isAuthenticated) {
        privyLogin();
      } else {
        setError('Please connect your wallet first.');
      }
      return;
    }

    if (isAmountInsufficient) {
      setError(`Insufficient ${selectedFromToken.symbol} balance for this swap amount.`);
      return;
    }

    try {
      setIsExecuting(true);
      setError('');
      setTxStatus(null);

      // Two-step flow: bridgekitty-backend's /quote returns quote metadata only;
      // /execute builds the unsigned tx for the chosen quoteId.
      let executed = await executeQuote(bestQuote.id);

      // Defence-in-depth: confirm the calldata actually references our wallet.
      // The backend already does this server-side, but two layers is fine.
      const walletNeedle = walletBridge.address.toLowerCase().replace(/^0x/, '');
      const calldata = (executed.transactionRequest.data ?? '').toLowerCase();
      if (calldata.length > 10 && walletNeedle && !calldata.includes(walletNeedle)) {
        setError(
          'Safety check failed: this quote does not appear to route funds to your connected wallet. Refresh quotes and try again.'
        );
        return;
      }

      const txValidationError = validateTransactionRequest(executed.transactionRequest);
      if (txValidationError) {
        setError(txValidationError);
        return;
      }

      await walletBridge.switchChain(fromChainId);
      const provider = await walletBridge.getEthereumProvider();

      // ERC-20 approval: prefer the backend's pre-built approval tx when present;
      // fall back to ensureTokenApproval for the legacy/native flow.
      if (executed.approvalTransaction) {
        const approvalTxHash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: walletBridge.address,
            to: executed.approvalTransaction.to,
            data: executed.approvalTransaction.data,
            value: toHexQuantity(executed.approvalTransaction.value) ?? '0x0',
          }],
        })) as string;
        // Wait briefly for the approval to propagate. We don't wait for full
        // confirmation here — just enough that the next eth_sendTransaction
        // sees the new allowance. ensureTokenApproval would do this for us
        // but we already have the approval payload from the backend.
        await new Promise((r) => setTimeout(r, 2000));
        // Some providers (deBridge) embed a nonce in the bridge tx that goes
        // stale once the approval is mined — re-fetch the bridge tx in that case.
        if (executed.needsPostApprovalBuild) {
          executed = await executeQuote(bestQuote.id);
        }
        void approvalTxHash;
      } else if (!isNativeToken(selectedFromToken.address)) {
        // Backend did not return an approval tx — use the local helper to ensure
        // allowance is sufficient before the bridge call.
        const spenderAddress = executed.transactionRequest.to;
        if (spenderAddress) {
          const requiredAmount = requestedAmountRaw ?? parseUnits(draft.amount, selectedFromToken.decimals);
          await ensureTokenApproval(
            provider,
            selectedFromToken.address,
            walletBridge.address,
            spenderAddress,
            requiredAmount
          );
        }
      }

      const txParams: Record<string, unknown> = {
        from: walletBridge.address,
        to: executed.transactionRequest.to,
        // Base Builder Code: append builder data for Base chain only. Additionally, deBridge DLN
        // creates an on-chain order by hashing calldata — extra trailing bytes
        // corrupt the order hash regardless of source chain, so skip for deBridge.
        data: bestQuote.provider !== 'debridge-api'
          ? appendBuilderCodeForChain(executed.transactionRequest.data, fromChainId)
          : (executed.transactionRequest.data ?? '0x'),
        value: toHexQuantity(executed.transactionRequest.value) ?? '0x0',
      };

      if (executed.transactionRequest.maxFeePerGas) {
        txParams.maxFeePerGas = toHexQuantity(executed.transactionRequest.maxFeePerGas);
        txParams.maxPriorityFeePerGas = toHexQuantity(executed.transactionRequest.maxPriorityFeePerGas);
      } else if (executed.transactionRequest.gasPrice) {
        txParams.gasPrice = toHexQuantity(executed.transactionRequest.gasPrice);
      }
      if (executed.transactionRequest.gasLimit) {
        txParams.gas = toHexQuantity(executed.transactionRequest.gasLimit);
      }

      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      })) as string;

      startStatusPolling(txHash, executed.trackingId, draft.fromChain, draft.toChain);

      // Extract fee breakdown from the raw backend response (BackendQuote shape)
      // for persistence into swap_records / transaction_history.
      const rawFee = (bestQuote.raw as { feeBreakdown?: {
        gasCostUsd?: number | null;
        protocolFeeUsd?: number;
        integratorFeeUsd?: number;
        fixFeeUsd?: number;
      } } | undefined)?.feeBreakdown;
      await recordSwap(
        txHash,
        walletBridge.address,
        bestQuote.id,
        draft,
        bestQuote.provider,
        volumeUsd,
        {
          feeUsd: bestQuote.feeUsd,
          integratorFeeUsd: bestQuote.integratorFeeUsd,
          protocolFeeUsd: rawFee?.protocolFeeUsd,
          gasCostUsd: rawFee?.gasCostUsd ?? undefined,
          fixFeeUsd: bestQuote.fixFeeUsd ?? rawFee?.fixFeeUsd,
        }
      );

      onPostSwap();
    } catch (caughtError) {
      setTxStatus((p) => p ? { ...p, stage: 'failed', progress: p.progress } : null);
      setError(caughtError instanceof Error ? caughtError.message : 'Swap execution failed.');
    } finally {
      setIsExecuting(false);
    }
  }, [walletBridge, fromChainId, startStatusPolling, recordSwap, onPostSwap]);

  const clearTxStatus = useCallback(() => setTxStatus(null), []);
  const clearError = useCallback(() => setError(''), []);

  return {
    isExecuting,
    txStatus,
    error,
    executeSwap,
    clearTxStatus,
    clearError,
  };
}
