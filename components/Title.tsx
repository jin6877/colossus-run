'use client';

/**
 * Title screen (DESIGN §7.4). Overlaid on the live low-speed preview (the warden
 * looming + slow head look-at behind an idle hero). Seed + best distance shown;
 * [달리기] is the amber primary CTA, [시드 바꾸기] regenerates the course.
 */
import { seedCode } from '@/lib/share';

export default function Title({
  seed,
  best,
  onRun,
  onNewSeed,
}: {
  seed: number;
  best: number;
  onRun: () => void;
  onNewSeed: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-6 sm:p-10">
      <div className="pointer-events-none max-w-lg">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#9a9284]">
          COLOSSUS RUN
        </p>
        <h1 className="text-5xl font-extrabold leading-[0.95] tracking-tight text-[#ede6d8] drop-shadow-[0_3px_16px_rgba(0,0,0,0.8)] sm:text-7xl">
          뒤돌아보지 마.
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[#c9c1b3] sm:text-base">
          도시가 스스로 세운 무언가가 깨어났다. 그것이 부수는 도시를 뚫고, 무너지는
          도로를 앞으로만 질주해라. 얼마나 멀리 갈 수 있지?
        </p>
      </div>

      <div className="pointer-events-auto flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="text-[#9a9284]">
            코스 시드 <span className="tnum ml-1 font-semibold text-[#ede6d8]">{seedCode(seed)}</span>
          </span>
          {best > 0 ? (
            <span className="text-[#9a9284]">
              최고 기록{' '}
              <span className="tnum ml-1 font-semibold text-[#c97b3c]">
                {best.toLocaleString('en-US')} m
              </span>
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onRun}
            className="rounded-xl bg-[#c97b3c] px-8 py-3.5 text-base font-bold text-[#1a120a] shadow-lg transition hover:bg-[#d98a49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c97b3c]/60"
          >
            달리기
          </button>
          <button
            onClick={onNewSeed}
            className="rounded-xl border border-white/[0.1] bg-[#0e0c0a]/40 px-5 py-3.5 text-sm font-medium text-[#ede6d8] backdrop-blur-sm transition hover:bg-white/5"
          >
            시드 바꾸기
          </button>
        </div>

        <p className="text-xs text-[#6d6a62]">
          이동 A/D · ←/→ &nbsp;|&nbsp; 점프 Space · ↑ &nbsp;|&nbsp; 슬라이드 S · ↓ &nbsp;|&nbsp; 대시 Shift · Space×2
        </p>
      </div>
    </div>
  );
}
