
import React, { useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import { Physics, usePlane, useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { WorldObject, ConstructionPlan } from '../src/types';
import { WorldAsset } from './WorldAssets';
import { Avatar } from './Avatar';
import { ErrorBoundary } from './ErrorBoundary';

interface SimulationCanvasProps {
  objects: WorldObject[];
  avatarPos: [number, number, number];
  avatarTarget: [number, number, number] | null;
  activePlan?: ConstructionPlan;
}

const PhysicsTerrain: React.FC = () => {
  const [ref] = usePlane(() => ({ 
    rotation: [-Math.PI / 2, 0, 0], 
    position: [0, 0, 0] 
  }));

  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(1000, 1000, 64, 64);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getY(i);
      const h = (Math.sin(x * 0.1) * Math.cos(z * 0.1) * 1.5) +
                (Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4.0);
      pos.setZ(i, h);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh ref={ref as any} geometry={geom} receiveShadow>
      <meshStandardMaterial
        color="#0a0f1d"
        roughness={0.8}
        metalness={0.2}
        emissive="#0ea5e9"
        emissiveIntensity={0.05}
      />
    </mesh>
  );
};

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ objects, avatarPos, avatarTarget, activePlan }) => {
  const ghostObjects = useMemo(() => {
    if (!activePlan) return [];
    return activePlan.steps.filter(step => step.status !== 'completed');
  }, [activePlan]);

  return (
    <div className="w-full h-full bg-black relative group">
      {/* Minimal UI Overlay */}
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <div className="bg-black/20 backdrop-blur-sm border border-white/5 rounded-lg p-3">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
            Simulation Active • {objects.length} Objects
          </span>
        </div>
      </div>

      <Canvas 
        camera={{ position: [25, 25, 25], fov: 40, far: 2000 }} 
        shadows
        gl={{ 
          powerPreference: "high-performance", 
          alpha: false, 
          antialias: true,
        }}
      >
        <color attach="background" args={['#05070a']} />
        <fogExp2 attach="fog" args={['#05070a', 0.005]} />
        
        <Suspense fallback={null}>
          <Physics gravity={[0, -9.81, 0]} allowSleep>
            <PhysicsTerrain />
            
            <Stars radius={400} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
            <Environment preset="city" />
            
            <directionalLight 
              position={[-60, 120, 60]}
              intensity={0.8} 
              castShadow 
              shadow-mapSize={[1024, 1024]}
            />
            
            <ambientLight intensity={0.2} />
            <pointLight position={[0, 50, 0]} intensity={0.5} color="#ffffff" />

            <gridHelper args={[1000, 100, '#1e293b', '#080c14']} position={[0, -0.01, 0]} />

            {/* Existing Real Objects */}
            {objects.map((obj) => (
              <ErrorBoundary key={obj.id} name={`Asset-${obj.type}`}>
                <WorldAsset 
                  type={obj.type} 
                  position={obj.position} 
                  rotation={obj.rotation} 
                  scale={obj.scale} 
                  variant="real"
                  usePhysics
                />
              </ErrorBoundary>
            ))}

            {/* Planned Ghost Objects */}
            {ghostObjects.map((step, idx) => (
              <ErrorBoundary key={`ghost-${idx}`} name={`Ghost-${step.type}`}>
                <WorldAsset 
                  type={step.type} 
                  position={step.position} 
                  variant="ghost"
                />
              </ErrorBoundary>
            ))}

            <Avatar position={avatarPos} targetPosition={avatarTarget} isThinking={activePlan === undefined} />
          </Physics>
        </Suspense>

        <OrbitControls
          makeDefault
          target={[avatarPos[0], avatarPos[1], avatarPos[2]]}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
};


export default SimulationCanvas;
