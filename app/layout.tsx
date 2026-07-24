import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'COLOSSUS RUN — 파수꾼에게 쫓기다',
  description:
    '등 뒤에서 도시를 통째로 부수며 쫓아오는 거대 지성체 파수꾼(WARDEN)을, 무너지는 도로를 질주하며 뒤도 안 돌아보고 도망치는 3D 추격 게임. 같은 시드 링크로 친구에게 이 코스를 던져보세요.',
  openGraph: {
    title: 'COLOSSUS RUN',
    description: '뒤를 안 봐도, 등 뒤에 산(山)만 한 지성체가 있다. 몇 미터나 살아남을 수 있을까?',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#08090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard (DESIGN §7.7) — CDN, system fallback in globals.css */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body>
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
