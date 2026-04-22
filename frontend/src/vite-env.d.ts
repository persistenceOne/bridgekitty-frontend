/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_BRIDGEKITTY_API_BASE_URL?: string;
  readonly VITE_BRIDGEKITTY_QUOTE_PROXY_URL?: string;
  readonly VITE_BRIDGEKITTY_INTENT_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
