/**
 * Chain catalog moved to the backend (see lib/catalogStore.ts).
 *
 * This file now only exports compile-time constants and type aliases that
 * outlive the dynamic catalog: the EIP-7528 native-token sentinel address
 * and the legacy `ChainKey` / `TokenTag` / `TokenOption` / `ChainOption`
 * type names which are now plain re-exports of the dynamic shapes.
 */

export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export type ChainKey = string;
export type { TokenTag, Chain as ChainOption, Token as TokenOption } from './catalog';
