
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { KnowledgeEntry, KnowledgeCategory } from '../src/types';
import { Filter, X } from 'lucide-react';
import * as d3 from 'd3-force';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  category: KnowledgeCategory;
  iteration: number;
}

interface Edge extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  type: 'category' | 'sequence';
}

const CATEGORY_COLORS: Record<KnowledgeCategory, string> = {
  Infrastructure: '#38bdf8',
  Energy: '#fbbf24',
  Environment: '#34d399',
  Architecture: '#a78bfa',
  Synthesis: '#f472b6'
};

export const KnowledgeGraph: React.FC<{ 
  entries: KnowledgeEntry[], 
  width?: number, 
  height?: number, 
  searchTerm?: string,
  onNodeClick?: (id: string) => void
}> = ({ entries, width = 350, height = 250, searchTerm = "", onNodeClick }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [filterCategory, setFilterCategory] = useState<KnowledgeCategory | 'All'>('All');
  const [filterIteration, setFilterIteration] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const simulationRef = useRef<d3.Simulation<Node, Edge> | null>(null);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchCat = filterCategory === 'All' || entry.category === filterCategory;
      const matchIter = filterIteration === '' || entry.iteration.toString().includes(filterIteration);
      return matchCat && matchIter;
    });
  }, [entries, filterCategory, filterIteration]);

  useEffect(() => {
    // 1. Prepare Nodes - preserve positions for existing nodes
    const newNodes: Node[] = filteredEntries.map((entry) => {
      const existing = nodes.find(n => n.id === entry.id);
      return {
        id: entry.id,
        x: existing?.x ?? width / 2 + (Math.random() - 0.5) * 40,
        y: existing?.y ?? height / 2 + (Math.random() - 0.5) * 40,
        title: entry.title,
        category: entry.category,
        iteration: entry.iteration
      };
    });

    // 2. Prepare Edges
    const newEdges: Edge[] = [];
    
    // Sequence Chain (Chronological)
    for (let i = 0; i < filteredEntries.length - 1; i++) {
      newEdges.push({ source: filteredEntries[i].id, target: filteredEntries[i + 1].id, type: 'sequence' });
    }

    // Category Chain (Topic Threading)
    const lastInCategory: Record<string, string> = {};
    filteredEntries.forEach(entry => {
      if (lastInCategory[entry.category]) {
        newEdges.push({ source: lastInCategory[entry.category], target: entry.id, type: 'category' });
      }
      lastInCategory[entry.category] = entry.id;
    });

    // 3. Initialize/Update Simulation
    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation<Node>()
        .force("link", d3.forceLink<Node, Edge>().id(d => d.id).distance(d => d.type === 'sequence' ? 40 : 60))
        .force("charge", d3.forceManyBody().strength(-150))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(25))
        .force("x", d3.forceX(width / 2).strength(0.05))
        .force("y", d3.forceY(height / 2).strength(0.05));
    }

    simulationRef.current.nodes(newNodes);
    const linkForce = simulationRef.current.force("link") as d3.ForceLink<Node, Edge>;
    linkForce.links(newEdges);

    simulationRef.current.on("tick", () => {
      // Create a new array to trigger React re-render
      setNodes([...newNodes]);
      setEdges([...newEdges]);
    });

    simulationRef.current.alpha(1).restart();

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, [filteredEntries, width, height]);

  // Handle manual simulation cleanup
  useEffect(() => {
    return () => {
      if (simulationRef.current) simulationRef.current.stop();
    };
  }, []);

  return (
    <div className="relative overflow-hidden bg-black/60 rounded-3xl border border-white/5 mb-6 group" style={{ width, height }}>
      <div className="absolute top-4 left-5 z-10">
        <div className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">Neural Topology</div>
        <div className="flex gap-2 mt-2">
          {Object.entries(CATEGORY_COLORS).map(([cat, col]) => (
            <div key={cat} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col }} title={cat} />
          ))}
        </div>
      </div>

      <div className="absolute top-4 right-5 z-20 flex items-center gap-2">
        {showFilters && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="bg-slate-900/80 text-[9px] font-bold text-white border border-white/10 rounded-md px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              {Object.keys(CATEGORY_COLORS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <input 
              type="text" 
              placeholder="Iter #"
              value={filterIteration}
              onChange={(e) => setFilterIteration(e.target.value)}
              className="bg-slate-900/80 text-[9px] font-bold text-white border border-white/10 rounded-md px-2 py-1 w-14 focus:outline-none placeholder:text-white/20"
            />
          </div>
        )}
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          {showFilters ? <X size={12} /> : <Filter size={12} />}
        </button>
      </div>

      <svg width={width} height={height} className="opacity-80 group-hover:opacity-100 transition-opacity">
        <defs>
          <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
          </pattern>
          <filter id="nodeGlow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        
        {filteredEntries.length === 0 && (
          <text x="50%" y="50%" textAnchor="middle" className="fill-white/10 text-[8px] font-black uppercase tracking-[0.4em] select-none">No Matching Nodes</text>
        )}

        {edges.map((e, idx) => {
          const s = e.source as Node;
          const t = e.target as Node;
          if (!s.x || !t.x) return null;
          return (
            <line 
              key={idx} 
              x1={s.x} y1={s.y} 
              x2={t.x} y2={t.y} 
              stroke={e.type === 'sequence' ? 'rgba(255,255,255,0.08)' : CATEGORY_COLORS[s.category] + '40'} 
              strokeWidth={e.type === 'sequence' ? 1.5 : 0.8} 
            />
          );
        })}
        {nodes.map((n, i) => {
          const color = CATEGORY_COLORS[n.category] || '#ffffff';
          const isMatch = searchTerm !== "" && n.title.toLowerCase().includes(searchTerm.toLowerCase());
          
          return (
          <g key={n.id} filter="url(#nodeGlow)">
            {/* Pulse effect for only the latest node OR matching nodes */}
            {(i === nodes.length - 1 || isMatch) && (
              <circle cx={n.x} cy={n.y} r={isMatch ? 15 : 12} fill={color} opacity="0.2">
                <animate attributeName="r" values={isMatch ? "10;18;10" : "8;16;8"} dur={isMatch ? "1.5s" : "2s"} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur={isMatch ? "1.5s" : "2s"} repeatCount="indefinite" />
              </circle>
            )}
            <circle 
              cx={n.x} cy={n.y} 
              r={isMatch ? 7 : 4.5} 
              fill={isMatch ? "#fff" : color} 
              className="transition-all duration-500 hover:r-6 cursor-pointer" 
              stroke={isMatch ? color : "none"}
              strokeWidth={isMatch ? 2 : 0}
              onClick={() => onNodeClick?.(n.id)}
            />
            <circle cx={n.x} cy={n.y} r={isMatch ? 10 : 8} fill="transparent" stroke={color} strokeWidth={isMatch ? 1 : 0.5} strokeDasharray="2 2" className="animate-[spin_4s_linear_infinite]" />
            <title>{n.title} [{n.category}]</title>
          </g>
          );
        })}
      </svg>
    </div>
  );
};
