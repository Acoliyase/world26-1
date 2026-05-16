import { SimulationState } from "../src/types";
import { logger } from './logger';

// Use worker's state endpoint in production, local API in development
const getStateEndpoint = () => {
  const defaultWorkerProxyUrl = 'https://mistralapicaller.yusufsamodien12.workers.dev/v1/chat/completions';
  const proxyUrl = import.meta.env.VITE_PROXY_URL
    || (import.meta as any)?.env?.VITE_PROXY_URL
    || (import.meta.env.PROD ? defaultWorkerProxyUrl : undefined);
  
  // New proxy doesn't support state endpoint - use localStorage instead
  if (proxyUrl && proxyUrl.includes('ai-proxy-cloudflare-worker')) {
    return null; // Will use localStorage fallback
  }
  
  if (proxyUrl && proxyUrl.includes('workers.dev')) {
    const baseUrl = proxyUrl.split('/v1/')[0];
    return `${baseUrl}/state`;
  }
  return '/api/state';
};

const API_BASE = getStateEndpoint();
if (API_BASE) {
  console.log('📍 State endpoint:', API_BASE);
} else {
  console.log('📍 Using localStorage for state persistence');
}

export async function saveSimulationState(state: SimulationState): Promise<void> {
  try {
    // Use localStorage if no API endpoint available
    if (!API_BASE) {
      logger.debug('Memory', '💾 Saving state to localStorage');
      localStorage.setItem('world26_simulation_state', JSON.stringify(state));
      return;
    }
    
    logger.debug('Memory', '💾 Saving state to API', { endpoint: API_BASE });
    
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    });
    if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
    }
  } catch (err) {
    console.error("Failed to persist memory:", err);
  }
}

export async function loadSimulationState(): Promise<SimulationState | null> {
  try {
    // Use localStorage if no API endpoint available
    if (!API_BASE) {
      logger.debug('Memory', '📂 Loading state from localStorage');
      const stored = localStorage.getItem('world26_simulation_state');
      const result = stored ? JSON.parse(stored) : null;
      logger.info('Memory', result ? '✅ State loaded' : '⚠️ No saved state found');
      return result;
    }
    
    logger.debug('Memory', '📂 Loading state from API', { endpoint: API_BASE });
    
    const resp = await fetch(API_BASE);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.state;
  } catch (err) {
    console.error("Failed to recall memory:", err);
    return null;
  }
}

