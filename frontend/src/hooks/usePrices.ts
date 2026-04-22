import { useEffect, useState } from 'react';
import { getTokenPrices } from '../services/priceService';

export function usePrices(fromTokenSymbol: string, toTokenSymbol: string) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    getTokenPrices().then(setPrices).catch(() => {});
  // getTokenPrices fetches all token prices regardless of which tokens are selected.
  // The 30s polling interval below keeps prices fresh; no need to re-fetch on token changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      getTokenPrices().then(setPrices).catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return prices;
}
