# COLOSSUS RUN

> 등 뒤에서 도시를 통째로 부수며 쫓아오는 거대 지성체 **파수꾼(WARDEN)** 을, 무너지는 도로를
> 질주하며 뒤도 안 돌아보고 도망치는 3D 추격 서바이벌. "나 ○○m 살았다"를 스크린샷으로
> 단톡방에 던지고, 같은 시드 링크로 "이 코스 나보다 더 가봐" 하는 게임.

무상태 · 클라이언트 100%. Next.js(App Router + TS) + Three.js(R3F) + Rapier.
시드(`?seed=`)로 코스가 결정론적으로 재현된다. 최고 기록/설정은 `localStorage`.

## 조작

| 액션 | 키보드 | 모바일 |
|------|--------|--------|
| 좌우 스티어 | A/D · ←/→ | 좌우 드래그 |
| 점프 | Space · ↑ | 위 스와이프 / 점프 버튼 |
| 슬라이드 | S · ↓ · Ctrl | 아래 스와이프 / 슬라이드 버튼 |
| 대시 | Shift · Space 더블탭 | 대시 버튼 |

## 개발

```bash
npm install          # (또는 meteor-city node_modules 재사용)
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드 (Vercel 과 동일)
npm run lint         # 린트
```

### 검증

```bash
npm run build && npm start -- -p 3178            # 프로덕션 서버
CR_PORT=3178 node test/verify.cjs                # 헤드리스 E2E (Chrome + SwiftShader)
node node_modules/typescript/lib/tsc.js -p test/tsconfig.pure.json && node test/unit.cjs  # 순수 로직 단위 테스트
```

## 아키텍처 (요약)

- `lib/course.ts` — 무한 1D 센터라인(폴리라인, arc-length). 시드 결정론.
- `lib/chunk/*` — 청크 스트리밍(윔도우 로드/언로드), 도로 리본 + 양옆 건물 + 큐레이트 장애물.
- `lib/hero.ts` — kinematic 주인공 컨트롤러(입력 버퍼/코요테/대시).
- `lib/warden.ts` + `lib/render/wardenRig.ts` — 파수꾼 추격 AI(catch-up) + 2-bone 다리 IK + head look-at + 냉광.
- `lib/chaseCamera.ts` — 커스텀 추격 카메라(근접 pull-back 프레이밍/데스캠). OrbitControls 대체.
- `lib/engine.ts` — 임퍼러티브 오케스트레이터(게임 상태머신, 고정 스텝, 파괴 연동).
- `lib/physics/debrisPool.ts` · `lib/fx/*` — meteor-city 파괴 엔진/FX 재활용(Ashen Dusk 재그레이드).
- `components/*` — R3F Canvas + 라이팅 + PostFX + HUD/타이틀/결과카드.

계약: `docs/PROJECT.md`(기획/수치) · `docs/DESIGN.md`(아트 디렉션).
