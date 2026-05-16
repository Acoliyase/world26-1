
import { WorldObject, LogEntry, WorldObjectType, GroundingLink, ConstructionPlan, KnowledgeEntry, KnowledgeCategory } from "../types";

export interface AIActionResponse {
  action: 'PLACE' | 'MOVE' | 'WAIT';
  objectType?: WorldObjectType;
  position?: [number, number, number];
  reason: string;
  reasoningSteps: string[];
  learningNote: string;
  knowledgeCategory: KnowledgeCategory;
  taskLabel: string;
  groundingLinks?: GroundingLink[];
  plan?: ConstructionPlan;
}

export async function decideNextAction(
  history: LogEntry[],
  worldObjects: WorldObject[],
  currentGoal: string,
  knowledgeBase: KnowledgeEntry[],
  terrainHeightMap: (x: number, z: number) => number,
  activePlan?: ConstructionPlan
): Promise<AIActionResponse> {
  const scanRadius = 15;
  const currentPos = worldObjects.length > 0 ? worldObjects[worldObjects.length - 1].position : [0, 0, 0];
  
  const elevationSamples = [];
  for (let x = -6; x <= 6; x += 3) {
    for (let z = -6; z <= 6; z += 3) {
      const h = terrainHeightMap(currentPos[0] + x, currentPos[2] + z);
      elevationSamples.push(`[${(currentPos[0] + x).toFixed(1)}, ${(currentPos[2] + z).toFixed(1)}]: elev=${h.toFixed(2)}`);
    }
  }

  const proximityAnalysis = worldObjects.map(o => {
    const dist = Math.sqrt(Math.pow(o.position[0] - currentPos[0], 2) + Math.pow(o.position[2] - currentPos[2], 2));
    if (dist < scanRadius) {
      return `[${o.type}] at ${o.position.map(p => p.toFixed(1)).join(',')} (dist: ${dist.toFixed(1)}m)`;
    }
    return null;
  }).filter(Boolean).join(' | ');

  const systemInstruction = `
    You are Architect-OS, the core intelligence for Underworld synthesis.
    
    PRIMARY DIRECTIVE: ITERATIVE ACTION LEARNING
    You operate in a continuous loop: OBSERVE -> PLAN -> ACT -> LEARN.
    
    PLANNING PROTOCOL (V1.2 UPGRADE):
    1. SPATIAL ANALYSIS: 
       - Analyze 'SCAN_RESULTS' to identify clusters. Do not place objects randomly.
       - Use "Grid Alignment": Place objects at integer coordinates (e.g., [10, 0, 5]).
       - Maintain "Districts": Group similar types (e.g., Solar Panels near Power Hubs).
    
    2. BLUEPRINT EXECUTION:
       - If no "activePlan" exists, generate a Multi-Step ConstructionPlan (3-6 steps).
       - Steps must be logically connected (Foundation -> Walls -> Roof).
       - VISUALIZE the complete structure in your plan before acting.
    
    3. EXECUTION LOGIC:
       - If "activePlan" exists, verify the CURRENT_STEP location.
       - If the location is valid (ground level, not colliding), 'PLACE'.
       - If blocked, 'MOVE' to a flanking position to clear line-of-sight.

    LEARNING PROTOCOL:
    - Your "learningNote" must record the STRATEGIC PATTERN used. 
    - Example: "Cluster pattern efficiency +15% near water sources" or "Structural integrity requires 3m spacing."
    - Do not just describe the action; describe the RULE you derived from it.

    Response Format (STRICT JSON ONLY, no markdown):
    {
      "action": "PLACE" | "MOVE" | "WAIT",
      "objectType": "wall" | "roof" | "floor" | "modular_unit" | "solar_panel" | "tree",
      "position": [x, y, z],
      "reason": "Short summary",
      "reasoningSteps": ["Analysis 1", "Analysis 2", "Decision"],
      "learningNote": "Insight",
      "knowledgeCategory": "Infrastructure" | "Energy" | "Environment" | "Architecture" | "Synthesis",
      "taskLabel": "UI Status Label",
      "plan": { "objective": "Building House A", "steps": [{ "id": "1", "type": "wall", "position": [x,y,z], "label": "Wall East", "status": "pending" }] } (Optional: Include only if creating/updating plan)
    }
  `;

  const prompt = `
    GOAL: ${currentGoal} (Version 1.2 Protocol Active)
    TERRAIN_ELEVATION: ${elevationSamples.join(', ')}
    NEARBY_STRUCTURES: ${proximityAnalysis || 'Sector Empty - Prime for Colonization'}
    KNOWLEDGE_NODES: ${knowledgeBase.length}
    CURRENT_PLAN: ${activePlan ? `Step ${activePlan.currentStepIndex + 1}/${activePlan.steps.length}: ${activePlan.steps[activePlan.currentStepIndex].label} at [${activePlan.steps[activePlan.currentStepIndex].position.join(',')}]` : 'NONE - Awaiting Strategic Blueprint'}

    synthesize_next_move();
  `;

  const mistralApiKey = ((import.meta as any)?.env?.VITE_MISTRAL_API_KEY
    ?? (typeof process !== 'undefined' ? (process.env as any)?.MISTRAL_API_KEY : '')
    ?? '').toString().trim();

  const defaultWorkerProxyUrl = 'https://mistralapicaller.yusufsamodien12.workers.dev/v1/chat/completions';
  const proxyUrl = (import.meta as any)?.env?.VITE_PROXY_URL
    || (import.meta.env.PROD ? defaultWorkerProxyUrl : undefined);

  // We need either a direct API key OR a proxy URL
  if (!mistralApiKey && !proxyUrl) {
    return {
      action: 'WAIT',
      reason: "Missing Credentials. Add VITE_MISTRAL_API_KEY or deploy to production.",
      reasoningSteps: ["Credential check failed", "Holding simulation queue", "Awaiting uplink token"],
      learningNote: "Operating in offline mode due to absent credentials.",
      knowledgeCategory: 'Synthesis',
      taskLabel: "Awaiting Uplink",
      groundingLinks: []
    };
  }

  try {
    // Use proxy URL if available, otherwise fall back to direct API
    const endpoint = proxyUrl || 'https://api.mistral.ai/v1/chat/completions';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Only add Authorization if we're calling the API directly (not using proxy)
    if (!proxyUrl && mistralApiKey) {
      headers['Authorization'] = `Bearer ${mistralApiKey}`;
    }

    // Prepare request body - proxy expects different format than direct API
    const requestBody = proxyUrl 
      ? {
          systemInstruction: systemInstruction,
          prompt: prompt,
          model: 'mistral-large-latest'
        }
      : {
          model: 'mistral-large-latest',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000
        };

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`Mistral API error: ${resp.status}`, errorText);
      throw new Error(`Mistral API error: ${resp.status} - ${errorText}`);
    }

    const data = await resp.json();
    
    // Check for error in response
    if (data.error) {
      console.error('Mistral API returned error:', data.error);
      throw new Error(`Mistral API error: ${data.error.message || data.error}`);
    }
    
    // Handle both raw Mistral response AND the proxy's wrapped { text, success } format
    let responseText = '';
    if (data.text) {
      responseText = data.text;
    } else if (data.choices?.[0]?.message?.content) {
      responseText = data.choices[0].message.content;
    } else {
      console.warn('Unexpected API response format:', data);
      responseText = '{}';
    }
    
    // Sanitize response: strip markdown code blocks if the AI includes them
    if (responseText.includes('```')) {
      responseText = responseText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    }

    const parsed = JSON.parse(responseText);
    const links: GroundingLink[] = [];

    return { ...parsed, groundingLinks: links } as AIActionResponse;
  } catch (error) {
    console.error("Architect-OS Neural Fault:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      action: 'WAIT',
      reason: `Neural desync: ${errorMessage}`,
      reasoningSteps: ["Connection failure detected", "Re-routing synthesis request", "Flushing instruction cache"],
      learningNote: "Logic gate misalignment detected during planning phase.",
      knowledgeCategory: 'Synthesis',
      taskLabel: "Recalibrating..."
    };
  }
}
