# COLOSSUS RUN

> 도시를 부수며 덮쳐오는 거대 지성체 **파수꾼(WARDEN)** 앞에서 도망치는 3D 서바이벌.
> **카메라가 파수꾼을 정면으로 조망**해 거인이 화면을 가득 채우고, 핵심 위험은 **내리찍는 발** —
> 바닥 그림자로 예고되는 착지 지점을 좌우로 피하며 살아남는다. "나 ○○m 살았다"를 스크린샷으로
> 던지고, 같은 시드 링크로 "이 코스 나보다 더 가봐" 하는 게임.
>
> (원안은 "등 뒤 추격 카메라 + 전방 장애물 회피"였으나 라이브 피드백으로 **반전 카메라 + 발 회피**로
> 전환. 상세는 `docs/PROJECT.md`·`docs/DESIGN.md` 상단 오버라이드 노트 참고.)

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
- `lib/warden.ts` + `lib/render/wardenRig.ts` — 파수꾼 loom + **발 슬램 상태머신**(예측 조준·lunge) + 2-bone 다리 IK(발 슬램 override) + head look-at + 균열 도자기 판·냉광.
- `lib/render/footTelegraph.ts` — 발 착지 예고 바닥 그림자(자연 텔레그래프, 색칠 없음).
- `lib/chaseCamera.ts` — **반전 카메라**(파수꾼 정면 조망, 슬램 시 pull-back/데스캠). OrbitControls 대체.
- `lib/engine.ts` — 임퍼러티브 오케스트레이터(게임 상태머신, 고정 스텝, 파괴 연동).
- `lib/physics/debrisPool.ts` · `lib/fx/*` — meteor-city 파괴 엔진/FX 재활용(Ashen Dusk 재그레이드).
- `components/*` — R3F Canvas + 라이팅 + PostFX + HUD/타이틀/결과카드.

계약: `docs/PROJECT.md`(기획/수치) · `docs/DESIGN.md`(아트 디렉션).
