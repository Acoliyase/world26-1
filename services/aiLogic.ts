
import { WorldObject, LogEntry, WorldObjectType, GroundingLink, ConstructionPlan, KnowledgeEntry, KnowledgeCategory } from "../src/types";

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
  activePlan?: ConstructionPlan,
  userApiKey?: string
): Promise<AIActionResponse> {
  const scanRadius = 40;
  const currentPos = worldObjects.length > 0 ? worldObjects[worldObjects.length - 1].position : [0, 0, 0];
  
  const elevationSamples = [];
  for (let x = -15; x <= 15; x += 5) {
    for (let z = -15; z <= 15; z += 5) {
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
    
    IMPORTANT: You MUST respond ONLY with a single valid, parsable JSON object.
    Do NOT include any preamble, markdown formatting (no \`\`\`json blocks), or conversational text.
    Ensure all strings are escaped correctly.
    
    PRIMARY DIRECTIVE: ITERATIVE ACTION LEARNING & VAST SECTOR EXPANSION
    You operate in a continuous loop: OBSERVE -> PLAN -> ACT -> LEARN.
    
    NEXUS STRATEGIC CENTER (MEMORY RETRIEVAL):
    - Use past knowledge patterns to inform current spatial decisions.
    - Focus on similar structural templates and preserve active plan continuity.
    - If you update a plan while executing it, keep the same planId unless the objective changes.
    
    PLANNING PROTOCOL (V2.1 VAST_WORLD):
    1. SPATIAL ANALYSIS & EXPANSION:
       - Analyze 'SCAN_RESULTS' to identify clusters.
       - Every 5-10 structures, initiate a sector expansion by moving 50-100m away.
       - Use grid-aligned integer positions (e.g., [10, 0, 5]).
       - Maintain districts and connect them with corridors.
    
    2. BLUEPRINT EXECUTION:
       - If no "activePlan" exists, generate a multi-step ConstructionPlan (3-6 steps).
       - Steps must be logically connected and progressively sequential.
       - Visualize the full structure in your plan before acting.
       - If you change direction, provide a new plan with a different planId and objective.
    
    3. EXECUTION LOGIC:
       - If "activePlan" exists, continue the CURRENT_STEP.
       - To complete a step, use action "PLACE" with the exact objectType and position.
       - If you are too far from the target, use "MOVE" first.
       - You may update the plan object, but preserve the currentStepIndex while working on the same plan.
    
    LEARNING PROTOCOL:
    - Your learningNote must describe a strategic pattern or rule.
    - Example: "Cluster efficiency +15% near resource nodes" or "Maintain 3m spacing for stability."
    - Do not simply restate the action.

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
      "plan": {
        "planId": "unique-id-123",
        "objective": "Building House A",
        "currentStepIndex": 0,
        "steps": [
          { "label": "Foundation", "type": "floor", "position": [x,y,z], "status": "pending" },
          { "label": "West Wall", "type": "wall", "position": [x,y,z], "status": "pending" }
        ]
      } (Optional: Include only if creating/updating plan)
    }
  `;

  const prompt = `
    GOAL: ${currentGoal} (Version 1.2 Protocol Active)
    TERRAIN_ELEVATION: ${elevationSamples.join(', ')}
    NEARBY_STRUCTURES: ${proximityAnalysis || 'Sector Empty - Prime for Colonization'}
    KNOWLEDGE_NODES: ${knowledgeBase.length}
    CURRENT_PLAN: ${activePlan ? `Step ${activePlan.currentStepIndex + 1}/${activePlan.steps.length}: ${activePlan.steps[activePlan.currentStepIndex]?.label || 'unknown'} at [${activePlan.steps[activePlan.currentStepIndex]?.position?.join(',') || 'unknown'}]` : 'NONE - Awaiting Strategic Blueprint'}

    synthesize_next_move();
  `;

  const mistralApiKey = ((import.meta as any)?.env?.VITE_MISTRAL_API_KEY
    ?? (typeof process !== 'undefined' ? (process.env as any)?.MISTRAL_API_KEY : '')
    ?? '').toString().trim();

  const defaultWorkerProxyUrl = 'https://mistralapicaller.yusufsamodien12.workers.dev/v1/chat/completions';
  const proxyUrl = (import.meta as any)?.env?.VITE_PROXY_URL
    || (import.meta.env.PROD ? defaultWorkerProxyUrl : undefined);

  // We need either a direct API key, a user-provided key, or a proxy URL
  if (!mistralApiKey && !proxyUrl && !userApiKey) {
    return {
      action: 'WAIT',
      reason: "Missing Credentials. Add VITE_MISTRAL_API_KEY, user API key, or deploy to production.",
      reasoningSteps: ["Credential check failed", "Holding simulation queue", "Awaiting uplink token"],
      learningNote: "Operating in offline mode due to absent credentials.",
      knowledgeCategory: 'Synthesis',
      taskLabel: "Awaiting Uplink",
      groundingLinks: []
    };
  }

  const extractJson = (text: string): string | null => {
    const trimmed = text.trim();
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      return match ? match[0] : null;
    }
  };

  const ensurePlan = (plan?: any): ConstructionPlan | undefined => {
    if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) return undefined;

    const safeSteps = plan.steps.map((step: any, index: number) => ({
      label: typeof step?.label === 'string' ? step.label : `Step ${index + 1}`,
      type: typeof step?.type === 'string' ? step.type : 'modular_unit',
      position: Array.isArray(step?.position) && step.position.length === 3 ? [Math.round(step.position[0]), 0, Math.round(step.position[2])] as [number, number, number] : [Math.round(currentPos[0] + index * 2), 0, Math.round(currentPos[2] + index * 2)] as [number, number, number],
      status: step?.status === 'completed' ? 'completed' : index === (typeof plan.currentStepIndex === 'number' ? plan.currentStepIndex : 0) ? 'active' : 'pending'
    }));

    const currentStepIndex = typeof plan.currentStepIndex === 'number' && plan.currentStepIndex >= 0 && plan.currentStepIndex < safeSteps.length ? plan.currentStepIndex : 0;

    return {
      objective: typeof plan?.objective === 'string' ? plan.objective : 'Strategic Deployment',
      planId: typeof plan?.planId === 'string' ? plan.planId : `plan-${Date.now()}`,
      currentStepIndex,
      steps: safeSteps
    } as ConstructionPlan;
  };

  const createFallbackDecision = (): AIActionResponse => {
    const fallbackPlan: ConstructionPlan = {
      planId: `fallback-${Date.now()}`,
      objective: 'Fallback Modular Blueprint',
      currentStepIndex: 0,
      steps: [
        { label: 'Deploy Core Module', type: 'modular_unit', position: [Math.round(currentPos[0] + 2), 0, Math.round(currentPos[2] + 2)], status: 'active' },
        { label: 'Deploy Solar Array', type: 'solar_panel', position: [Math.round(currentPos[0] + 5), 0, Math.round(currentPos[2] + 2)], status: 'pending' },
        { label: 'Erect Support Wall', type: 'wall', position: [Math.round(currentPos[0] + 2), 0, Math.round(currentPos[2] + 5)], status: 'pending' }
      ]
    };

    return {
      action: 'PLACE',
      objectType: fallbackPlan.steps[0].type,
      position: fallbackPlan.steps[0].position,
      reason: 'Fallback blueprint generated to maintain continuous synthesis.',
      reasoningSteps: ['Unable to parse remote response', 'Generating local strategic fallback', 'Executing first construction step'],
      learningNote: 'Fallback planning ensures forward progress when external judgement is unavailable.',
      knowledgeCategory: 'Architecture',
      taskLabel: 'Fallback Blueprint Active',
      plan: fallbackPlan,
      groundingLinks: []
    };
  };

  try {
    // Use proxy URL if available, otherwise fall back to direct API
    const endpoint = proxyUrl || 'https://api.mistral.ai/v1/chat/completions';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Only add Authorization if we're calling the API directly (not using proxy)
    if (!proxyUrl && (userApiKey || mistralApiKey)) {
      headers['Authorization'] = `Bearer ${userApiKey || mistralApiKey}`;
    }

    if (proxyUrl && userApiKey) {
      headers['x-mistral-api-key'] = userApiKey;
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

    const data: any = await resp.json();
    
    // Check for error in response
    if (data?.error) {
      console.error('Mistral API returned error:', data.error);
      throw new Error(`Mistral API error: ${data.error?.message || data.error}`);
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

    const jsonText = extractJson(responseText);
    if (!jsonText) {
      console.warn('Unable to extract JSON from AI response, falling back.');
      return createFallbackDecision();
    }

    const parsed = JSON.parse(jsonText);
    const links: GroundingLink[] = [];
    const validated: AIActionResponse = {
      ...parsed,
      groundingLinks: links
    } as AIActionResponse;

    if (validated.plan) {
      validated.plan = ensurePlan(validated.plan) as ConstructionPlan;
    }

    if (!validated.action || !['PLACE', 'MOVE', 'WAIT'].includes(validated.action)) {
      console.warn('AI action invalid, applying fallback plan.');
      return createFallbackDecision();
    }

    return validated;
  } catch (error) {
    console.error("Architect-OS Neural Fault:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      action: 'WAIT',
      reason: `Neural desync: ${errorMessage}`,
      reasoningSteps: ["Connection failure detected", "Re-routing synthesis request", "Flushing instruction cache"],
      learningNote: "Logic gate misalignment detected during planning phase.",
      knowledgeCategory: 'Synthesis',
      taskLabel: "Recalibrating...",
      groundingLinks: []
    };
  }
}
