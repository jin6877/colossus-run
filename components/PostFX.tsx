'use client';

/**
 * PostFX stack (DESIGN §8), Ashen-Dusk regrade of meteor-city:
 *   AO -> ToneMapping(ACES) -> Bloom(LDR, high threshold) -> grade -> CA -> Vignette -> SMAA
 * meteor-city's TiltShift2 (miniature signature) and any motion blur are REMOVED
 * — this is a ground-level immersive runner. Bloom runs after tone mapping with a
 * high threshold so only the warden's cold glow + fire cores bloom, spiking on
 * impact. The color grade desaturates further as the warden closes (p), and the
 * base cinematic vignette keeps the frame focused. The diegetic red proximity
 * vignette + cold top-tint live as DOM overlays (HUD) so they can pulse with the
 * footstep cadence cheaply.
 */
import { useFrame } from '@react-three/fiber';
import { useCallback, useRef } from 'react';
import {
  EffectComposer,
  Bloom,
  N8AO,
  HueSaturation,
  BrightnessContrast,
  ChromaticAberration,
  Vignette,
  SMAA,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { BloomEffect } from 'postprocessing';
import { Vector2 } from 'three';
import type { Engine } from '@/lib/engine';
import type { QualityPreset } from '@/lib/quality';

type UniformHolder = { uniforms: Map<string, { value: number }> };

export default function PostFX({ engine, quality }: { engine: Engine; quality: QualityPreset }) {
  const bloomRef = useRef<BloomEffect | null>(null);
  const gradeRef = useRef<UniformHolder | null>(null);

  const setBloom = useCallback((e: BloomEffect | null) => {
    bloomRef.current = e;
  }, []);
  const setGrade = useCallback((e: unknown) => {
    gradeRef.current = (e as UniformHolder | null) ?? null;
  }, []);

  useFrame(() => {
    if (bloomRef.current) {
      const t = engine.bloom.value;
      const cur = bloomRef.current.intensity;
      bloomRef.current.intensity = cur + (t - cur) * 0.35;
    }
    if (gradeRef.current) {
      const u = gradeRef.current.uniforms.get('saturation');
      if (u) {
        const target = -0.1 - 0.12 * engine.proximity; // -0.10 -> -0.22 (DESIGN §4.2)
        u.value += (target - u.value) * 0.1;
      }
    }
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={quality.ao}>
      {quality.ao ? (
        <N8AO aoRadius={0.6} intensity={1.1} distanceFalloff={1.0} color="#211d18" halfRes={quality.tier === 'low'} />
      ) : (
        <></>
      )}

      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

      {quality.bloom ? (
        <Bloom ref={setBloom} intensity={0.25} luminanceThreshold={0.9} luminanceSmoothing={0.08} mipmapBlur radius={0.6} />
      ) : (
        <></>
      )}

      <HueSaturation ref={setGrade} saturation={-0.1} hue={0} />
      <BrightnessContrast brightness={-0.01} contrast={0.06} />

      {quality.chromaticAberration ? (
        <ChromaticAberration offset={new Vector2(0.001, 0.001)} radialModulation={false} modulationOffset={0} />
      ) : (
        <></>
      )}

      {quality.vignette ? <Vignette offset={0.4} darkness={0.35} /> : <></>}

      <SMAA />
    </EffectComposer>
  );
}
