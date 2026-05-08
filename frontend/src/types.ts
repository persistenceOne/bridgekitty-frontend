import type { ChainKey } from './lib/chains';
import type { TxStage as StatusTxStage } from './services/transactionStatusService';

export type EntryView = 'landing' | 'human' | 'agent' | 'stats';

export type ProviderKey = 'lifi' | 'debridge' | 'squid' | 'relay' | 'across' | 'symbiosis' | 'meson';

export interface SwapDraft {
  fromChain: ChainKey;
  toChain: ChainKey;
  fromTokenSymbol: string;
  toTokenSymbol: string;
  /** Optional address for unambiguous selection — set when the user picks a
   *  long-tail token from search results that may collide with a curated
   *  token's symbol. Falls back to symbol-only lookup if undefined. */
  fromTokenAddress?: string;
  toTokenAddress?: string;
  amount: string;
}

export type TxStage = StatusTxStage;

export interface TxStatus {
  hash: string;
  stage: TxStage;
  progress: number;
  substatus?: string;
  substatusCode?: string;
  sendingTxHash?: string;
  receivingTxHash?: string;
  explorerLink?: string;
  lifiExplorerLink?: string;
}

