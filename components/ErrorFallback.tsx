'use client';

/**
 * Fallback for browsers without WebGL / WASM or a hard init failure (DESIGN §7.4).
 * No dead end — explains and points to desktop Chrome/Edge.
 */
export default function ErrorFallback({ detail }: { detail?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#08090b] px-6 text-center text-[#ede6d8]">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#16171a] shadow-lg">
        <svg viewBox="0 0 48 48" className="h-11 w-11">
          <polygon points="24,4 38,14 34,42 14,42 10,14" fill="#3a3d42" stroke="#585b60" strokeWidth="1" />
          <path d="M24 9 L21 40" stroke="#b7d6df" strokeWidth="1.4" fill="none" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold tracking-tight">이 브라우저에선 파수꾼이 안 깨어나요</h1>
      <p className="max-w-sm text-sm leading-relaxed text-[#9a9284]">
        WebGL / WebAssembly 가 필요해요. 데스크탑 크롬이나 엣지에서 열어보세요.
      </p>
      {detail ? <p className="max-w-sm text-xs text-[#6d6a62]">{detail}</p> : null}
    </div>
  );
}
