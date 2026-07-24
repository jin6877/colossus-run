'use client';

/**
 * Death-cam → result card (DESIGN §7.5) — the share heart. Movie-poster framing
 * over the frozen collapse snapshot: giant distance number, seed code, best badge,
 * and the actions that get thrown into a group chat: [같은 코스] (retry same seed,
 * visual priority 1) · [새 코스] · [링크 복사] · [카드 저장]. Copy uses http(s)-only
 * URLs built from our own origin (PROJECT.md §9 hostile-input discipline).
 */
import { seedCode } from '@/lib/share';

export type DeathReason = 'stomp' | 'shockwave' | 'caught';

export interface ResultData {
  distance: number;
  best: number;
  seed: number;
  reason: DeathReason;
  newBest: boolean;
}

const REASON_COPY: Record<DeathReason, string> = {
  stomp: '파수꾼의 발에 짓밟혔다.',
  shockwave: '충격파에 휩쓸렸다.',
  caught: '파수꾼에게 붙잡혔다.',
};

export default function ResultCard({
  result,
  onRetry,
  onNewCourse,
  onCopyLink,
  onSaveCard,
}: {
  result: ResultData;
  onRetry: () => void;
  onNewCourse: () => void;
  onCopyLink: () => void;
  onSaveCard: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-gradient-to-t from-[#08090b]/90 via-[#08090b]/40 to-transparent sm:items-center">
      <div className="w-full max-w-md p-6 sm:p-8">
        <p className="mb-1 text-xs font-medium text-[#9a9284]">{REASON_COPY[result.reason]}</p>
        <div className="flex items-baseline gap-2">
          <span className="tnum text-6xl font-black leading-none tracking-tight text-[#ede6d8] drop-shadow-[0_3px_16px_rgba(0,0,0,0.8)] sm:text-7xl">
            {result.distance.toLocaleString('en-US')}
          </span>
          <span className="text-2xl font-bold text-[#9a9284]">m 생존</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="text-[#9a9284]">
            시드 <span className="tnum ml-1 font-semibold text-[#ede6d8]">{seedCode(result.seed)}</span>
          </span>
          {result.newBest ? (
            <span className="rounded-full bg-[#c97b3c]/20 px-2.5 py-0.5 text-xs font-semibold text-[#c97b3c]">
              최고 기록 갱신 — 여기까지 온 사람 별로 없어요
            </span>
          ) : (
            <span className="text-[#9a9284]">
              최고 <span className="tnum ml-1 font-semibold text-[#c97b3c]">{result.best.toLocaleString('en-US')} m</span>
            </span>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onRetry}
            className="col-span-2 rounded-xl bg-[#c97b3c] px-6 py-3.5 text-base font-bold text-[#1a120a] shadow-lg transition hover:bg-[#d98a49] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c97b3c]/60"
          >
            같은 코스 재도전
          </button>
          <button
            onClick={onNewCourse}
            className="rounded-xl border border-white/[0.1] bg-[#0e0c0a]/50 px-4 py-3 text-sm font-medium text-[#ede6d8] backdrop-blur-sm transition hover:bg-white/5"
          >
            새 코스
          </button>
          <button
            onClick={onCopyLink}
            className="rounded-xl border border-white/[0.1] bg-[#0e0c0a]/50 px-4 py-3 text-sm font-medium text-[#ede6d8] backdrop-blur-sm transition hover:bg-white/5"
          >
            링크 복사
          </button>
          <button
            onClick={onSaveCard}
            className="col-span-2 rounded-xl border border-white/[0.08] bg-transparent px-4 py-2.5 text-xs font-medium text-[#9a9284] transition hover:bg-white/5"
          >
            결과 카드 저장 (PNG)
          </button>
        </div>
      </div>
    </div>
  );
}
