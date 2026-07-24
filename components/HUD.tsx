'use client';

/**
 * In-game HUD (DESIGN §7). DOM overlay, driven by rAF reading the Engine — it
 * never re-renders React in the hot loop (distance/gauge/vignette are written to
 * refs). Focus is the survival distance (top-left, ExtraBold tabular-nums); the
 * center is kept empty (the road's vanishing point). Proximity is spoken mainly
 * by the diegetic red vignette (pulsing with the footstep cadence) + shake; the
 * thin danger bar is only a backup. Idle-fades for clean captures.
 */
import { useEffect, useRef } from 'react';
import type { Engine } from '@/lib/engine';
import { isMobileDevice } from '@/lib/quality';

export default function HUD({ engine }: { engine: Engine }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const distRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const dashRef = useRef<HTMLDivElement>(null);
  const redRef = useRef<HTMLDivElement>(null);
  const coldRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const dangerRef = useRef<HTMLSpanElement>(null);
  const lastActivity = useRef(0);
  const mobile = isMobileDevice();

  useEffect(() => {
    lastActivity.current = performance.now();
    const wake = () => (lastActivity.current = performance.now());
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);

    let raf = 0;
    let footClock = 0;
    let prevT = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;
      const h = engine.getHud();
      if (distRef.current) distRef.current.textContent = h.distance.toLocaleString('en-US');
      if (speedRef.current) speedRef.current.textContent = `${h.speedKmh} km/h`;
      if (gaugeRef.current) {
        gaugeRef.current.style.width = `${Math.round(h.proximity * 100)}%`;
        gaugeRef.current.style.background = `color-mix(in srgb, #9a9284 ${Math.round(
          (1 - h.proximity) * 100,
        )}%, #c4402e)`;
      }
      if (dashRef.current) {
        dashRef.current.style.opacity = h.dashReady >= 1 ? '1' : '0.4';
        dashRef.current.style.transform = `scale(${0.9 + h.dashReady * 0.1})`;
      }
      // diegetic red proximity vignette, pulsing on the footstep cadence
      if (redRef.current) {
        footClock += dt * (2 + h.proximity * 2);
        const pulse = 0.85 + 0.15 * Math.sin(footClock * Math.PI * 2);
        const base = h.proximity > 0.6 ? ((h.proximity - 0.6) / 0.4) * 0.6 : 0;
        redRef.current.style.opacity = String(base * pulse);
      }
      if (coldRef.current) {
        coldRef.current.style.opacity = String(h.proximity > 0.85 ? (h.proximity - 0.85) / 0.15 * 0.12 : 0);
      }
      // graze hit flash (readable collision feedback)
      if (flashRef.current) flashRef.current.style.opacity = String((h.hitFlash || 0) * 0.5);
      if (dangerRef.current) {
        dangerRef.current.style.opacity = String(h.proximity > 0.55 ? (h.proximity - 0.55) / 0.45 : 0);
      }
      // idle fade (keep visible when the warden is close)
      const idle = now - lastActivity.current > 2600 && h.proximity < 0.45;
      if (wrapRef.current) wrapRef.current.style.opacity = idle ? '0.2' : '1';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [engine]);

  return (
    <>
      {/* diegetic proximity overlays (behind the chrome, above the canvas) */}
      <div
        ref={redRef}
        className="pointer-events-none fixed inset-0 z-10"
        style={{
          opacity: 0,
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, #5e1710 100%)',
        }}
      />
      {/* extreme-proximity top tint — the creature's warm maw-breath fills the frame
          (organic warm ember, not the old cold cyan) */}
      <div
        ref={coldRef}
        className="pointer-events-none fixed inset-x-0 top-0 z-10 h-1/3"
        style={{
          opacity: 0,
          background: 'linear-gradient(to bottom, rgba(134,54,25,0.6), rgba(134,54,25,0))',
        }}
      />
      {/* graze hit flash — a hard red pulse so a collision is unmistakable */}
      <div
        ref={flashRef}
        className="pointer-events-none fixed inset-0 z-10"
        style={{ opacity: 0, background: 'radial-gradient(ellipse at center, rgba(196,64,46,0) 30%, #c4402e 100%)' }}
      />

      <div ref={wrapRef} className="hud-fade pointer-events-none fixed inset-0 z-20">
        {/* survival distance — the one focus (top-left, DESIGN §7.2) */}
        <div className="absolute left-5 top-4 select-none">
          <div className="flex items-baseline gap-1">
            <span
              ref={distRef}
              className="tnum text-5xl font-extrabold leading-none tracking-tight text-[#ede6d8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] sm:text-6xl"
            >
              0
            </span>
            <span className="text-xl font-semibold text-[#9a9284]">m</span>
          </div>
          <span ref={speedRef} className="tnum ml-0.5 text-sm font-medium text-[#9a9284]">
            0 km/h
          </span>
        </div>

        {/* danger indicator — "위험" label + gauge (backup to the diegetic vignette) */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <span
            ref={dangerRef}
            className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#c4402e]"
            style={{ opacity: 0 }}
          >
            위험
          </span>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/[0.06]">
            <div ref={gaugeRef} className="h-full rounded-full" style={{ width: '0%' }} />
          </div>
        </div>

        {/* dash cooldown radial (also the mobile dash button) */}
        <div
          ref={dashRef}
          data-control
          onPointerDown={() => engine.input.queueDash()}
          className={`pointer-events-auto absolute bottom-8 right-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[#0e0c0a]/40 text-[10px] font-semibold uppercase tracking-widest text-[#c97b3c] backdrop-blur-sm ${
            mobile ? '' : 'hidden sm:hidden'
          }`}
          style={{ opacity: 0.4 }}
        >
          대시
        </div>

        {/* mobile hint / jump-slide targets */}
        {mobile ? (
          <>
            <div
              data-control
              onPointerDown={() => engine.input.queueJump()}
              className="pointer-events-auto absolute bottom-8 left-6 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#0e0c0a]/40 text-[10px] font-semibold text-[#ede6d8] backdrop-blur-sm"
            >
              점프
            </div>
            <div
              data-control
              onPointerDown={() => engine.input.setSlide(true)}
              onPointerUp={() => engine.input.setSlide(false)}
              onPointerLeave={() => engine.input.setSlide(false)}
              className="pointer-events-auto absolute bottom-24 left-6 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#0e0c0a]/40 text-[10px] font-semibold text-[#ede6d8] backdrop-blur-sm"
            >
              슬라이드
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
