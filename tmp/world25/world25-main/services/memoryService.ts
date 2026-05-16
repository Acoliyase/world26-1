/// <reference types="vite/client" />
import { SimulationState } from "../src/types";
import { logger } from './logger';

// Use worker's state endpoint in production, local API in development
const getStateEndpoint = () => {
  // Prefer local API endpoint if running on our platform
  if (window.location.hostname.includes('europe-west2.run.app') || window.location.hostname === 'localhost') {
    return '/api/state';
  }
  
  // Use the defined environment variable directly for Vite compatibility
  const proxyUrl = (import.meta as any).env?.VITE_PROXY_URL;
  
  if (proxyUrl && proxyUrl.includes('workers.dev')) {
    // Old proxy with state support
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
    const data = await resp.json() as any;
    return data.state;
  } catch (err) {
    console.error("Failed to recall memory:", err);
    return null;
  }
}

