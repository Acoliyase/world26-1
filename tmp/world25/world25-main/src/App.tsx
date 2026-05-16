
/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback, useRef, Suspense, lazy, useMemo } from 'react';
import * as d3 from 'd3-force';
import { fetchWalletData, WalletData } from '../services/threeDAIStudioService';
import { KnowledgeGraph } from '../components/KnowledgeGraph';
import { WorldObject, LogEntry, SimulationState, KnowledgeEntry, GroundingLink, ConstructionPlan, KnowledgeCategory } from './types';
import { decideNextAction, AIActionResponse } from '../services/aiLogic';
import { loadSimulationState, saveSimulationState } from '../services/memoryService';
import { logger } from '../services/logger';

const SimulationCanvas = lazy(() => import('../components/SimulationCanvas'));

const INITIAL_GOAL = "Synthesize Sustainable Modular Settlement";

const getTerrainHeight = (x: number, z: number) => {
  return (Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2.0) +
         (Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5.0);
};

function App() {
  logger.info('App', '🚀 App component initializing');
  logger.info('App', 'Environment', { 
    isDev: import.meta.env.DEV, 
    mode: import.meta.env.MODE,
    proxyUrl: import.meta.env.VITE_PROXY_URL,
    hasApiKey: !!import.meta.env.VITE_MISTRAL_API_KEY
  });
  
  const [state, setState] = useState<SimulationState>({
    objects: [],
    logs: [{ id: '1', type: 'success', message: 'Architect-OS Online. Neural pathways clear.', timestamp: Date.now() }],
    knowledgeBase: [],
    currentGoal: INITIAL_GOAL,
    learningIteration: 0,
    networkStatus: 'uplink_active',
    activePlan: undefined,
    progression: {
      complexityLevel: 1,
      structuresCompleted: 0,
      totalBlocks: 0,
      unlockedBlueprints: ['Core Protocol', 'Adaptive Clustering']
    },
    apiMetrics: [],
    neuralMetrics: {
      synapticDensity: 0,
      cognitiveLoad: 0,
      retentionIndex: 100
    },
    ui: { showStats: true, showKnowledge: true, showLogs: true, showPlanning: true, showNetwork: true }
  });

  const [userApiKey, setUserApiKey] = useState<string>(() => localStorage.getItem('mistral_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);

  const [avatarPos, setAvatarPos] = useState<[number, number, number]>([0, 0, 0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuto, setIsAuto] = useState(true);
  const [currentTask, setCurrentTask] = useState<string>("Analyzing Local Sector...");
  const [taskProgress, setTaskProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const knowledgeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'action') => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, { id: Math.random().toString(), type, message, timestamp: Date.now() }]
    }));
  }, []);

  // Load state on mount
  const isMemInitialized = useRef(false);
  useEffect(() => {
    if (isMemInitialized.current) return;
    
    logger.info('App', '🔄 Initializing memory system');
    async function initMemory() {
      try {
        const savedState = await loadSimulationState();
        if (savedState) {
          logger.info('App', '✅ Loaded saved state', { 
            objects: savedState.objects?.length,
            logs: savedState.logs?.length,
            knowledge: savedState.knowledgeBase?.length
          });
          
          isMemInitialized.current = true;
          
          setState(prev => ({
            ...prev,
            ...savedState,
            // Ensure UI settings and metrics aren't wiped if missing in save
            ui: savedState.ui || prev.ui,
            apiMetrics: savedState.apiMetrics || prev.apiMetrics,
            // Prefix logs with a restoration marker rather than adding a separate log to avoid duplicates if re-mounting
            logs: [
              ...savedState.logs,
              { id: 'restore-' + Date.now(), type: 'success' as const, message: "Neural Memory Restored: Simulation Link Stable.", timestamp: Date.now() }
            ].slice(-100) // Keep logs manageable
          }));
          
          if (savedState.objects && savedState.objects.length > 0) {
            setAvatarPos(savedState.objects[savedState.objects.length - 1].position);
          }
        }
      } catch (err) {
        console.error("Memory initialization failed:", err);
      }
    }
    initMemory().catch(err => logger.error('App', 'Memory initialization failed', err));
  }, []);

  useEffect(() => {
    const fetchWallet = async () => {
      const data = await fetchWalletData();
      if (data) {
        setWallet(data);
        logger.info('App', '3DAI Studio Wallet Synchronized', data);
      }
    };
    fetchWallet();
    const interval = setInterval(fetchWallet, 30000);
    return () => clearInterval(interval);
  }, []);

  // Neural Metric Calculation
  useEffect(() => {
    const timer = setInterval(() => {
      setState(prev => {
        const connections = prev.knowledgeBase.reduce((acc, k) => acc + (k.links?.length || 0), 0);
        const concepts = Math.max(1, prev.knowledgeBase.length);
        
        const synapticDensity = parseFloat((connections / concepts).toFixed(2));
        const cognitiveLoad = Math.min(100, Math.floor((prev.objects.length * 1.5 + prev.knowledgeBase.length * 4) / 4));
        const baseRetention = synapticDensity > 0 ? 80 + (synapticDensity * 5) : 75;
        const retentionIndex = Math.min(100, Math.floor(baseRetention - (prev.learningIteration / 50)));

        return {
          ...prev,
          neuralMetrics: { synapticDensity, cognitiveLoad, retentionIndex }
        };
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Auto-save state whenever significant changes occur
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.objects.length > 0 || state.knowledgeBase.length > 0) {
        saveSimulationState(state).catch(err => logger.error('App', 'Periodic save failed', err));
      }
    }, 5000); 
    return () => clearTimeout(timer);
  }, [state.objects, state.knowledgeBase, state.progression, state.activePlan]);


  const runSimulationStep = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setState(prev => ({ ...prev, networkStatus: 'syncing' }));
    setTaskProgress(5);

    // Initial deterministic logs to show "immediate" feedback
    addLog("Initiating Neural Uplink...", "thinking");
    await new Promise(r => setTimeout(r, 400));
    addLog("Analyzing local sector topology map...", "thinking");
    await new Promise(r => setTimeout(r, 600));
    addLog("Querying Sketchfab API for structural blueprints...", "thinking");
    await new Promise(r => setTimeout(r, 800));
    setTaskProgress(20);
    const apiStartTime = Date.now();

    try {
      const decision: AIActionResponse = await decideNextAction(
        state.logs, 
        state.objects, 
        state.currentGoal, 
        state.knowledgeBase,
        getTerrainHeight,
        state.activePlan,
        userApiKey
      );
      
      const apiLatency = Date.now() - apiStartTime;
      setState(prev => ({
        ...prev,
        apiMetrics: [...prev.apiMetrics, { id: Math.random().toString(), timestamp: Date.now(), latency: apiLatency, status: 'success' as const }].slice(-20)
      }));

      setTaskProgress(40);
      addLog("Neural Uplink Successful. Processing synthesis packets...", "success");
      
      // Stream AI reasoning steps line by line
      if (decision.reasoningSteps && decision.reasoningSteps.length > 0) {
        for (const step of decision.reasoningSteps) {
          addLog(`[REASONING]: ${step}`, 'thinking');
          await new Promise(r => setTimeout(r, 600)); // Simulate thinking per line
        }
      }

      setCurrentTask(decision.taskLabel);
      setTaskProgress(70);

      // --- ACTION EXECUTION LOGS ---
      if (decision.action === 'PLACE') {
        const targetType = decision.objectType || (state.activePlan ? state.activePlan.steps[state.activePlan.currentStepIndex].type : 'modular_unit');
        addLog(`Synthesis Confirmed: Deploying ${targetType} unit.`, 'success');
      } else if (decision.action === 'MOVE' && decision.position) {
        addLog(`Relocating: Optimizing sector positioning.`, 'action');
      } else {
        addLog(`Simulation standby: ${decision.reason}`, 'action');
      }

      // --- STATE SYNC BLOCK (Pure updates) ---
      setState(prev => {
        let updatedPlan: ConstructionPlan | undefined;
        
        // 1. Plan Management
        if (decision.plan) {
          const isNewPlan = !prev.activePlan || 
                           (decision.plan.planId !== prev.activePlan.planId) ||
                           (decision.plan.objective !== prev.activePlan.objective);
          
          updatedPlan = {
            ...decision.plan,
            planId: decision.plan.planId || (isNewPlan ? `plan-${Date.now()}` : prev.activePlan!.planId),
            currentStepIndex: isNewPlan 
              ? (decision.plan.currentStepIndex ?? 0)
              : (decision.plan.currentStepIndex ?? prev.activePlan!.currentStepIndex)
          };
        } else {
          updatedPlan = prev.activePlan ? { ...prev.activePlan } : undefined;
        }

        // 2. Action Execution & Plan Advancement
        let newObjects = [...prev.objects];
        let newProgression = { ...prev.progression };
        const newKnowledge = [...prev.knowledgeBase];

        if (decision.action === 'PLACE') {
          const activeIndex = updatedPlan?.currentStepIndex ?? 0;
          const targetType = decision.objectType || (updatedPlan ? updatedPlan.steps[activeIndex].type : 'modular_unit');
          let targetPos = decision.position || (updatedPlan ? updatedPlan.steps[activeIndex].position : [0,0,0]);
          targetPos = [targetPos[0], getTerrainHeight(targetPos[0], targetPos[2]), targetPos[2]];

          setAvatarPos(targetPos as [number, number, number]);

          const newObj: WorldObject = {
            id: Math.random().toString(),
            type: targetType as any,
            position: targetPos as [number, number, number],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            timestamp: Date.now()
          };
          newObjects.push(newObj);
          
          newProgression = {
            ...newProgression,
            totalBlocks: newProgression.totalBlocks + 1,
            complexityLevel: Math.floor((newProgression.totalBlocks + 1) / 5) + 1,
            structuresCompleted: newProgression.structuresCompleted + (targetType === 'modular_unit' ? 1 : 0)
          };

          // Advance plan if applicable
          if (updatedPlan && updatedPlan.steps && updatedPlan.steps[updatedPlan.currentStepIndex]) {
            const steps = [...updatedPlan.steps];
            steps[updatedPlan.currentStepIndex].status = 'completed';
            const nextIdx = updatedPlan.currentStepIndex + 1;
            if (nextIdx < steps.length) {
              steps[nextIdx].status = 'active';
              updatedPlan = { ...updatedPlan, steps, currentStepIndex: nextIdx };
            } else {
              updatedPlan = undefined;
              // Note: We can't call addLog here anymore, we'll handle success log later if needed
            }
          }
        } else if (decision.action === 'MOVE' && decision.position) {
          setAvatarPos([decision.position[0], getTerrainHeight(decision.position[0], decision.position[2]), decision.position[2]]);
        }

        // 3. Knowledge Integration
        if (decision.learningNote) {
          const titleCandidate = decision.learningNote.split(':')[0]?.trim() || "Synthesis Logic";
          if (!newKnowledge.find(k => k.title === titleCandidate)) {
            newKnowledge.push({
              id: Math.random().toString(),
              title: titleCandidate,
              description: decision.learningNote,
              category: decision.knowledgeCategory,
              iteration: prev.learningIteration,
              timestamp: Date.now(),
              links: decision.groundingLinks
            });
          }
        }

        return {
          ...prev,
          objects: newObjects,
          learningIteration: prev.learningIteration + 1,
          activePlan: updatedPlan,
          knowledgeBase: newKnowledge,
          progression: newProgression
        };
      });

      // Report objective completion if it happened
      if (decision.action === 'PLACE' && state.activePlan && !decision.plan && (state.activePlan.currentStepIndex + 1 >= state.activePlan.steps.length)) {
         addLog("Strategic Objective Achieved.", "success");
      }

      setTaskProgress(100);
      await new Promise(r => setTimeout(r, 400));

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      addLog(`Neural sync fault: ${errorMsg}`, "error");
      
      // If error is persistent, back off auto system
      if (isAuto) {
        setIsAuto(false);
        addLog("System switching to MANUAL due to unstable uplink.", "action");
      }

      setState(prev => ({ 
        ...prev, 
        networkStatus: 'error',
        apiMetrics: [...prev.apiMetrics, { id: Math.random().toString(), timestamp: Date.now(), latency: Date.now() - apiStartTime, status: 'error' as const }].slice(-20) 
      }));
    } finally {
      setIsProcessing(false);
      setTaskProgress(0);
      setState(prev => ({ 
        ...prev, 
        networkStatus: prev.networkStatus === 'error' ? 'error' : 'uplink_active' 
      }));
      setCurrentTask(isAuto ? "Scanning Topology..." : "Standby");
    }
  }, [isProcessing, state, isAuto, addLog]);

  // --- PHYSICS ENGINE INTEGRATION ---
  const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);
  const physicsNodesRef = useRef<any[]>([]);

  useEffect(() => {
    if (state.objects.length === 0) return;

    const currentObjectIds = new Set(state.objects.map(o => o.id));
    const physicsNodeIds = new Set(physicsNodesRef.current.map(n => n.id));

    let needsReset = false;

    // Add missing objects to physics
    state.objects.forEach(obj => {
      if (!physicsNodeIds.has(obj.id)) {
        physicsNodesRef.current.push({
          id: obj.id,
          x: obj.position[0],
          y: obj.position[2],
          z: obj.position[1],
          vx: 0,
          vy: 0,
          vz: 0,
          type: obj.type
        });
        needsReset = true;
      }
    });

    // Remove extraneous objects
    if (physicsNodesRef.current.length !== state.objects.length) {
      physicsNodesRef.current = physicsNodesRef.current.filter(n => currentObjectIds.has(n.id));
      needsReset = true;
    }

    if (needsReset || !simulationRef.current) {
      if (simulationRef.current) simulationRef.current.stop();
      
      simulationRef.current = d3.forceSimulation(physicsNodesRef.current)
        .alphaDecay(0)
        .velocityDecay(0.3)
        .force('collide', d3.forceCollide().radius(2.5).iterations(2))
        .force('repulsion', d3.forceManyBody().strength(-5))
        .on('tick', () => {
          physicsNodesRef.current.forEach(n => {
            const ground = getTerrainHeight(n.x, n.y);
            
            // Gravity
            n.vz -= 0.015;
            n.z += n.vz;

            // Terrain Collision
            if (n.z < ground) {
              n.z = ground;
              n.vz = -n.vz * 0.2; // Dampened bounce
              // Ground friction
              n.vx *= 0.9;
              n.vy *= 0.9;
            }

            // Boundary constraints (don't wander off the vast world map too far)
            const bound = 500;
            if (Math.abs(n.x) > bound) n.x = Math.sign(n.x) * bound;
            if (Math.abs(n.y) > bound) n.y = Math.sign(n.y) * bound;
          });

          // Perform a batch update to React state
          setState(prev => {
            const updatedObjects = prev.objects.map(obj => {
              const node = physicsNodesRef.current.find(n => n.id === obj.id);
              if (!node) return obj;
              
              // Only update if moved significantly to reduce React bridge noise
              const dx = Math.abs(obj.position[0] - node.x);
              const dy = Math.abs(obj.position[1] - node.z);
              const dz = Math.abs(obj.position[2] - node.y);
              
              if (dx < 0.001 && dy < 0.001 && dz < 0.001) return obj;

              return {
                ...obj,
                position: [node.x, node.z, node.y] as [number, number, number]
              };
            });

            // Check if anything actually changed
            const anyChanges = updatedObjects.some((o, i) => o !== prev.objects[i]);
            if (!anyChanges) return prev;

            return { ...prev, objects: updatedObjects };
          });
        });
    }

    return () => {
      // Don't stop it on every small change, only on unmount or full refresh
    };
  }, [state.objects.length]);

  // Clean up simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, []);

  // Autonomous Expansion Loop (Every 45 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      logger.info('App', '🧠 Autonomic Nervous System: Triggering Expansion Loop');
      addLog("Autonomic Nervous System: Identifying Adjacent Possible concept...", "thinking");
      runSimulationStep().catch(err => {
        logger.error('App', 'Autonomic Expansion Loop Failed', err);
        addLog("Autonomic System Fault: Expansion cycle aborted.", "error");
      });
    }, 45000);
    return () => clearInterval(timer);
  }, [runSimulationStep, addLog]);

  useEffect(() => {
    if (isAuto && !isProcessing) {
      const t = setTimeout(() => {
        runSimulationStep().catch(err => {
          logger.error('App', 'Auto-step failed', err);
        });
      }, 4500);
      return () => clearTimeout(t);
    }
  }, [isAuto, isProcessing, runSimulationStep]);

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTo({ top: logContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.logs]);

  return (
    <div className="relative w-full h-screen overflow-hidden text-slate-200 bg-slate-950 font-sans">
      {/* SCANNING OVERLAY */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(56,189,248,0.05)_50%,transparent_100%)] animate-[scan_8s_linear_infinite]" style={{ backgroundSize: '100% 200%' }} />
      </div>

      {/* NEURAL DASHBOARD HEADER */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 flex gap-8 px-10 py-4 bg-slate-950/40 backdrop-blur-2xl border border-white/5 rounded-full shadow-2xl pointer-events-none">
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-black uppercase text-white/30 tracking-[0.3em] mb-1">Synaptic Density</span>
          <div className="text-sm font-black italic text-sky-400">{state.neuralMetrics.synapticDensity} <span className="text-[8px] opacity-40">con/cpt</span></div>
        </div>
        <div className="w-[1px] h-8 bg-white/10" />
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-black uppercase text-white/30 tracking-[0.3em] mb-1">Cognitive Load</span>
          <div className="text-sm font-black italic text-white">{state.neuralMetrics.cognitiveLoad}%</div>
          <div className="w-16 h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${state.neuralMetrics.cognitiveLoad > 80 ? 'bg-rose-500' : 'bg-sky-400'}`} style={{ width: `${state.neuralMetrics.cognitiveLoad}%` }} />
          </div>
        </div>
        <div className="w-[1px] h-8 bg-white/10" />
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-black uppercase text-white/30 tracking-[0.3em] mb-1">Retention Index</span>
          <div className="text-sm font-black italic text-emerald-400">{state.neuralMetrics.retentionIndex}<span className="text-[8px] opacity-40">%</span></div>
        </div>
      </div>

      {/* HUD CONTROLS */}
      <div className="absolute top-8 right-8 z-20 flex flex-col gap-3 items-end">
        <div className="flex bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/5 shadow-2xl">
          {['Stats', 'Knowledge', 'Planning', 'Logs', 'Network'].map((k) => (
            <button key={k} onClick={() => setState(p => ({ ...p, ui: { ...p.ui, [`show${k}`]: !p.ui[`show${k}` as keyof SimulationState['ui']] } }))}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${state.ui[`show${k}` as keyof SimulationState['ui']] ? 'bg-white text-slate-950 shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'text-white/40 hover:text-white'}`}>
              {k === 'Knowledge' ? 'Neural' : k === 'Network' ? 'API Graph' : k}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md transition-all duration-500">
          <div className={`w-2 h-2 rounded-full ${
            state.networkStatus === 'syncing' ? 'bg-sky-400 animate-ping' : 
            state.networkStatus === 'error' ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' :
            'bg-emerald-400 shadow-[0_0_15px_#10b981]'
          }`} />
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
            state.networkStatus === 'syncing' ? 'text-sky-400' : 
            state.networkStatus === 'error' ? 'text-red-500' :
            'text-emerald-400'
          }`}>
            Uplink: {
              state.networkStatus === 'syncing' ? 'SYNCING...' : 
              state.networkStatus === 'error' ? 'LINK ERROR' :
              'ACTIVE / SUCCESS'
            }
          </span>
        </div>
      </div>

      {/* LEFT SIDEBAR DASHBOARD */}
      <div className="absolute top-8 left-8 bottom-24 w-80 flex flex-col gap-4 z-20 pointer-events-none">
        
        {/* STATS PANEL */}
        {state.ui.showStats && (
          <div className="pointer-events-auto p-6 bg-slate-950/40 backdrop-blur-xl border border-white/10 rounded-[30px] shadow-2xl animate-in slide-in-from-left-8 duration-700 flex flex-col gap-6 shrink-0 panel-glow">
             {/* Header */}
             <div className="flex items-center gap-4">
              <div className="w-1.5 h-12 bg-sky-400 rounded-full shadow-[0_0_20px_#38bdf8]" />
              <div>
                <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">OS.ALPHA <span className="text-[10px] text-sky-400 align-top">v1.2</span></h1>
                <div className="text-[9px] font-mono text-white/40 tracking-[0.3em] mt-1 uppercase">Complexity: Tier {state.progression.complexityLevel}</div>
              </div>
            </div>
            
            {/* Task Bar */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <span className="text-[8px] font-black uppercase text-white/30 tracking-widest block mb-2">Architectural State</span>
              <p className="text-xs font-bold text-sky-100">{currentTask}</p>
              {isProcessing && <div className="mt-3 h-0.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-sky-400 transition-all duration-700" style={{ width: `${taskProgress}%` }} /></div>}
            </div>

            {/* Grid Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5"><div className="text-[7px] font-black text-white/20 uppercase mb-1">Structures</div><div className="text-xl font-mono font-bold text-white">{state.progression.structuresCompleted}</div></div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5"><div className="text-[7px] font-black text-white/20 uppercase mb-1">Knowledge</div><div className="text-xl font-mono font-bold text-white">{state.knowledgeBase.length}</div></div>
            </div>

             {/* Resources Breakdown */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="text-[8px] font-black text-white/20 uppercase mb-2">Modules Deployed</div>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-white/50">
                    <div className="flex justify-between"><span>INFRA</span> <span className="text-white">{state.objects.filter(o => ['wall', 'door', 'fence', 'roof'].includes(o.type)).length}</span></div>
                    <div className="flex justify-between"><span>ECO</span> <span className="text-white">{state.objects.filter(o => ['tree', 'crop', 'well'].includes(o.type)).length}</span></div>
                    <div className="flex justify-between"><span>NRG</span> <span className="text-white">{state.objects.filter(o => ['solar_panel', 'water_collector'].includes(o.type)).length}</span></div>
                    <div className="flex justify-between"><span>MOD</span> <span className="text-white">{state.objects.filter(o => o.type === 'modular_unit').length}</span></div>
                </div>
            </div>
          </div>
        )}

        {/* API GRAPH PANEL */}
        {state.ui.showNetwork && (
          <div className="pointer-events-auto h-32 bg-slate-950/40 backdrop-blur-xl border border-white/10 rounded-[30px] shadow-2xl animate-in slide-in-from-left-8 duration-500 overflow-hidden flex flex-col shrink-0 panel-glow">
             <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
              <span className="text-[9px] font-black uppercase text-emerald-400 tracking-[0.3em]">Neural Uplink</span>
              <div className="flex gap-1">
                 <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                 <div className="w-1 h-1 rounded-full bg-red-500"></div>
              </div>
            </div>
            <div className="flex-1 relative flex items-end justify-between px-5 pb-2 pt-4 gap-0.5">
               {/* Dynamic Bars */}
               {state.apiMetrics.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-widest text-white/20">No Data Stream</div>}
               {state.apiMetrics.map((m) => {
                 const heightPct = Math.min(100, (m.latency / 2000) * 100); 
                 return (
                   <div key={m.id} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                     <div 
                      style={{ height: `${Math.max(5, heightPct)}%` }} 
                      className={`w-full rounded-t-[1px] transition-all duration-500 ${m.status === 'success' ? 'bg-emerald-400/80 group-hover:bg-emerald-300' : 'bg-red-500/80 group-hover:bg-red-400'}`}
                     />
                   </div>
                 );
               })}
               <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5 border-t border-dashed border-white/10 pointer-events-none"></div>
            </div>
          </div>
        )}

        {/* LOGS PANEL */}
        {state.ui.showLogs && (
            <div className="pointer-events-auto flex-1 min-h-[150px] bg-slate-950/60 backdrop-blur-xl border border-white/10 rounded-[30px] overflow-hidden shadow-2xl animate-in slide-in-from-left-8 duration-700 flex flex-col panel-glow">
            <div className="px-6 py-4 border-b border-white/5 text-[9px] font-black uppercase text-white/30 tracking-[0.3em]">Direct Activity Link</div>
            <div ref={logContainerRef} className="flex-1 overflow-y-auto p-6 space-y-2 font-mono text-[9px]">
                {state.logs.map(log => (
                <div key={log.id} className={`flex gap-3 p-2 rounded-lg transition-all duration-300 ${log.type === 'success' ? 'bg-emerald-500/10 text-emerald-300' : log.type === 'error' ? 'bg-rose-500/10 text-rose-300' : log.type === 'thinking' ? 'bg-sky-500/5 text-sky-400/80 italic border-l block pl-2 border-sky-400/30' : 'bg-white/5 text-white/50'}`}>
                    <span className="opacity-30 shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                    <span className="font-bold">{log.message}</span>
                </div>
                ))}
            </div>
            </div>
        )}
      </div>

       {/* PLANNING HUD */}
       {state.ui.showPlanning && state.activePlan && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 w-[420px] p-6 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[40px] shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col gap-1 mb-4 text-center">
            <span className="text-[9px] font-black uppercase text-emerald-400 tracking-[0.4em]">Current Objective</span>
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">{state.activePlan.objective || "Strategic Synthesis"}</h2>
          </div>
          <div className="space-y-2">
            {state.activePlan.steps.map((step, idx) => (
              <div key={idx} className={`relative flex items-center justify-between p-3 rounded-xl border transition-all duration-500 ${step.status === 'active' ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : step.status === 'completed' ? 'bg-white/5 border-white/10 opacity-40' : 'bg-transparent border-white/5 opacity-20'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${step.status === 'active' ? 'bg-emerald-400 animate-pulse' : step.status === 'completed' ? 'bg-white' : 'bg-white/20'}`} />
                  <span className="text-[10px] font-bold tracking-tight uppercase">{step.label}</span>
                </div>
                <span className="text-[8px] font-mono text-white/30">[{step.type.toUpperCase()}]</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NEURAL DB PANEL */}
      {state.ui.showKnowledge && (
        <div className="absolute top-24 right-8 z-20 w-[440px] max-h-[75vh] flex flex-col bg-slate-950/60 backdrop-blur-3xl border border-white/10 rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-right-8 duration-700 panel-glow">
          <div className="p-8 bg-white/5 border-b border-white/10 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black uppercase text-white tracking-[0.3em]">Neural Repository</span>
              <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_#6366f1] animate-pulse" />
            </div>
            <div className="relative group/search">
              <input 
                type="text" 
                placeholder="SEARCH NEURAL PATHWAYS..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-[10px] font-black tracking-widest text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="text-white/40 hover:text-rose-400 transition-colors bg-white/5 rounded-full p-1"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                )}
                <div className="text-white/20 group-focus-within/search:text-indigo-400 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
              </div>
            </div>
            {searchTerm && (
              <div className="px-2 text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400/60">
                {state.knowledgeBase.filter(k => 
                  k.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  k.description.toLowerCase().includes(searchTerm.toLowerCase())
                ).length} Synapses Visualized
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {state.knowledgeBase.length > 0 && (
              <KnowledgeGraph 
                entries={state.knowledgeBase} 
                width={370} 
                height={240} 
                searchTerm={searchTerm} 
                onNodeClick={(id) => {
                  knowledgeRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              />
            )}
            {state.knowledgeBase.length === 0 ? (
              <div className="py-24 text-center opacity-20 text-[10px] font-black uppercase tracking-[0.4em]">Awaiting Uplink...</div>
            ) : (
              state.knowledgeBase
                .slice()
                .reverse()
                .filter(k => 
                  searchTerm === "" || 
                  k.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  k.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  k.category.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((k) => {
                  const highlightText = (text: string, query: string) => {
                    if (!query.trim()) return text;
                    const parts = text.split(new RegExp(`(${query})`, 'gi'));
                    return parts.map((part, index) => 
                      part.toLowerCase() === query.toLowerCase() 
                        ? <mark key={index} className="bg-indigo-500/40 text-white rounded-sm px-0.5">{part}</mark> 
                        : part
                    );
                  };

                  return (
                    <div 
                      key={k.id} 
                      ref={el => { knowledgeRefs.current[k.id] = el; }}
                      onClick={() => {
                        knowledgeRefs.current[k.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className={`p-6 bg-white/5 rounded-3xl border transition-all duration-300 cursor-pointer group/card ${
                        searchTerm !== "" && (k.title.toLowerCase().includes(searchTerm.toLowerCase()) || k.description.toLowerCase().includes(searchTerm.toLowerCase()))
                        ? 'border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.1)] bg-indigo-500/5 scale-[1.02]' 
                        : 'border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">
                          {highlightText(k.category, searchTerm)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-mono text-white/20">#{k.iteration}</span>
                          <div className="opacity-0 group-hover/card:opacity-100 transition-opacity text-indigo-400">
                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-xs font-black text-white mb-2 uppercase italic">
                        {highlightText(k.title, searchTerm)}
                      </h4>
                      <p className="text-[11px] leading-relaxed text-white/50">
                        {highlightText(k.description, searchTerm)}
                      </p>
                    </div>
                  );
                })
            )}
            {state.knowledgeBase.length > 0 && state.knowledgeBase.filter(k => 
                searchTerm !== "" && 
                (k.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                 k.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 k.category.toLowerCase().includes(searchTerm.toLowerCase()))
              ).length === 0 && searchTerm !== "" && (
                <div className="py-12 text-center opacity-40 text-[9px] font-black uppercase tracking-widest text-rose-400">
                  No Neural Matches Found For "{searchTerm}"
                </div>
              )}
          </div>
        </div>
      )}

      {/* 3D RENDERER */}
      <div className="absolute inset-0 w-full h-full z-0">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center bg-slate-950 text-white">
            <div className="text-center">
              <div className="mb-4 text-2xl">⚙️ Loading 3D Engine...</div>
              <div className="text-sm opacity-50">Initializing graphics renderer</div>
            </div>
          </div>
        }>
          <SimulationCanvas objects={state.objects} avatarPos={avatarPos} avatarTarget={null} activePlan={state.activePlan} />
        </Suspense>
      </div>

      {/* DEBUG LOGGER PANEL */}
      <button 
        onClick={() => {
          const logs = logger.getLogs();
          console.log('📋 Recent logs:', logs);
          alert(`Logs exported to console. Total: ${logs.length}\n\nTip: Type 'world26Logger.exportLogs()' in console to get JSON.`);
        }}
        className="fixed bottom-24 right-8 z-50 px-4 py-2 bg-purple-600/80 hover:bg-purple-500 backdrop-blur-sm border border-purple-400/50 rounded-2xl text-xs font-bold text-white transition-all duration-300 shadow-lg hover:shadow-purple-500/50"
        title="Export debug logs"
      >
        🔍 Debug Logs
      </button>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-[480px] bg-slate-900 border border-white/10 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-sky-500" />
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-6">Uplink Configuration</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-white/40 tracking-[0.3em] mb-3">Mistral API Key</label>
                <input 
                  type="password" 
                  value={userApiKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUserApiKey(val);
                    localStorage.setItem('mistral_api_key', val);
                  }}
                  placeholder="Paste your API key here..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-mono focus:outline-none focus:border-sky-500/50 transition-all"
                />
                <p className="mt-3 text-[10px] text-white/30 leading-relaxed uppercase font-bold tracking-tight">
                  Your key is stored locally in this browser. If not provided, the simulation will attempt to use the secondary server bridge.
                </p>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full h-14 bg-white text-slate-950 rounded-2xl font-black uppercase tracking-widest hover:bg-sky-50 transition-all active:scale-95"
                >
                  Save & Close
                </button>
              </div>
            </div>
            
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-6 right-6 text-white/20 hover:text-white transition-all"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}

      {/* WALLET / API STATUS */}
      {wallet && (
        <div className="absolute bottom-32 right-8 z-10 pointer-events-auto flex items-center gap-4 px-6 py-3 bg-black/60 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-2xl panel-glow">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_#fbbf24]" />
          <div className="flex flex-col">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-500/80">3DAI Wallet Link</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-mono font-bold text-white tracking-tighter">
                {wallet.credits !== undefined ? wallet.credits.toLocaleString() : (wallet.balance || 'ACTIVE')}
              </span>
              <span className="text-[8px] text-white/30 uppercase font-black">Credits</span>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="absolute bottom-8 right-8 z-10 flex gap-4">
        <button 
          onClick={() => setShowSettings(true)}
          className="w-16 h-16 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[20px] flex items-center justify-center transition-all active:scale-95 text-white/40 hover:text-white group"
          title="Settings"
        >
          <svg className="group-hover:rotate-90 transition-transform duration-700" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>

        <div className="bg-black/60 backdrop-blur-2xl p-2 rounded-2xl border border-white/10 flex">
          <button onClick={() => setIsAuto(true)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isAuto ? 'bg-sky-500 text-white shadow-xl shadow-sky-500/20' : 'text-white/30'}`}>Auto-Pilot</button>
          <button onClick={() => setIsAuto(false)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isAuto ? 'bg-white text-slate-950 shadow-xl shadow-white/10' : 'text-white/30'}`}>Manual</button>
        </div>
        <button onClick={runSimulationStep} disabled={isProcessing} className="px-12 h-16 bg-white hover:bg-sky-50 text-slate-950 rounded-[20px] font-black uppercase italic tracking-tighter transition-all shadow-2xl disabled:opacity-50 active:scale-95">Initiate Synthesis</button>
      </div>

      <div className="absolute inset-0 pointer-events-none bg-black/20" />
    </div>
  );
}

export default App;
