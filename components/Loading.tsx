'use client';

/**
 * Themed loader (DESIGN §7.4). Shown while Rapier WASM inits + the first chunks
 * build. Dark, heavy, with a cold cracked-monolith motif — "파수꾼이 깨어나는 중…".
 */
export default function Loading({ progress, label }: { progress: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#08090b] text-[#ede6d8]">
      <div className="relative mb-8 h-20 w-16">
        <div className="absolute inset-0 rounded-full bg-[#b7d6df]/10 blur-2xl" />
        <svg viewBox="0 0 48 60" className="relative h-20 w-16">
          {/* an angular monolith with a cold crack */}
          <polygon points="24,2 40,14 36,56 12,56 8,14" fill="#3a3d42" stroke="#585b60" strokeWidth="1" />
          <g className="origin-center animate-[pulse_2.2s_ease-in-out_infinite]">
            <path d="M24 6 L22 30 L26 34 L23 54" fill="none" stroke="#b7d6df" strokeWidth="1.4" />
            <circle cx="24" cy="30" r="2.4" fill="#cfe6ee" />
          </g>
        </svg>
      </div>
      <p className="mb-4 text-sm font-medium tracking-tight text-[#ede6d8]">{label}</p>
      <div className="h-1 w-56 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#c97b3c] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-[#9a9284]">{pct}%</p>
    </div>
  );
}
