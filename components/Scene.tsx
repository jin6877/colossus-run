'use client';

/**
 * The R3F Canvas + everything React manages (DESIGN §3 lighting). The imperative
 * Engine (course/debris/fx/actors) mounts as a single <primitive> so its hundreds
 * of pieces never touch the reconciler, and the Engine fully owns the camera
 * (custom chase rig — NO OrbitControls, PROJECT.md §7). The key light is
 * chase-relative: it rides behind-and-above the hero every frame, so the warden —
 * further back still — casts a long shadow FORWARD onto the road (DESIGN §축 2).
 */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import {
  NoToneMapping,
  BackSide,
  Color,
  ShaderMaterial,
  DirectionalLight,
  Object3D,
  Vector3,
  PCFSoftShadowMap,
} from 'three';
import EngineRunner from './EngineRunner';
import PostFX from './PostFX';
import type { Engine } from '@/lib/engine';
import type { QualityPreset } from '@/lib/quality';
import {
  SKY_TOP,
  SKY_HORIZON,
  FOG_COLOR,
  FOG_DENSITY,
  KEY_COLOR,
  KEY_INTENSITY,
  HEMI_SKY,
  HEMI_GROUND,
  HEMI_INTENSITY,
  TONE_EXPOSURE,
} from '@/lib/constants';

// ---------- gradient sky (flat vertical gradient, no sun disk / flare) ----------
function GradientSky() {
  const mat = useMemo(() => {
    return new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new Color(SKY_TOP) },
        horizon: { value: new Color(SKY_HORIZON) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 top; uniform vec3 horizon;
        void main(){
          float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 c = mix(horizon, top, smoothstep(0.30, 0.9, t));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
  }, []);
  // sky follows the camera so the horizon is always around us
  const ref = useRef<import('three').Mesh>(null);
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={ref} scale={600} renderOrder={-1}>
      <sphereGeometry args={[1, 24, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ---------- chase-relative key light (the forward-shadow engine, DESIGN §축 2) ----------
function SunRig({ engine, quality }: { engine: Engine; quality: QualityPreset }) {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const lightRef = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const _p = useMemo(() => new Vector3(), []);

  useEffect(() => {
    scene.background = new Color(SKY_HORIZON);
    gl.toneMappingExposure = TONE_EXPOSURE;
    gl.shadowMap.type = PCFSoftShadowMap;
    scene.add(target);
    return () => {
      scene.remove(target);
    };
  }, [scene, gl, target]);

  useFrame(() => {
    const l = lightRef.current;
    if (!l) return;
    const h = engine.heroPos;
    const tx = engine.tangent.x;
    const tz = engine.tangent.z;
    // low back-light: 80m behind (−T), 26m up, ~16° elevation -> long forward shadow
    _p.set(h.x - tx * 80, 26, h.z - tz * 80);
    l.position.copy(_p);
    target.position.set(h.x, 0, h.z);
    target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={[HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY]} />
      <directionalLight
        ref={lightRef}
        color={KEY_COLOR}
        intensity={KEY_INTENSITY}
        castShadow
        target={target}
        shadow-mapSize-width={quality.shadowMapSize}
        shadow-mapSize-height={quality.shadowMapSize}
        shadow-radius={5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={130}
        shadow-camera-bottom={-70}
      />
    </>
  );
}

export default function Scene({ engine, quality }: { engine: Engine; quality: QualityPreset }) {
  return (
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      gl={{
        antialias: false,
        toneMapping: NoToneMapping, // ACES applied by the ToneMapping effect
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true, // enables the result-card PNG snapshot
      }}
      camera={{ position: [0, 4, 12], fov: 60, near: 0.5, far: 1400 }}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}
    >
      <fogExp2
        attach="fog"
        args={[FOG_COLOR, quality.tier === 'low' ? FOG_DENSITY.low : FOG_DENSITY.high]}
      />
      <SunRig engine={engine} quality={quality} />
      <GradientSky />

      {/* imperative engine content (course + actors + debris + fx) — one primitive */}
      <primitive object={engine.root} />

      <EngineRunner engine={engine} />
      <PostFX engine={engine} quality={quality} />
    </Canvas>
  );
}
