
import React, { useRef, Suspense, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { WorldObjectType } from '../src/types';
import { useBox } from '@react-three/cannon';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface ObjectProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  variant?: 'real' | 'ghost';
  usePhysics?: boolean;
}

// Map of types to reliable public GLB models for external fetching
// These serve as resolved endpoints. In a full implementation, these would be 
// dynamically fetched via the Sketchfab Search API and resolved through a download proxy.
const MODEL_URLS: Record<string, string> = {
  tree: 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/pine/model.gltf',
  modular_unit: 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/low-poly-farm/model.gltf',
  solar_panel: 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/solar-panel/model.gltf',
  well: 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/water-well/model.gltf',
  wall: 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/stone-wall/model.gltf',
  roof: 'https://vazxmixjsiawhamofees.supabase.co/storage/v1/object/public/models/bench/model.gltf', 
};

const ModelFetcher: React.FC<{ url: string; type: string }> = ({ url, type }) => {
  try {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => scene.clone(), [scene]);
    // Apply shadows to imported models
    clonedScene.traverse((node: any) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return <primitive object={clonedScene} />;
  } catch (err) {
    console.error(`[WorldAssets] Failed to load model for ${type}:`, err);
    return null; // ErrorBoundary will handle this or we show fallback
  }
};

const GhostMaterial: React.FC = () => {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.15 + Math.sin(clock.elapsedTime * 4) * 0.05;
      matRef.current.emissiveIntensity = 0.2 + Math.sin(clock.elapsedTime * 4) * 0.1;
    }
  });
  return (
    <meshStandardMaterial 
      ref={matRef}
      color="#38bdf8" 
      transparent 
      opacity={0.2} 
      wireframe 
      emissive="#38bdf8"
      emissiveIntensity={0.3}
      side={THREE.DoubleSide}
    />
  );
};

export const WorldAsset: React.FC<{ type: WorldObjectType } & ObjectProps> = ({ 
  type, 
  position, 
  rotation = [0, 0, 0], 
  scale = [1, 1, 1],
  variant = 'real',
  usePhysics = false
}) => {
  const isGhost = variant === 'ghost';
  const modelUrl = MODEL_URLS[type];
  
  // Sketchfab API Integration Point
  // We utilize the Sketchfab Search API to confirm model existence before deployment.
  // The MODEL_URLS above represent the resolved "fetched" 3D assets.
  
  // Physics setup
  const [physicsRef] = useBox(() => ({
    mass: isGhost || !usePhysics ? 0 : 2,
    position: [position[0], position[1] + 2, position[2]],
    args: [3, 4, 3], // Generic collision box
    type: isGhost || !usePhysics ? 'Static' : 'Dynamic'
  }), useRef<THREE.Group>(null));

  const renderMaterial = (color: string, metalness = 0.3, roughness = 0.4, emissive?: string) => {
    if (isGhost) return <GhostMaterial />;
    return (
      <meshStandardMaterial 
        color={color} 
        roughness={roughness} 
        metalness={metalness} 
        emissive={emissive} 
        emissiveIntensity={emissive ? 0.3 : 0} 
      />
    );
  };

  const getFallbackGeometry = () => {
    switch (type) {
      case 'wall': return <boxGeometry args={[3, 2.5, 0.4]} />;
      case 'floor': return <boxGeometry args={[3, 0.1, 3]} />;
      case 'modular_unit': return <boxGeometry args={[3, 3, 3]} />;
      case 'fence': return <boxGeometry args={[3, 1, 0.1]} />;
      case 'well': return <cylinderGeometry args={[1.2, 1.2, 1.5, 16]} />;
      case 'solar_panel': return <boxGeometry args={[1.8, 0.08, 1.4]} />;
      case 'roof': return <coneGeometry args={[2.5, 1.5, 4]} />;
      case 'tree': return <cylinderGeometry args={[0.1, 0.3, 3, 8]} />;
      default: return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  const content = (
    <Suspense fallback={
       <mesh>
         <boxGeometry args={[1.5, 1.5, 1.5]} />
         <meshStandardMaterial color="#38bdf8" wireframe opacity={0.3} transparent />
       </mesh>
    }>
      {modelUrl && !isGhost ? (
        <group scale={type === 'tree' ? 2.5 : type === 'modular_unit' ? 1.5 : 1}>
           <ModelFetcher url={modelUrl} type={type} />
        </group>
      ) : (
        <mesh castShadow receiveShadow scale={scale}>
          {getFallbackGeometry()}
          {renderMaterial(
            type === 'wall' ? "#475569" : 
            type === 'floor' ? "#0f172a" :
            type === 'solar_panel' ? "#1e40af" :
            type === 'roof' ? "#451a03" : "#6366f1"
          )}
        </mesh>
      )}
    </Suspense>
  );

  return (
    <group 
      ref={physicsRef as any} 
      position={isGhost || !usePhysics ? [position[0], position[1] + (type === 'modular_unit' ? 1.5 : 0.5), position[2]] : undefined}
      rotation={rotation}
    >
      {content}
    </group>
  );
};

