# colossus-run

> 3D 추격 서바이벌. 거대한 지성체 **파수꾼(WARDEN)** 에게 쫓기며, 그가 부수는 도시를 뚫고 앞으로만 도망친다.
> 스택: Next.js(App Router + TS) + Three.js(R3F) + Rapier. **무상태 · 클라이언트 100%.**
> 자산 대량 재활용 대상: `c:\dev\project\side-app\meteor-city`.

> ### ⚠️ 코어 오버라이드 (라이브 플레이 피드백, 2026-07-24)
> 사용자 지시로 **핵심 루프를 전환**했다. 아래 원안(등 뒤 추격 카메라 + 전방 장애물 회피)을 다음으로 **대체**한다:
> - **카메라 반전**: 등 뒤 3인칭(전방 주시)이 아니라, **카메라가 주인공 앞에서 파수꾼을 바라본다.** 주인공은 카메라 쪽으로 도망치고, 파수꾼이 화면을 가득 채우며 압도적으로 덮쳐온다. 좌우 입력은 화면 기준으로 뒤집어 매핑(engine에서 steer 부호 반전).
> - **핵심 위험 = 파수꾼의 내리찍는 발**: footfall/IK를 게임 위험으로 승격. 파수꾼은 뒤에서 loom(gap 13m)하다가 **발을 내리찍을 때 앞으로 lunge(gap 6m)** 한다. 착지 지점을 **바닥 그림자로 텔레그래프**(색칠 금지 — 그림자가 곧 죽음) → 슬램(먼지·셰이크·충격파) → 발자국 안에 있으면 압사. 좌우 회피(+충격파는 점프)로 피한다.
> - **전방 장애물 코스 제거**: 붉은 색칠 마커/차량·틈·바 등 큐레이트 전방 장애물은 반전 카메라에서 안 보이므로 전부 제거. 위험은 발 그림자 텔레그래프로만 읽힌다.
> - **유지**: 디테일한 도자기 파수꾼, 파괴 스펙터클(발·경로가 도시를 부숨), Ashen Dusk 톤, 생존거리 점수·결과카드·시드 재현.
>
> 아래 §7(추격 카메라)·§3~§5의 "전방 장애물·등 뒤 카메라" 서술은 이 오버라이드가 우선한다. 나머지(파수꾼 정체성/파괴/스트리밍/톤/무상태)는 유효.

---

## 한 줄 컨셉
등 뒤에서 도시를 통째로 부수며 쫓아오는 거대 지성체를, 무너지는 도로를 질주하며 뒤도 안 돌아보고 도망치는 3D 추격 게임 — "나 4,120m 살았다"를 스크린샷으로 던지고 싶어지는 게임.

## 왜 이거 (탈출 근거)
- **버린 뻔한 방향**: 평평한 무한 러너(Subway Surfers 클론), 배경으로만 존재하는 위협, "장애물 피하고 코인 먹기". 추격자가 그냥 뒤에 붙어있는 장식인 러너.
- **이 컨셉의 뾰족한 각도**: 추격자가 **배경이 아니라 물리적으로 도시를 실시간 파괴하는 주체**다. 그가 방금 지나온 건물이 무너져 내 앞의 장애물이 된다(추격자 = 레벨 생성기). 그리고 **뒤를 볼 필요가 없다** — 앞으로 드리우는 그의 그림자, 발디딤마다 흔들리는 화면, 가까워지면 프레임 위쪽으로 차오르는 거대한 실루엣이 "바로 뒤에 있다"를 말해준다. 이게 이 게임의 카메라 설계 핵심이자 공포 장치다.
- **공유 유발 포인트**: 사용자가 ① **"○○m 생존" 결과 카드**(무너진 도시 배경 캡처)를 남기고 ② **같은 시드(URL)로 "이 코스 나보다 더 가봐"** 하고 단톡방에 던진다. 파수꾼이 타워를 도로 위로 쓰러뜨리며 지나가는 순간의 스크린샷이 "이거 봐"의 트리거.

## 핵심 루프
1. **연다** → 타이틀. 오늘의 시드(또는 공유 시드), 최고 기록 표시. "달리기" 누르면 파수꾼의 첫 발소리와 함께 시작.
2. **질주한다** → 자동 전진(속도는 게임이 관리, 점점 빨라짐). 좌우 스티어로 도로 폭 안에서 차선을 넘나들고, 점프/슬라이드/대시로 잔해·차량·틈·파수꾼의 팔 휘두르기를 회피.
3. **압박받는다** → 파수꾼이 catch-up 으로 거리를 좁힌다. 그림자가 발밑까지 따라오고, 화면 가장자리가 붉게 물들고, 발소리에 카메라가 흔들린다. 아주 가까워지면 카메라가 뒤로 빠지며 위로 틸트 — 파수꾼의 얼굴/상반신이 프레임에 들어온다.
4. **결판** → 실수로 장애물에 걸려 감속하거나 거리가 0이 되면 **붙잡힘 → 데스캠(슬로모 + 3/4 후방 앵글로 파수꾼이 덮치는 컷) → 게임오버**. 생존 거리 = 점수.
5. **다시/공유** → 결과 카드. "같은 시드 재도전 / 새 코스 / 링크 복사". 최고 기록 로컬 갱신.

## MVP 범위
- **포함(v1)**: 스플라인/폴리라인 코스 스트리밍, 절차적 애니메이션 주인공(달리기·점프·슬라이드·대시), 파수꾼 1체(추격 AI + 절차적 IK 보행 + 경로 파괴), 등 뒤 3인칭 추격 카메라(근접 동적 프레이밍·전방 그림자·경고 비네트·발소리 셰이크), meteor-city 파괴 엔진 재활용(복셀 청킹 붕괴 + rubble 베이크), 잔해가 장애물이 되는 게임 연결, catch-up 난이도 곡선, 시드 URL 재현, "○○m 생존" 결과 카드, 무상태, 품질 티어(high/low) + 모바일 대응.
- **명시적 제외(v1 안 함)**: mocap·리그드 GLTF 캐릭터 에셋(전부 절차적), 무기/전투(순수 도망), 멀티플레이·서버·계정·서버 랭킹(로컬 최고 + 시드 공유로 대체), 완전 오픈월드/임의 격자 회전(1D 코스 + 완만한 굽이·분기만), 다수 괴물, 밤낮/날씨, 파괴 가능한 실내, 래그돌 죽음(스크립트 데스캠), look-back 카메라·near-miss 스타일 점수·주인공 스킨(전부 v1.1 이후 폴리시).

## 상태 저장
- [x] **무상태** (Vercel + git 로 끝) / [ ] backend 필요
- **근거**: 코스는 시드로 결정론적 재현 → 서버에 저장할 공유 상태가 없다(URL 자체가 상태). 최고 기록·설정·품질 티어는 `localStorage`. 남의 기록을 내 화면에서 보는 랭킹/방/갤러리 같은 사용자 간 공유 상태가 없으므로 DB 불필요. 외부 API 키 없음. → `scripts/deploy.sh`(Vercel) 경로.
- 저장 키: `cr:best`(최고 거리), `cr:tier`(강제 품질), `cr:prefs`(조작/사운드).

## 화면·상태
| 화면 | 상태 | 내용 |
|------|------|------|
| **로딩** | WASM(Rapier) init + 첫 3청크 빌드 | 프로그레스 + "파수꾼이 깨어나는 중…" 류 카피 |
| **에러** | WebGL 불가 | meteor-city `ErrorFallback` 재활용, 정적 안내 |
| **타이틀** | idle | 시드 표시, 최고 기록, [달리기] [시드 바꾸기]. 배경에 저속 프리뷰(파수꾼 실루엣) |
| **플레이** | running | HUD: 거리(대), 속도, **위험 게이지(proximity)**, 대시 쿨다운. idle 시 HUD 페이드(캡처 청결, meteor-city 패턴 재활용) |
| **위기** | proximity>0.6 | 붉은 비네트 펄스 + 셰이크 강화 (별도 화면 아님, 오버레이) |
| **게임오버** | caught | 데스캠 정지 후 결과 카드: "○○m 생존", 시드, [같은 코스] [새 코스] [링크 복사] [카드 저장] |

## 성공 기준
누군가 결과 카드나 붕괴 스크린샷을 단톡방/커뮤니티에 올리고, 다른 사람이 **같은 시드 링크로 재도전**하면 성공.

---

# 기술 스펙 (developer 착수용)

> 이 게임은 야심작이다. 아래 **§11 빌드 순서**대로 수직 슬라이스(직선 도로 + 달리는 주인공 + 쫓아오는 박스 괴물 + 등 뒤 카메라)부터 세우고, 재미가 확인되면 파괴·스트리밍·연출을 쌓는다. 첫날에 전부 하려 하지 말 것.

## 0. 좌표계 · 단위 · 결정론 규약 (meteor-city 승계)
- **Y-up, 1 unit ≈ 1m.** 지면 `y=0`. meteor-city 상수 승계: `CELL=20`, `ROAD=6`, `GRAVITY=-26`, `FIXED_DT=1/60`.
- **전진 방향** = 코스 스플라인의 접선 `T`(주인공 로컬 -Z). 좌우 = `N = up × T`(로컬 +X = "오른쪽").
- **결정론 필수**: 게임플레이에 영향 주는 모든 난수(코스 굽이, 블록 배치, 장애물, 분기, 파수꾼 코너컷 여부)는 **`hash(seed, chunkIndex)` 기반 `Rng`(meteor-city `lib/rng.ts`)** 에서만 뽑는다. `Math.random()` 은 **순수 시각 FX(먼지·파편 튐)에만** 허용 — meteor-city 가 지키는 규율 그대로. 이래야 시드 = 코스가 프레임레이트·기기 무관하게 재현된다.
- **고정 timestep 게임 루프**: 물리/주인공/파수꾼 이동은 `FixedStepper`(meteor-city `lib/physics/world.ts`)로 1/60 고정 스텝, 렌더는 분리. 입력 반응성·재현성 확보.

## 1. 코어 루프 & 게임플레이 상태
```
GameState = 'title' | 'running' | 'dying' | 'gameover'
```
- **자동 전진**: 주인공은 코스 arc-length `s_player` 를 스스로 증가시킨다. 속도 `v` 는 게임 관리(§8). 플레이어는 **방향이 아니라 회피/차선**만 조작.
- **캐치 판정**: `gap = s_player - s_warden`(m). `gap ≤ catchGap(3m)` 이 지속되거나, 주인공이 치명 장애물에 걸려 완전 정지 → `dying`(데스캠) → `gameover`.
- **스코어**: `distance = floor(s_player)` m. (옵션) 근접 회피·클린 대시 스타일 보너스는 v1.1.

## 2. 조작 스킴 ("고퀄" 반응성)
| 액션 | 키보드 | 마우스 | 모바일 | 효과 |
|------|--------|--------|--------|------|
| 좌우 스티어 | A/D · ←/→ | 마우스 X(옵션) | 좌우 드래그/기울임 | 도로 폭 내 lateralOffset 연속 이동, 몸 기울임(lean) |
| 점프 | Space | — | 위 스와이프 | 저잔해·차량·틈 넘기 |
| 슬라이드 | S · Ctrl | — | 아래 스와이프 | 간판·쓰러진 보·파수꾼 팔 밑 통과 |
| 대시 | Shift · Space 더블탭 | — | 우측 홀드 버튼 | 짧은 가속 버스트(쿨다운, 스태미나 소모) — 넓은 틈 돌파 |
- **게임필 디테일(필수)**: 입력 버퍼링(착지 ~120ms 전 점프 예약), 코요테 타임(~100ms), 스티어는 관성 있되 스냅. 모든 입력은 고정 스텝에서 소비.
- **모바일**: 한 엄지 플레이 가능하게. 스와이프 4방향 + 우측 홀드 대시. 큰 터치 타깃. 라이프사이클: `pointer` 이벤트 통일(meteor-city Scene 의 pointer 처리 참고).
- **HUD**: 거리/속도/위험게이지/대시쿨. meteor-city HUD 의 idle auto-fade(§App.tsx `hudDim`) 재활용 — 캡처 청결.

## 3. 주인공 (절차적 애니메이션 — 판정)
**판정: 리그드 GLTF 대신 절차적 애니메이션 박스/캡슐 러너.**
- **근거**: mocap/GLTF 에셋 없음 + meteor-city 의 faceted/디오라마 아트와 톤 일치 + 카메라상 주인공이 작게 보여 고밀도 불필요. 절차 사이클이 자산 파이프라인 0으로 "고퀄 실루엣 + 모션"을 준다.
- **구성**: 몇 개의 박스/캡슐 세그먼트(몸통·머리·2팔·2다리)로 이루어진 스타일라이즈드 러너. 절차적 달리기 사이클:
  - 다리/팔 = 위상 시계(phase clock, 속도 비례) 기반 sine 스윙. 스티어 시 몸통 roll(lean-into-turn), 슬라이드 시 tuck, 점프 시 curl.
  - 발 IK 지면 접촉(간단 raycast, 옵션) — 안 하면 사이클만으로도 충분.
- **컨트롤러 판정: 커스텀 kinematic 컨트롤러**(Rapier 동적 바디 아님).
  - 상태: `{ s, lateralOffset, yJump, vJump, phase, grounded, sliding, dashCd, stamina }`.
  - 월드 위치 = `P(s) + lateralOffset·N(s) + up·yJump`. `lateralOffset ∈ [-halfWidth+margin, +halfWidth-margin]`.
  - **충돌은 Rapier 잔해 수백 개와 안 붙인다** — 게임 충돌은 §5 의 **큐레이트된 장애물 볼륨 집합**(AABB/캡슐 간이 검사)과만. 이래야 조작이 크리스프하고 난이도가 "설계"된다. (Rapier 잔해는 스펙터클/시각용.)
  - 장애물 판정 결과: `graze`(스침 → 속도 페널티 + 스텀블 애니메이션), `block`(정면 정지 → dying), `gap`(틈에 빠짐 → dying).

## 4. 파수꾼(WARDEN) — 오리지널 크리처
> **저작권 안전**: 진격의 거인의 근육질 거인도, 특정 외계인도 아니다. 아래는 새로 만든 고유 크리처. 이름·외형·설정 오리지널.

### 4.1 정체성
- **이름**: 파수꾼 / codename **WARDEN**. 도시가 스스로 세운 무언가가 깨어나, 자신을 만든 것들을 되찾으러 다닌다 — 특히 너를. 맹목적으로 날뛰지 않고 **지켜본다**.
- **외형(오리지널)**: 높이 **~45–60m**(대부분의 건물을 내려다보되 다운타운 타워 사이를 헤집는 스케일). 비정상적으로 긴 사지의 gaunt 실루엣. **눈 없는 매끈한 각진 머리**가 **항상 주인공을 향해 돈다**(= "지성"의 핵심 큐, head IK look-at). 재잿빛 도자기 같은 피부에 균열, 균열 사이로 차가운 빛이 샌다(emissive). **flat-shading + faceted** → meteor-city debris/도시 머티리얼과 톤 일치.
- **무브셋 톤**: 포효하며 날뛰는 짐승이 아니라, 느리지만 불가피한 **의도된 추격**. 성큼성큼 loping, 가끔 손을 앞으로 짚어(knuckle-plant) 거리를 좁힘.

### 4.2 애니메이션 (절차적 IK — 판정)
**판정: 절차적 IK 보행(리그드 클립 아님).** 브라우저에서 자산 없이 "무게감/위협감"을 내는 현실적 선택.
- **몸통**: 박스/캡슐 세그먼트로 조립, 절차 스킨.
- **다리 2개**: 각 2-bone IK 체인(hip→knee→foot). 속도 비례 phase clock 이 보폭/케이던스 결정. 발 목표는 **지면 또는 rubble/건물 윗면으로 raycast** → 파수꾼이 잔해를 밟고 넘는다.
- **발디딤 이벤트(footfall)**: 발이 지면에 꽂히는 순간마다 → ① 근거리면 `CameraShake.add()`(meteor-city `lib/fx/cameraShake.ts`) 트라우마 주입(거리 비례) ② 발밑 반경 파괴 펄스(§5) ③ 먼지 FX(meteor-city `lib/fx/impact.ts`).
- **팔 2개**: loping 중 간헐 knuckle-plant(추가 파괴). 근접 시 **텔레그래프된 sweep/lunge 공격** — 주인공은 슬라이드/대시로 회피.
- **머리**: 항상 주인공 IK 추적(약간 예측 리드). 이것 하나가 "지성" 체감의 8할.
- **척추**: gait 에 맞춘 bob/sway.

### 4.3 추격 AI
- **이동**: 파수꾼도 같은 코스 스플라인 arc-length `s_warden` 을 따라간다(항상 `s_warden < s_player`).
- **catch-up 러버밴드**: 목표 간격 `G*`.
  - `gap > G*`(주인공이 앞섬) → 파수꾼 가속(상한까지).
  - `gap < G*`(붙음) → 살짝 감속해 회복 여지를 주되, **하한 속도**가 있어 절대 멈추지 않음.
  - `G*` 는 거리 진행에 따라 서서히 축소(§8) → 세계가 점점 무서워진다.
- **"지성" 행동(값싸고 임팩트 큼)**:
  - **코너컷**: 코스가 굽는(bend/fork) 구간에서 가끔 곡선을 가로질러(chord) 블록을 정면으로 뚫고 질러가 거리를 벌린다 — 텔레그래프 후. 시각적으로 "머리 좋게" 보이는 최고 효율 연출.
  - **예측 조준**: 주인공의 현재 속도로 미래 위치를 예측해 그쪽으로 몸을 튼다.
  - **대시 반응**: 주인공이 대시하면 파수꾼도 순간 surge.
  - **분기 선택**: fork 에서 주인공이 택한(또는 더 짧은) 브랜치로 따라온다.
- **캐치**: `gap ≤ catchGap` 지속 or 주인공 완전 정지가 사거리 내 → grab → 데스캠.
- **구현 메모**: 파수꾼도 **kinematic 구동**(동적 바디 불필요). 파괴는 몸/발 위치에서 §5 를 호출하는 방식이라, 파수꾼 자체 콜라이더는 시각/근접판정용 캡슐 하나로 충분.

## 5. 환경 파괴 (추격 연동) — meteor-city 엔진 재활용
- **엔진 재활용**: `lib/physics/debrisPool.ts`(`DebrisSystem`)를 **거의 그대로**. `fractureBuilding(center, size, color, impact, impulse, hotColor, jitter, desired)` = 복셀 청킹 + top-to-bottom progressive collapse(pancaking) + active pool cap + rubble 링버퍼 bake. `collapseToRubble`(먼 오버플로), `spawnFlyingChunk`(나무/차 튐), `treeStump`. `COLLAPSE`/`FIRE`/`SMOKE` 상수(meteor-city `lib/constants.ts`)와 `FXManager`(`lib/fx/impact.ts`) 그대로.
- **핵심 전환**: meteor-city 는 **운석 임팩트 1점**에서 파괴를 호출한다. colossus-run 은 **움직이는 파괴원(파수꾼)** 이 매 프레임/발디딤마다 자기 위치를 `impact` 로 넘겨 호출한다. 즉 "떨어지는 운석" → "걸어오는 괴물"로 파괴 트리거만 교체.
- **성능 스로틀(필수)**:
  - 파괴 대상은 **파수꾼 반경 `R_destroy`(≈40m) 안 + 로드된 청크 내** 건물만.
  - **초당 fracture 상한**(`wardenFractureRate`, 티어별): 넘치면 `collapseToRubble`(정적)로 처리. active 파편은 `activeCap`(high 320 / low 120)이 하드 실링.
  - rubble 링버퍼가 잔해를 유한 비용으로 유지(meteor-city 그대로). 청크 언로드 시 그 영역 rubble/active 정리.
- **게임적 연결(이 게임의 심장)**: 파수꾼이 만든 잔해 중 **주인공 차선 근처에 안착한 rubble 더미 → "blocking 장애물 볼륨"으로 승격**(§3 충돌 대상에 추가). 승격 개수 상한, 뒤로 지나가면 despawn. → *그가 부순 것이 곧 내 앞의 장애물*. 
- **차량/나무**: meteor-city `AgentSystem`(`lib/agents.ts`) 재활용 — 도로 위 차량은 dodge 장애물, 파수꾼 근처 차량은 `reactToImpact()`로 튕겨나감(파수꾼 위치로 호출). 격자 레인 로직은 코스 스트립 레인으로 축소 각색.

## 6. 씬 스트리밍 (청크 로드/언로드) — meteor-city 대비 구조 변경
> meteor-city 는 유한 `gridN×gridN` 도시를 **한 번에 통째로** 생성한다. colossus-run 은 앞으로 무한히 이어지는 코스라 **1D 스트리밍**이 필요 — 이게 가장 큰 구조적 신규 작업.

- **코스 표현: 폴리라인 센터라인(권장) / Catmull-Rom 스무딩(폴리시 옵션)**.
  - 노드 간격 ≈ 청크 길이(120m). 각 노드는 시드 파생 lateral offset 로 **완만한 굽이**(노드당 heading 변화 ≤ ~22°, 카메라·스트리밍 안정). 
  - arc-length `s` 파라미터화. 프레임(s): 위치 `P(s)`, 접선 `T(s)`(전방), 법선 `N(s)=up×T`(좌우).
- **청크 = arc-length 스팬**(예 120m). 콘텐츠는 **`hash(seed, chunkIndex)` 로만** 결정(프레임레이트·경로 무관 → 재현). 각 청크가 빌드하는 것:
  - 코스 스트립(도로+인도) 메시, **양옆 블록 건물**(meteor-city archetype/family/색 jitter/window 로직을 **격자 대신 스트립 배치**로 각색), 나무(instanced), 배치 장애물·크로스스트리트 틈·set-piece.
  - **머티리얼 family 병합**(meteor-city `buildCityMeshes.ts`: family당 1머시 + 지붕 = ~7 draw call)을 **청크 단위로** 적용. 정적 Rapier 콜라이더도 청크 단위 add(`addCityColliders` 각색).
- **윈도우**: `[i-1 .. i+4]` 로드(뒤 1 = 파수꾼/후방 그림자용, 앞 ~4 = ~480m 가시). 청크 경계 통과 시 `i+5` 생성, `i-2` dispose(메시 dispose + 콜라이더 remove + 해당 영역 debris 정리). meteor-city `Engine.setCity`/`dispose` 의 teardown 패턴 참고.
- **주행 폭**: 달릴 수 있는 대로(runnable avenue) 폭 **~24–30m**(멀티 레인, 좌우 회피 여지) + 인도 + 밀집 블록. (meteor-city ROAD=6 은 한 레인 감각 → 대로는 그보다 넓게.)
- **분기(fork)**: fork 노드에서 센터라인이 둘로 갈렸다가 재합류(각 브랜치 다른 장애물). 주인공 lateralOffset 부호로 커밋. 브랜치 콘텐츠도 `hash(seed, chunkIndex, branchId)` 로 결정론.
- **데이터 스케치**(가이드):
```ts
interface CoursePoint { p: Vec3; tangent: Vec3; normal: Vec3; halfWidth: number; }
interface Chunk {
  index: number; s0: number; s1: number;
  group: THREE.Group;                 // family-merged meshes + trees + road
  colliders: StaticColliders;         // per-chunk Rapier static (meteor-city 각색)
  obstacles: Obstacle[];              // 큐레이트된 게임 충돌 볼륨
  buildings: BuildingInfo[];          // 파수꾼 파괴 대상 (alive 플래그)
  dispose(): void;
}
```

## 7. 카메라 (사용자 최대 고민 — 확정 & 수치화)
> **확정 방향**: 주인공 등 뒤 3인칭, 전방(진행방향)을 본다. 괴물은 거대하므로 가까워질수록 **프레임 위/뒤로 차오르고**, 그림자·셰이크·비네트가 존재감을 주어 **뒤를 안 봐도 된다**.

### 7.1 기본 리그 (far, proximity p=0)
- 타깃 = 주인공 머리(≈1.7m). 카메라 오프셋(주인공 로컬 프레임 기준):
  - **뒤로 `distanceBack = 6.5m`**, **높이 `height = 3.0m`**, **오버숄더 lateral `shoulder = +0.9m`**(주인공을 화면 중앙에서 살짝 왼쪽에 두고, 전방 장애물 시야 확보).
  - **피치 `-7°`**(약간 내려봄 → 도로/전방 장애물 가독), **FOV `60°`** 기본.
  - **look-at** = 주인공머리 + `T·4`(4m 전방) + `up·0.2` + `N·steer·1.5`(스티어 방향으로 약간 리드 → 회피 예측).
- **속도 FOV**: `fov += (v - v0)/(vmax - v0) · 8`(빠를수록 넓어져 속도감). 

### 7.2 근접 동적 프레이밍 (공포 연출)
- `gap` 로 proximity 계산: `p = clamp((farGap - gap)/(farGap - nearGap), 0, 1)`  (`farGap=55m`, `nearGap=8m`, `catchGap=3m`).
- p 로 리그 파라미터 **보간**:
  | 파라미터 | p=0 (far) | p=1 (near) |
  |---|---|---|
  | distanceBack | 6.5m | **11m** (뒤로 빠짐) |
  | height | 3.0m | **5.5m** |
  | pitch | -7° | **+5°** (위로 틸트 → 파수꾼 얼굴/상반신이 프레임 상단 뒤로) |
  | fov | 60° | **76°** |
- → 매우 근접하면 카메라가 뒤로 빠지고 위를 향해, 주인공 뒤 **파수꾼의 머리/상반신이 화면 위쪽 1/3을 채우는** 공포 프레이밍.

### 7.3 뒤 안 봐도 되는 위협 큐 (전부 diegetic)
- **전방 그림자(핵심 장치)**: **chase-relative key light** — 태양을 월드 고정이 아니라 **주인공 기준 뒤-위(`-T` 방향 + up)** 에 두어, 주인공보다 더 뒤의 파수꾼이 **앞으로 긴 그림자를 드리운다**. 가까워질수록 그 그림자가 주인공 발밑을 덮친다 = "바로 뒤" 큐. (meteor-city 고정 태양과의 **의도적 차이** — 그림자 프러스텀은 로드 윈도우 추종.)
- **경고 비네트**: `p>0.6` 부터 화면 가장자리 붉은 펄스, 세기 `(p-0.6)/0.4`, **발소리 케이던스로 맥동**. meteor-city `PostFX`(vignette) 재활용.
- **발소리 셰이크**: 파수꾼 footfall 마다 `CameraShake.add(∝ p)`. 근접 시 저주파 sway 추가. (meteor-city cameraShake 그대로 — controls 이후 적용 규약 없이, 우리는 커스텀 카메라라 update 말미에 offset 합산.)
- **look-back(옵션 v1.1)**: 키 홀드/버튼로 카메라 ~160° 글랜스(1s, 자동 복귀). 전방 시야를 내주는 리스크/리워드.

### 7.4 스무딩 (지터 방지 — 필수)
- 프레임레이트 독립 지수 스무딩: `a = 1 - exp(-dt/τ)`.
  - 위치 `τ_pos = 0.14s`(단, `p>0.85` 극근접 pull-back 연출 땐 `τ=0.06s` 로 스냅), 회전 `τ_rot = 0.10s`.
  - 스티어에 따른 lateral 추종은 더 빠르게(반응성). 
- **데스캠**: `dying` 진입 시 짧은 슬로모(timeScale↓, meteor-city `SLOMO_SCALE` 참고) + 카메라가 3/4 후방 앵글로 스윙 → 파수꾼 손/얼굴이 덮치는 컷.

## 8. 난이도 · 긴장 곡선
- **속도 램프**: `v(dist) = v0 + k·dist`, cap. `v0≈14 m/s`, `vmax≈34 m/s`(빠르고 짜릿). k 완만.
- **간격 축소**: `G*` 는 `dist` 증가에 따라 `55m → 28m` 로 서서히 축소(세계가 점점 조여옴).
- **밀도 증가**: 장애물·틈 빈도 증가, 대로가 주기적으로 **좁아지는 pinch point**(정밀 회피 강제), 강제 슬라이드/점프 구간 증가.
- **set-piece 비트**(시드 결정론, ~매 N m): 무너지는 고가도로, 도로 위로 쓰러지는 타워(그 사이를 관통), 광장 fork. "이거 봐" 스크린샷 소재.
- **러버밴드 균형**: catch-up 이 항상 긴장을 중앙에 두되 공정. pinch 사이 **숨돌리는 직선**을 넣어 단조로움 방지 — "뻔한 무한러너로 죽지 않게".

## 9. 점수 · 공유 · 무상태
- **점수** = 생존 거리(m). (옵션 스타일 보너스 v1.1.)
- **시드 URL 재현**: `?seed=` 로 정확히 같은 코스. meteor-city `lib/share.ts` 의 `parseSeed`(정수 파싱 + range clamp), `readShareState`, `buildShareUrl`, `randomSeed` **재활용**(운석 type/size 파라미터는 제거, seed 만; 옵션 cosmetic skin 파라미터 추가 가능). 모든 외부 입력은 hostile 취급(화이트리스트/클램프) — meteor-city 규율 승계.
- **결과 카드**: 사망 시 `distance / seed / 붕괴 배경 스냅샷` 카드. canvas → PNG 또는 스타일 DOM → 이미지. meteor-city 의 클립보드 복사 + 토스트 패턴 재활용("이 코스, 친구한테 던져보세요 — 링크 복사됨").
- **무상태 확정**: 서버 0. `localStorage`: `cr:best`, `cr:tier`, `cr:prefs`.

## 10. 성능 예산
- **목표 fps**: high 60 / low 30–45.
- **품질 티어**: meteor-city `lib/quality.ts`(GPU 문자열 + 모바일 감지 → high/low) **재활용 + 필드 추가**:
```ts
// 추가 필드 (기존 activeCap/rubbleCap/chunks*/dpr/shadow/postFX 유지)
streamAhead: number;        // 로드 청크 수 (high 5 / low 3)
wardenFractureRate: number; // 초당 fracture 상한 (high / low)
obstaclePromoteCap: number; // rubble→장애물 승격 상한
proceduralBoneQuality: 'full' | 'lite'; // 파수꾼 IK 디테일
```
- **draw call**: 청크당 ~7(family+지붕) + 도로 + 나무(instanced) ×~5청크 ≈ 정적 <60 + debris instanced pool + 파수꾼(~1–2) + 주인공(1). 여유.
- **물리**: 로드 청크 콜라이더 + active debris cap 만. 주인공/파수꾼 kinematic(저비용). `FixedStepper` 재활용.
- **파괴 스로틀**: §5 의 반경 + 초당 상한 + active/rubble cap. 청크 언로드 시 정리.
- **PostFX**: meteor-city `PostFX`(bloom/AO/vignette/tiltShift/CA) 재활용, 티어별 토글. AO(N8AO)는 low 에서 first-drop.

## 11. 빌드 순서 (수직 슬라이스 우선 — developer 권장 마일스톤)
1. **M0 재미 검증(핵심)**: 직선 도로(스트리밍 없이 긴 스트립 하나) + 절차 달리기 주인공 + 좌우/점프/슬라이드 + **등 뒤 추격 카메라(§7.1)** + 박스 괴물이 등 뒤에서 catch-up. *여기서 "도망치는 맛"이 안 나면 나머지는 무의미* — 카메라/조작 튜닝에 집중.
2. **M1 파수꾼 절차 IK**: 2-bone 다리 IK + footfall 셰이크 + head look-at(지성 큐). 박스 괴물 → 파수꾼 실루엣.
3. **M2 파괴 연동**: meteor-city `DebrisSystem` 이식, 파수꾼 위치서 `fractureBuilding` 호출, rubble→장애물 승격.
4. **M3 스트리밍**: 폴리라인 코스 + 청크 로드/언로드, family-merge 청크 빌드.
5. **M4 근접 동적 프레이밍 + 위협 큐(§7.2–7.3)**: 전방 그림자, 비네트, pull-back/틸트, 데스캠.
6. **M5 난이도 곡선 + set-piece + fork**.
7. **M6 결과 카드 + 시드 공유 + 타이틀/게임오버 + 품질 티어 + 모바일**.
8. **M7 폴리시**: FX(먼지/불/연기 meteor-city 재활용), 사운드(발소리/붕괴/바람), look-back·스타일 점수(옵션).

---

## 부록 A. meteor-city 재활용 판정 맵
경로: `c:\dev\project\side-app\meteor-city\`

| 자산 | 파일 | 판정 | 비고 |
|------|------|------|------|
| 시드 PRNG | `lib/rng.ts` | **그대로** | `hash(seed, chunkIndex)` 로 청크 결정론 |
| 시드/URL 공유 | `lib/share.ts` | **각색** | seed 검증/URL 재활용, 운석 type/size 제거 |
| 품질 티어 | `lib/quality.ts` | **각색** | 필드 추가(§10) |
| 물리 월드·고정스텝 | `lib/physics/world.ts` | **각색** | `makeWorld`/`FixedStepper` 그대로, `addCityColliders`→청크 단위 |
| **파괴 엔진** | `lib/physics/debrisPool.ts` | **거의 그대로** | 복셀청킹+progressive collapse+rubble bake. 트리거만 운석→파수꾼 |
| 파괴 상수 | `lib/constants.ts`(`COLLAPSE`/`FIRE`/`SMOKE`/`FAMILY`) | **그대로/각색** | 팔레트·붕괴 튜닝 승계, DESIGN 단계서 조정 |
| 화염/연기/먼지 FX | `lib/fx/impact.ts`(`FXManager`) | **그대로** | footfall/붕괴 먼지 |
| 카메라 셰이크 | `lib/fx/cameraShake.ts` | **그대로** | 커스텀 카메라 update 말미에 offset 합산 |
| 차량/보행자 | `lib/agents.ts`(`AgentSystem`) | **각색** | 격자→코스 스트립 레인, dodge 장애물화 |
| 건물 생성 로직 | `lib/city/generateCity.ts` | **부분 각색** | archetype/family/색jitter/window 는 재활용, **격자 배치→청크 스트립 배치**로 교체 |
| 건물 메시 병합 | `lib/city/buildCityMeshes.ts` | **각색** | family-merge(~7 draw call) 기법을 청크 단위로 |
| 임퍼러티브 엔진 골격 | `lib/engine.ts` | **패턴 참고** | React 밖 orchestrator·update(delta,camera)·setCity/dispose teardown 패턴 계승, 운석 로직→추격/파괴/스트리밍으로 대체 |
| R3F 통합 | `components/{Scene,EngineRunner,PostFX,HUD,Loading,ErrorFallback,App}.tsx` | **패턴 참고/일부 재활용** | Canvas+lighting+`<primitive object={engine.root}>`+useFrame priority 구조 계승. **`OrbitControls`는 커스텀 추격 카메라로 교체**(핵심 차이). ErrorFallback/Loading/HUD idle-fade 재활용 |

## 부록 B. 신규 작성(재활용 불가)
- 주인공 캐릭터(절차 애니메이션 러너 + kinematic 컨트롤러 + 입력 버퍼/코요테)
- 파수꾼(절차 IK 보행 + footfall 이벤트 + head look-at + 추격 AI/catch-up/코너컷 + sweep 공격)
- **추격 카메라**(§7 전체 — 이 게임의 서명이자 사용자 최대 고민 해소)
- **코스 스트리밍**(폴리라인 센터라인 + arc-length 프레임 + 청크 로드/언로드 + fork)
- 게임 루프/상태머신(title/running/dying/gameover), 난이도 곡선, rubble→장애물 승격, 결과 카드
- 스택 추가: `three`/`@react-three/fiber`/`@react-three/drei`/`@react-three/postprocessing`/`@dimforge/rapier3d-compat` (meteor-city `package.json` 버전 승계)
