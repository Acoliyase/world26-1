
/**
 * 3DAI Studio Service
 * Fetches user wallet/account data to display API credits or status.
 */

export interface WalletData {
  credits?: number;
  tokens?: number;
  balance?: string;
  [key: string]: any;
}

/**
 * Fetches the wallet data via the local server proxy.
 */
export async function fetchWalletData(): Promise<WalletData | null> {
  try {
    const response = await fetch('/api/3daistudio/wallet');
    if (!response.ok) {
      throw new Error('Failed to fetch wallet data from proxy');
    }
    return await response.json();
  } catch (error) {
    console.error('[3DAI Studio Service] Error:', error);
    return null;
  }
}
