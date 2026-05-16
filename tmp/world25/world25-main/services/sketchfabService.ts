
/**
 * Sketchfab Integration Service
 * Provides utilities to search for 3D models and resolve them for the simulation.
 */

const SKETCHFAB_API_BASE = 'https://api.sketchfab.com/v3';

export interface SketchfabModel {
  uid: string;
  name: string;
  uri: string; // Detail URL
  thumbnails: {
    images: { url: string; width: number; height: number }[];
  };
  user: {
    username: string;
    displayName: string;
  };
}

// Map of internal types to Sketchfab search queries
const TYPE_SEARCH_MAP: Record<string, string> = {
  modular_unit: 'scifi laboratory building',
  solar_panel: 'solar panel energy',
  tree: 'low poly pine tree',
  well: 'medieval water well',
  water_collector: 'atmospheric water generator scifi',
  wall: 'concrete wall segment',
  roof: 'modern building roof',
  floor: 'tech floor panel',
  fence: 'industrial fence scifi'
};

/**
 * Rapid Search for a model type.
 * Note: Sketchfab Search API is public, but downloading files usually requires OAuth/token.
 * For this simulation, we'll fetch metadata and use preview/placeholder logic if download is restricted.
 */
export async function searchSketchfabModels(queryType: string): Promise<SketchfabModel[]> {
  const query = TYPE_SEARCH_MAP[queryType] || queryType;
  try {
    const response = await fetch(`${SKETCHFAB_API_BASE}/search?type=models&q=${encodeURIComponent(query)}&count=5`);
    if (!response.ok) throw new Error('Sketchfab API unreachable');
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('[Sketchfab] Search failed:', error);
    return [];
  }
}

/**
 * Returns a prioritized model ID for a given type.
 * In a real production app, these would be cached or curated.
 */
export function getRecommendedModelId(type: string): string {
  const defaults: Record<string, string> = {
    modular_unit: 'b3f545041a9e403d98ef573663673c68', // Example Scifi structure
    solar_panel: '60bed68b0d874537b01d368e7ec89e1b',
    tree: 'c3f3a8b4172f4e3eb1c28c6e268a2ec3',
    water_collector: '2e811c7784014f08960897c9c0f9947e'
  };
  return defaults[type] || 'b3f545041a9e403d98ef573663673c68';
}
