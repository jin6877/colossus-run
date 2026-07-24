'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import type { Engine } from '@/lib/engine';

/**
 * Drives the imperative Engine once per rendered frame. Priority 1 so it runs
 * after R3F's internal updates; the engine fully owns the camera transform each
 * frame (there is no OrbitControls to fight — this game's camera IS the engine's).
 */
export default function EngineRunner({ engine }: { engine: Engine }) {
  const camera = useThree((s) => s.camera);
  useFrame((_, delta) => {
    if (camera instanceof PerspectiveCamera) engine.update(delta, camera);
  }, 1);
  return null;
}
