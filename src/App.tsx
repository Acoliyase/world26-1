
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { WorldObject, LogEntry, SimulationState, KnowledgeEntry, GroundingLink, ConstructionPlan, KnowledgeCategory } from './types';
import { decideNextAction, AIActionResponse } from '../services/aiLogic';
import { loadSimulationState, saveSimulationState } from '../services/memoryService';
import { logger } from '../services/logger';

const loadSimulationCanvas = () => import('../components/SimulationCanvas');
const loadKnowledgeGraph = () => import('../components/KnowledgeGraph');

const SimulationCanvas = lazy(loadSimulationCanvas);
const KnowledgeGraph = lazy(() => loadKnowledgeGraph().then(module => ({ default: module.KnowledgeGraph })));

const INITIAL_GOAL = "Synthesize Sustainable Modular Settlement";

const getTerrainHeight = (x: number, z: number) => {
  return Math.sin(x * 0.2) * Math.cos(z * 0.2) * 1.2;
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
    ui: { showStats: true, showKnowledge: true, showLogs: true, showPlanning: true, showNetwork: true }
  });

  const [avatarPos, setAvatarPos] = useState<[number, number, number]>([0, 0, 0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuto, setIsAuto] = useState(true);
  const [currentTask, setCurrentTask] = useState<string>("Analyzing Local Sector...");
  const [taskProgress, setTaskProgress] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'action') => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, { id: Math.random().toString(), type, message, timestamp: Date.now() }]
    }));
  }, []);

  // Load state on mount
  useEffect(() => {
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
          setState(prev => ({
            ...prev,
            ...savedState,
            // Ensure UI settings and metrics aren't wiped if missing in save
            ui: savedState.ui || prev.ui,
            apiMetrics: savedState.apiMetrics || prev.apiMetrics,
            logs: savedState.logs || prev.logs
          }));
          
          addLog("Neural Memory Restored: Continuing previous simulation.", "success");
          
          if (savedState.objects && savedState.objects.length > 0) {
            setAvatarPos(savedState.objects[savedState.objects.length - 1].position);
          }
        }
      } catch (err) {
        console.error("Memory initialization failed:", err);
      }
    }
    initMemory();
  }, [addLog]);

  // Warm up lazy chunks shortly after mount so toggling panels feels instant.
  useEffect(() => {
    const warmUp = () => {
      void loadSimulationCanvas();
      if (state.ui.showKnowledge) {
        void loadKnowledgeGraph();
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warmUp, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(warmUp, 600);
    return () => window.clearTimeout(timeoutId);
  }, [state.ui.showKnowledge]);

  // Auto-save state whenever significant changes occur
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.objects.length > 0 || state.knowledgeBase.length > 0) {
        saveSimulationState(state);
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
    addLog("Accessing local sector topology map...", "thinking");
    await new Promise(r => setTimeout(r, 600));
    setTaskProgress(20);
    const apiStartTime = Date.now();

    try {
      const decision: AIActionResponse = await decideNextAction(
        state.logs, 
        state.objects, 
        state.currentGoal, 
        state.knowledgeBase,
        getTerrainHeight,
        state.activePlan
      );
      
      const apiLatency = Date.now() - apiStartTime;
      setState(prev => ({
        ...prev,
        apiMetrics: [...prev.apiMetrics, { id: Math.random().toString(), timestamp: Date.now(), latency: apiLatency, status: 'success' }].slice(-20)
      }));

      setTaskProgress(40);
      addLog("Neural Uplink Successful. Processing synthesis packets...", "success");
      
      // Stream AI reasoning steps line by line
      if (decision.reasoningSteps && decision.reasoningSteps.length > 0) {
        for (const step of decision.reasoningSteps) {
          addLog(`[REASONING]: ${step}`, 'thinking');
          await new Promise(r => setTimeout(r, 250));
        }
      }

      setCurrentTask(decision.taskLabel);
      setTaskProgress(70);

      const normalizePlan = (plan?: ConstructionPlan | undefined): ConstructionPlan | undefined => {
        if (!plan) return undefined;
        return {
          ...plan,
          steps: plan.steps.map((step, index) => ({
            ...step,
            status: step.status || (index === plan.currentStepIndex ? 'active' : 'pending')
          }))
        };
      };

      const planFromDecision = normalizePlan(decision.plan);
      const existingPlan = normalizePlan(state.activePlan);
      const nextPlan = planFromDecision || existingPlan;

      if (decision.action === 'PLACE') {
        const targetType = decision.objectType || (nextPlan ? nextPlan.steps[nextPlan.currentStepIndex].type : 'modular_unit');
        let targetPos = decision.position || (nextPlan ? nextPlan.steps[nextPlan.currentStepIndex].position : [0,0,0]);

        targetPos = [targetPos[0], getTerrainHeight(targetPos[0], targetPos[2]), targetPos[2]];

        addLog(`Synthesis Confirmed: Deploying ${targetType} unit.`, 'success');
        setAvatarPos(targetPos as [number, number, number]);
        
        await new Promise(r => setTimeout(r, 300));
        setTaskProgress(100);

        const newObj: WorldObject = {
          id: Math.random().toString(),
          type: targetType as any,
          position: targetPos as [number, number, number],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          timestamp: Date.now()
        };

        setState(prev => {
          let updatedPlan = planFromDecision || normalizePlan(prev.activePlan);
          if (updatedPlan && updatedPlan.steps && typeof updatedPlan.currentStepIndex === 'number' && updatedPlan.steps[updatedPlan.currentStepIndex]) {
            const steps = [...updatedPlan.steps];
            steps[updatedPlan.currentStepIndex] = {
              ...steps[updatedPlan.currentStepIndex],
              status: 'completed'
            };
            const nextIdx = updatedPlan.currentStepIndex + 1;
            if (nextIdx < steps.length) {
              steps[nextIdx] = {
                ...steps[nextIdx],
                status: 'active'
              };
              updatedPlan = { ...updatedPlan, steps, currentStepIndex: nextIdx };
            } else {
              updatedPlan = undefined;
              addLog("Strategic Objective Achieved.", "success");
            }
          } else if (updatedPlan && (!updatedPlan.steps || !updatedPlan.steps[updatedPlan.currentStepIndex])) {
            updatedPlan = undefined;
          }

          const newKnowledge = [...prev.knowledgeBase];
          const titleCandidate = decision.learningNote?.split(':')[0]?.trim() || "Synthesis Logic";
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

          return {
            ...prev,
            objects: [...prev.objects, newObj],
            learningIteration: prev.learningIteration + 1,
            activePlan: updatedPlan,
            knowledgeBase: newKnowledge,
            progression: {
              ...prev.progression,
              totalBlocks: prev.progression.totalBlocks + 1,
              complexityLevel: Math.floor((prev.progression.totalBlocks + 1) / 5) + 1,
              structuresCompleted: prev.progression.structuresCompleted + (targetType === 'modular_unit' ? 1 : 0)
            }
          };
        });
      } else if (decision.action === 'MOVE' && decision.position) {
        setAvatarPos([decision.position[0], getTerrainHeight(decision.position[0], decision.position[2]), decision.position[2]]);
        addLog(`Relocating: Optimizing sector positioning.`, 'action');
        if (planFromDecision) {
          setState(prev => ({ ...prev, activePlan: planFromDecision }));
        }
      } else {
        addLog(`Simulation standby: ${decision.reason}`, 'action');
        if (planFromDecision) {
          setState(prev => ({ ...prev, activePlan: planFromDecision }));
          addLog("Blueprint persisted to active plan and awaits execution.", "success");
        }
      }
    } catch (e) {
      addLog("Critical neural desync. Link unstable.", "error");
      setState(prev => ({ 
        ...prev, 
        networkStatus: 'error',
        apiMetrics: [...prev.apiMetrics, { id: Math.random().toString(), timestamp: Date.now(), latency: Date.now() - apiStartTime, status: 'error' }].slice(-20) 
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

  useEffect(() => {
    if (isAuto && !isProcessing) {
      const t = setTimeout(runSimulationStep, 2200);
      return () => clearTimeout(t);
    }
  }, [isAuto, isProcessing, runSimulationStep]);

  useEffect(() => {
    if (logContainerRef.current) logContainerRef.current.scrollTo({ top: logContainerRef.current.scrollHeight, behavior: 'smooth' });
  }, [state.logs]);

  return (
    <div className="relative w-full h-screen overflow-hidden text-slate-200 bg-slate-950 font-sans italic-font">
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
          <div className="pointer-events-auto p-6 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[30px] shadow-2xl animate-in slide-in-from-left-8 duration-700 flex flex-col gap-6 shrink-0">
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
          <div className="pointer-events-auto h-32 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[30px] shadow-2xl animate-in slide-in-from-left-8 duration-500 overflow-hidden flex flex-col shrink-0">
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
            <div className="pointer-events-auto flex-1 min-h-[150px] bg-black/80 backdrop-blur-2xl border border-white/10 rounded-[30px] overflow-hidden shadow-2xl animate-in slide-in-from-left-8 duration-700 flex flex-col">
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
        <div className="absolute top-24 right-8 z-20 w-[440px] max-h-[75vh] flex flex-col bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-right-8 duration-700">
          <div className="p-8 bg-white/5 border-b border-white/10 flex justify-between items-center">
            <span className="text-sm font-black uppercase text-white tracking-[0.3em]">Neural Repository</span>
            <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_#6366f1] animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {state.knowledgeBase.length > 0 && (
              <Suspense fallback={<div className="h-[240px] rounded-2xl border border-white/10 bg-white/5 animate-pulse" />}>
                <KnowledgeGraph entries={state.knowledgeBase} width={370} height={240} />
              </Suspense>
            )}
            {state.knowledgeBase.length === 0 ? (
              <div className="py-24 text-center opacity-20 text-[10px] font-black uppercase tracking-[0.4em]">Awaiting Uplink...</div>
            ) : (
              state.knowledgeBase.slice().reverse().map((k) => (
                <div key={k.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-white/20 transition-all duration-300">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">{k.category}</span>
                    <span className="text-[8px] font-mono text-white/20">#{k.iteration}</span>
                  </div>
                  <h4 className="text-xs font-black text-white mb-2 uppercase italic">{k.title}</h4>
                  <p className="text-[11px] leading-relaxed text-white/50">{k.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3D RENDERER */}
      <div className="absolute inset-0 w-full h-full z-0">
        <Suspense fallback={<div className="h-full w-full bg-slate-950 grid place-items-center text-[10px] uppercase tracking-[0.3em] text-white/30">Booting render core…</div>}>
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

      {/* FOOTER */}
      <div className="absolute bottom-8 right-8 z-10 flex gap-4">
        <div className="bg-black/60 backdrop-blur-2xl p-2 rounded-2xl border border-white/10 flex">
          <button onClick={() => setIsAuto(true)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isAuto ? 'bg-sky-500 text-white shadow-xl shadow-sky-500/20' : 'text-white/30'}`}>Auto-Pilot</button>
          <button onClick={() => setIsAuto(false)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isAuto ? 'bg-white text-slate-950 shadow-xl shadow-white/10' : 'text-white/30'}`}>Manual</button>
        </div>
        <button onClick={runSimulationStep} disabled={isProcessing} className="px-12 h-16 bg-white hover:bg-sky-50 text-slate-950 rounded-[20px] font-black uppercase italic tracking-tighter transition-all shadow-2xl disabled:opacity-50 active:scale-95">Initiate Synthesis</button>
      </div>

      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_50%,_rgba(2,6,23,0.9)_100%)] opacity-80" />
    </div>
  );
}

export default App;
