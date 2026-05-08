export type TokenTag = 'native' | 'btc-variant' | 'stablecoin';

export interface Chain {
  key: string;
  chainId: number;
  name: string;
  logoURI: string;
  blockExplorerUrl: string | null;
}

export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI: string;
  tags?: TokenTag[];
}
