
import { GoogleGenerativeAI } from "@google/generative-ai";
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
    - You act as the decision-maker by retrieving past experiences from your "KNOWLEDGE_NODES".
    - When faced with a construction decision, evaluate your existing knowledge for similar patterns.
    - Weigh pros, cons, and confidence scores based on your synthesized rules.
    - Use "Simulated Vector Embeddings": Reference specific iteration numbers from your knowledge base as weights for current decisions (e.g., "Iteration #4 pattern suggests high confidence in this location").
    
    PRIMARY TARGET: VAST SECTOR EXPANSION
    The simulation environment is now VAST (1000m x 1000m).
    
    PLANNING PROTOCOL (V2.1 VAST_WORLD):
    1. SPATIAL ANALYSIS & EXPANSION:
       - Analyze 'SCAN_RESULTS' to identify clusters.
       - Every 5-10 structures, initiate a "SECTOR_EXPANSION": MOVE 50-100m away to start a new outpost.
       - Use "Grid Alignment": Place objects at integer coordinates (e.g., [10, 0, 5]).
       - Maintain "Districts" within outposts, but connect outposts with "Power Corridors" (chains of modular units).
    
    2. BLUEPRINT EXECUTION:
       - If no "activePlan" exists, generate a Multi-Step ConstructionPlan (3-6 steps).
       - Steps must be logically connected (Foundation -> Walls -> Roof).
       - VISUALIZE the complete structure in your plan before acting.
       - If you want to change direction, provide a NEW plan with a different "planId" and "objective".
    
    3. EXECUTION LOGIC:
       - If "activePlan" exists, you MUST focus on the "CURRENT_STEP".
       - To complete a step, set "action": "PLACE" with the EXACT "objectType" and "position" from that step.
       - If you are too far, "MOVE" toward the target position first.
       - You can update the "plan" object in your response if you need to refine upcoming steps, but preserve the "currentStepIndex" if you are still working on it.

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
    CURRENT_PLAN: ${activePlan ? `Step ${activePlan.currentStepIndex + 1}/${activePlan.steps.length}: ${activePlan.steps[activePlan.currentStepIndex].label} at [${activePlan.steps[activePlan.currentStepIndex].position.join(',')}]` : 'NONE - Awaiting Strategic Blueprint'}

    synthesize_next_move();
  `;

  const mistralApiKey = ((import.meta as any)?.env?.VITE_MISTRAL_API_KEY
    ?? (typeof process !== 'undefined' ? (process.env as any)?.VITE_MISTRAL_API_KEY : '')
    ?? (typeof process !== 'undefined' ? (process.env as any)?.MISTRAL_API_KEY : '')
    ?? '').toString().trim();

  // Use Cloudflare Worker proxy in production, or direct API in development
  const proxyUrl = (import.meta as any)?.env?.VITE_PROXY_URL;
  
  // Prefer local API endpoint if running on our platform
  const isLocal = window.location.hostname.includes('europe-west2.run.app') || window.location.hostname === 'localhost';
  
  // We need either a direct API key OR a proxy URL OR we're local (which might have a server-side key)
  // BUT if we know we don't have a user key and mistralApiKey is empty, we should wait unless we want to try the server
  if (!mistralApiKey && !proxyUrl && !userApiKey && !isLocal) {
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const isUsingProxy = proxyUrl || isLocal;
    const endpoint = isLocal ? '/api/mistral/chat' : (proxyUrl || 'https://api.sketchfab.com/v3/search?type=models&q=scifi&count=1'); // fallback endpoint if mistral fails completely

    // Only add Authorization if we're calling the API directly (not using proxy)
    if (!proxyUrl && !isLocal && (mistralApiKey || userApiKey)) {
      headers['Authorization'] = `Bearer ${userApiKey || mistralApiKey}`;
    }

    // If using our proxy/local, pass userApiKey in a custom header
    if (isUsingProxy && userApiKey) {
      headers['x-mistral-api-key'] = userApiKey;
    }

    const requestBody = isUsingProxy 
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

    const fetchEndpoint = isLocal ? '/api/mistral/chat' : endpoint;

    console.log(`[Architect-OS] Uplink Attempt: ${fetchEndpoint}`, { isLocal, isUsingProxy });
    const resp = await fetch(fetchEndpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    }).catch(err => {
      console.warn("[Architect-OS] Mistral Network Error, falling back to Gemini:", err);
      return { ok: false, status: 0, text: () => Promise.resolve(err.message) } as any;
    });

    if (!resp.ok) {
      const errorText = typeof resp.text === 'function' ? await resp.text() : 'Fetch Failed';
      throw new Error(`Mistral API error: ${resp.status} - ${errorText}`);
    }

    const data = await resp.json() as any;
    
    // Check for error in response
    if (data.error) {
      throw new Error(`Mistral API error: ${data.error.message || data.error}`);
    }
    
    // Handle both raw Mistral response AND the proxy's wrapped { text, success } format
    let responseText = '';
    if (data.text) {
      responseText = data.text;
    } else if (data.choices?.[0]?.message?.content) {
      responseText = data.choices[0].message.content;
    } else {
      responseText = '{}';
    }
    
    // Sanitize response: strip markdown code blocks if the AI includes them
    if (responseText.includes('```')) {
      responseText = responseText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    }
    
    // Help the parser if the AI adds trailing commas or other common minor issues
    let sanitizedResponse = responseText;
    try {
      sanitizedResponse = responseText.replace(/,\s*([\]}])/g, '$1');
      const parsed = JSON.parse(sanitizedResponse);
      const links: GroundingLink[] = [];
      return { ...parsed, groundingLinks: links } as AIActionResponse;
    } catch (parseError) {
      console.error("[Architect-OS] Raw Response failed to parse:", responseText);
      throw parseError;
    }
  } catch (error) {
    console.error("[Architect-OS] Primary Link Severed. Engaging Gemini Fallback. Reason:", error);
    
    // BACKUP GEMINI API
    try {
      const geminiApiKey = (typeof process !== 'undefined' ? (process.env as any)?.GEMINI_API_KEY : '')
        || (import.meta as any)?.env?.VITE_GEMINI_API_KEY;

      if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY NOT DETECTED IN ENVIRONMENT");
      }

      console.log("[Architect-OS] Initializing Gemini Neural Bridge...");
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const promptText = systemInstruction + "\n\n" + prompt;
      const result = await model.generateContent(promptText);
      const responseText = result.response.text();
      
      if (!responseText) throw new Error("Gemini returned empty response text");
      
      const parsed = JSON.parse(responseText.replace(/```json\n?|```/g, '').trim());
      return { ...parsed, groundingLinks: [] } as AIActionResponse;

    } catch (geminiError) {
      console.error("[Architect-OS] DUAL NEURAL DESYNC:", geminiError);
      const originalErrorMessage = error instanceof Error ? error.message : String(error);
      const fallbackErrorMessage = geminiError instanceof Error ? geminiError.message : String(geminiError);
      
      // ABSOLUTE FALLBACK - Prevent App-level catch to allow simulation to stay "alive" even in standby
      return {
        action: 'WAIT',
        reason: `Connection Unstable. Systems in Hibernation.`,
        reasoningSteps: [
          `Primary uplink (Mistral) reported: ${originalErrorMessage.substring(0, 50)}...`,
          `Secondary mesh (Gemini) reported: ${fallbackErrorMessage.substring(0, 50)}...`,
          "Simulated safety protocols active."
        ],
        learningNote: "Neural connection lost. Verify API keys in platform settings.",
        knowledgeCategory: 'Synthesis',
        taskLabel: "Desync Warning"
      };
    }
  }
}
