'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Scene from './Scene';
import HUD from './HUD';
import Title from './Title';
import ResultCard, { type ResultData } from './ResultCard';
import Loading from './Loading';
import ErrorFallback from './ErrorFallback';
import { Engine, type GameState } from '@/lib/engine';
import { detectQuality, type Tier } from '@/lib/quality';
import { readShareState, buildShareUrl, randomSeed, seedCode } from '@/lib/share';

type Phase = 'loading' | 'ready' | 'error';

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function savePref(key: string, val: string) {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState(0.05);
  const [loadLabel, setLoadLabel] = useState('물리 엔진 깨우는 중…');
  const [errorDetail, setErrorDetail] = useState<string | undefined>();

  const [gameState, setGameState] = useState<GameState>('title');
  const [seed, setSeed] = useState(1);
  const [best, setBest] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const engineRef = useRef<Engine | null>(null);
  const toastTimer = useRef<number>(0);
  const quality = useMemo(() => {
    const forced = (loadPref('cr:tier') as Tier | null) ?? undefined;
    return detectQuality(forced === 'high' || forced === 'low' ? forced : undefined);
  }, []);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  const syncUrl = useCallback((s: number) => {
    const url = buildShareUrl(window.location.origin, window.location.pathname, { seed: s });
    window.history.replaceState(null, '', url);
  }, []);

  // ---- one-time init ----
  useEffect(() => {
    let cancelled = false;
    if (!webglOk()) {
      setErrorDetail('WebGL 컨텍스트를 만들 수 없어요.');
      setPhase('error');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const storedBest = Number(loadPref('cr:best') || '0') || 0;
    const { state } = readShareState(params, { seed: randomSeed() });
    setBest(storedBest);
    setSeed(state.seed);

    const engine = new Engine(quality);
    engineRef.current = engine;
    engine.onStateChange = (s) => {
      setGameState(s);
      if (s === 'gameover') {
        const r = engine.getResult();
        setResult(r);
        if (r.distance > storedBest && r.distance > (Number(loadPref('cr:best') || '0') || 0)) {
          savePref('cr:best', String(r.distance));
          setBest(r.distance);
        }
      }
    };

    (async () => {
      try {
        setProgress(0.25);
        setLoadLabel('물리 엔진 깨우는 중…');
        await engine.init();
        if (cancelled) return;
        setProgress(0.7);
        setLoadLabel('도시를 짓는 중…');
        engine.input.attach(window);
        engine.setSeed(state.seed, storedBest);
        setProgress(1);
        setLoadLabel('파수꾼이 깨어나는 중…');
        setPhase('ready');
        setGameState('title');
        syncUrl(state.seed);
      } catch (e) {
        if (cancelled) return;
        setErrorDetail(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    })();

    return () => {
      cancelled = true;
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- verification hook (headless) ----
  useEffect(() => {
    if (phase !== 'ready') return;
    const w = window as unknown as Record<string, unknown>;
    w.__cr = {
      ready: () => !!engineRef.current?.ready && (engineRef.current?.preloadedChunks() ?? 0) > 0,
      stats: () => engineRef.current?.getStats(),
      state: () => engineRef.current?.getState(),
      result: () => engineRef.current?.getResult(),
      seed: () => engineRef.current?.seed,
      begin: () => engineRef.current?.beginRun(),
      steer: (v: number) => engineRef.current?.input.setSteer(v),
      jump: () => engineRef.current?.input.queueJump(),
      dash: () => engineRef.current?.input.queueDash(),
      slide: (on: boolean) => engineRef.current?.input.setSlide(on),
    };
    return () => {
      if (w.__cr) delete w.__cr;
    };
  }, [phase]);

  // ---- handlers ----
  const startSeed = useCallback(
    (s: number, run: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      setSeed(s);
      setResult(null);
      const b = Number(loadPref('cr:best') || '0') || 0;
      engine.setSeed(s, b);
      syncUrl(s);
      setGameState('title');
      if (run) requestAnimationFrame(() => engine.beginRun());
    },
    [syncUrl],
  );

  const onRun = useCallback(() => engineRef.current?.beginRun(), []);
  const onNewSeed = useCallback(() => startSeed(randomSeed(), false), [startSeed]);
  const onRetry = useCallback(() => startSeed(seed, true), [startSeed, seed]);
  const onNewCourse = useCallback(() => startSeed(randomSeed(), true), [startSeed]);

  const onCopyLink = useCallback(async () => {
    const url = buildShareUrl(window.location.origin, window.location.pathname, { seed });
    try {
      await navigator.clipboard.writeText(url);
      flashToast('이 코스, 친구한테 던져보세요 — 링크 복사됨.');
    } catch {
      flashToast(url);
    }
  }, [seed, flashToast]);

  const onSaveCard = useCallback(() => {
    const src = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!src || !result) return;
    const W = 1200;
    const H = 675;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    // scene snapshot as background (cover-fit)
    const ar = src.width / src.height;
    let dw = W;
    let dh = W / ar;
    if (dh < H) {
      dh = H;
      dw = H * ar;
    }
    try {
      ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } catch {
      /* tainted / blank — fall back to solid */
      ctx.fillStyle = '#12100d';
      ctx.fillRect(0, 0, W, H);
    }
    // bottom scrim for text legibility
    const grad = ctx.createLinearGradient(0, H * 0.35, 0, H);
    grad.addColorStop(0, 'rgba(8,9,11,0)');
    grad.addColorStop(1, 'rgba(8,9,11,0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ede6d8';
    ctx.font = '900 132px Pretendard, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${result.distance.toLocaleString('en-US')}`, 60, H - 96);
    ctx.font = '700 44px Pretendard, system-ui, sans-serif';
    ctx.fillStyle = '#9a9284';
    ctx.fillText('m 생존', 66, H - 52);
    ctx.font = '700 30px Pretendard, system-ui, sans-serif';
    ctx.fillStyle = '#c97b3c';
    ctx.fillText(`COLOSSUS RUN · 시드 ${seedCode(result.seed)}`, 66, H - 150);
    const a = document.createElement('a');
    a.download = `colossus-run-${result.distance}m.png`;
    a.href = c.toDataURL('image/png');
    a.click();
    flashToast('결과 카드를 저장했어요.');
  }, [result, flashToast]);

  if (phase === 'error') return <ErrorFallback detail={errorDetail} />;

  return (
    <>
      {engineRef.current && phase === 'ready' ? (
        <Scene engine={engineRef.current} quality={quality} />
      ) : null}

      {phase === 'loading' ? <Loading progress={progress} label={loadLabel} /> : null}

      {phase === 'ready' && gameState === 'title' ? (
        <Title seed={seed} best={best} onRun={onRun} onNewSeed={onNewSeed} />
      ) : null}

      {phase === 'ready' && (gameState === 'running' || gameState === 'dying') && engineRef.current ? (
        <HUD engine={engineRef.current} />
      ) : null}

      {phase === 'ready' && gameState === 'gameover' && result ? (
        <ResultCard
          result={result}
          onRetry={onRetry}
          onNewCourse={onNewCourse}
          onCopyLink={onCopyLink}
          onSaveCard={onSaveCard}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#0e0c0a]/95 px-4 py-2 text-sm text-[#ede6d8] shadow-lg">
          {toast}
        </div>
      ) : null}
    </>
  );
}
