/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_BRIDGEKITTY_API_BASE_URL?: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
  readonly VITE_COINGECKO_API_KEY?: string;
  readonly VITE_CMC_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
