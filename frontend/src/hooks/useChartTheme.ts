import { useSyncExternalStore } from 'react';

/**
 * Theme-aware chart color palette.
 *
 * Recharts renders SVG, so it cannot use CSS custom properties directly.
 * This hook reads the active theme from the <html data-theme> attribute
 * and returns color values appropriate for light or dark mode.
 */

type ChartPalette = {
  axisTick: { fontSize: number; fill: string };
  axisStroke: string;
  gridStroke: string;
  tooltip: {
    background: string;
    border: string;
    borderRadius: number;
    fontSize: number;
    color?: string;
  };
  linePrimary: string;
  lineSecondary: string;
  lineTertiary: string;
  lineQuaternary: string;
  barFill: string;
  areaFillOpacity: number;
};

const LIGHT: ChartPalette = {
  axisTick: { fontSize: 10, fill: 'rgba(29, 19, 6, 0.65)' },
  axisStroke: 'rgba(229, 150, 54, 0.35)',
  gridStroke: 'rgba(229, 150, 54, 0.18)',
  tooltip: {
    background: '#fff',
    border: '1px solid rgba(229, 150, 54, 0.35)',
    borderRadius: 8,
    fontSize: 12,
    color: '#1d1306',
  },
  linePrimary: '#e59636',
  lineSecondary: '#c97d1e',
  lineTertiary: '#8a5a12',
  lineQuaternary: '#a36a1f',
  barFill: '#c97d1e',
  areaFillOpacity: 0.4,
};

const DARK: ChartPalette = {
  axisTick: { fontSize: 10, fill: 'rgba(255, 240, 220, 0.75)' },
  axisStroke: 'rgba(229, 150, 54, 0.45)',
  gridStroke: 'rgba(229, 150, 54, 0.22)',
  tooltip: {
    background: '#241a10',
    border: '1px solid rgba(229, 150, 54, 0.45)',
    borderRadius: 8,
    fontSize: 12,
    color: '#fff0dc',
  },
  linePrimary: '#e59636',
  lineSecondary: '#f0a040',
  lineTertiary: '#c97d1e',
  lineQuaternary: '#d4882a',
  barFill: '#e59636',
  areaFillOpacity: 0.5,
};

function getTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

export function useChartTheme(): ChartPalette {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light');
  return theme === 'dark' ? DARK : LIGHT;
}
