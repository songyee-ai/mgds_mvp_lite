# 라이트 버전 구현 상태

- 갱신: 2026-09-13
- 배포: **https://mgds-mvp-lite.vercel.app**
- 저장소: `songyee-ai/mgds_mvp_lite` (public)
- 마지막 커밋: `6ebece5` 자동 백업이 막혀도 기록이 남게

> **이 파일만 읽으면 이어서 작업할 수 있어야 합니다.** 여기 있는 것은 지금
> 지켜야 하는 규칙과 살아 있는 함정입니다.

---

## 1. 이게 무엇인가

`C:\airrel_work\MGDS\mgds_mvp` (본 MVP, 33개 단위 중 U11까지)에서 **동작하는
부분만 골라 완결시킨 것**입니다. 데이터 계층과 도메인 함수는 본 MVP 와 같고
화면만 여섯 개로 줄였습니다.

**본 MVP 는 읽기만 하고 고치지 않습니다.** 나중에 그쪽을 이어서 할 예정입니다.

```
C:\airrel_work\MGDS\
├─ MORE_GOOD_DAYS_CONTEXT.md    ┐
├─ MORE_GOOD_DAYS_PRD.md        │ 명세 4종. 저장소 밖, 커밋되지 않음
├─ MORE_GOOD_DAYS_TECH_SPEC.md  │
├─ MORE_GOOD_DAYS_WORK_UNITS.md ┘
├─ mgds_mvp\        ← 본 MVP. 건드리지 않음
└─ mgds_mvp_lite\   ← 이 저장소
```

## 2. 화면 여섯 개 — 전부 동작합니다

```
/                관문. 남아 있는 데이터로 갈 곳을 정한다 (app/RootGate)
/intro           인트로 3장. 움직이는 그림. 건너뛸 수 있다
/pet/new         아이 등록. 이름과 나이만 있으면 시작
/welcome         마무리 1장 + 의료 고지 1회. 건너뛸 수 없다
/today           홈. 사진 · 함께한 N일 · 이번 주 좋은 날 · 점 일곱 개
/today/:date     기록. 카드 5장, 다섯 번 누르면 저장까지
/pet/backup      내보내기 · 가져오기
```

개발 서버에서만: `/dev/ui` `/dev/seed` `/dev/state`.
**프로덕션 번들에 없습니다** — 배포본에서 문자열 0건을 확인했습니다.

## 3. 작업 방법

```bash
npm install
npm run dev          # http://localhost:5174
```

| 명령 | |
|---|---|
| `npm run typecheck` | 타입 검사 |
| `npm test` | 단위 테스트 350건 |
| `npm run test:coverage` | 도메인 커버리지 100% 미만이면 실패 |
| `npm run lint:principles` | **원칙 검사 6종** |
| `npm run build` | 타입 검사 → 빌드 → 초기 JS 예산(gzip 150kB) |

`main` 에 **직접 push 해도 됩니다.** 다만 룰셋에 CI 필수 상태 검사
(`test · lint:principles · build`)가 걸려 있고 저장소 admin 만 우회합니다.

> **CI 잡 이름을 바꾸지 마세요.** GitHub 이 보고하는 검사 이름은 워크플로
> 이름이 아니라 **잡 이름**이고, 그 문자열이 룰셋의 필수 검사 이름입니다.
> 바꾸면 `main` 이 잠깁니다.

## 4. 고치기 전에 알아야 하는 것

### 문구는 `src/copy/ko.ts` 하나에만

화면 코드에 한글을 적으면 `lint:hangul` 이 막습니다. 영문이라도 **화면에
나가는 글자**면 여기로 옵니다 (로고 `alt` 도 `copy.common.appName`).

**⚠️ 인트로 3장 문구가 `CONTEXT 5-2` 와 다릅니다.** 2026-09-10 사용자
개정안이고 **정본은 `copy/ko.ts`** 입니다. CONTEXT 는 저장소 밖이라 아직
못 고쳤습니다. 문자 단위 일치는 `tests/copy-intro.test.ts` 가 붙잡습니다.

3장의 `남은 날을 세는 앱이 아니에요.` 는 금지어 "남은 날"을 부정문으로
담고 있어 `scripts/lint-copy.mjs` 의 `ALLOWED` 에 **그 문장 전체**를
예외로 두었습니다. 한 글자만 고쳐도 예외가 풀립니다.

### 색은 `src/ui/tokens.css` 하나에만

`lint:color` 가 다른 CSS 의 하드코딩 색을 막습니다. **`.tsx` 는 검사하지
않으므로** SVG 등에 `fill="#..."` 을 쓰면 구멍이 납니다 — 클래스로 빼세요.

팔레트에 빨강이 없습니다. 상태 표시에 빨강을 쓸 방법이 구조적으로
없습니다 (PRD 원칙 P6).

### 레이아웃의 깨지기 쉬운 상수 — **여기가 가장 위험합니다**

CSS 가 자기 폭·높이를 읽을 수 없어 손으로 계산한 식이 셋 있습니다.
**하나를 바꾸면 나머지도 바꿔야 합니다.**

| 곳 | 식 | 무엇에 묶여 있나 |
|---|---|---|
| `ui/tokens.css` | `--shell-header: calc(var(--logo-w) / 1.866)` | 로고 원본 비율 1342×719 |
| `intro.module.css` `.page` | `height: calc(100dvh - 2rem - var(--shell-header) - 1rem)` | 셸 여백 · 머리줄 · `.header` 의 `margin-bottom` |
| `intro.module.css` `.artFrame` | `max-height: min(폭×1.25, 100dvh - 2rem - 머리줄 - 1rem - --intro-below-art)` | 위와 같음 + 셸 `max-width` 30rem |
| `welcome.module.css` `.page` | `min-height: calc(100dvh - 2rem - var(--shell-header) - 1rem)` | 위와 같음 |

**로고 크기만 바꾸는 것은 안전합니다** — `--logo-w` 한 줄이면 나머지가
따라옵니다. 위험한 것은 셸의 여백, `.header` 의 `margin-bottom`,
버튼줄 높이(84px), 셸 `max-width` 를 바꾸는 경우입니다.

### 하루의 경계는 04:00

밤 11시 기록과 새벽 2시 기록은 **같은 날**입니다. 바꿀 곳은
`src/domain/dates.ts` 의 `NIGHT_CUTOFF_HOUR` 하나입니다.

## 5. 이미 밟은 함정 — 다시 밟지 마세요

- **grid 의 `1fr` 은 `min-height` 로 풀리지 않습니다.** 컨테이너 높이가
  `auto` 로 남아 `1fr` 이 내용 크기로 떨어집니다. 그림 칸이 0px 이 되고
  185px 이 넘쳤습니다. → `height` 를 줘야 합니다.
- **`height: 100%` 는 grid/flex 자식에서 해소되지 않습니다.** 칸은 422px
  인데 SVG 가 195px 이었습니다. → 절대 위치로 채웁니다.
- **`aspect-ratio` + `max-width` 로는 정사각이 안 됩니다.** 높이가 확정값이면
  폭이 잘려도 높이는 안 돌아옵니다 (343×392가 나왔습니다).
- **grid 의 첫 아이는 첫 열에 놓입니다.** 로고가 중앙에서 124px 왼쪽에
  섰습니다. 가운데 열을 명시해야 합니다.
- **flex 는 자동 여백을 `flex-grow` 보다 먼저 해소합니다.** `margin-top: auto`
  가 남는 세로를 다 먹어 그림이 안 자랐습니다.
- **React 는 `muted` 를 어트리뷰트로 남기지 않습니다.** iOS Safari 가 자동
  재생 자격을 어트리뷰트로 보는 경로가 있어 `setAttribute('muted','')` 를
  함께 합니다.
- **iOS 는 `preload="auto"` 를 무시합니다.** 자동 재생까지 막히면 프레임이
  한 장도 디코딩되지 않아 화면이 빕니다 → 포스터 이미지가 그 답입니다.
- **iOS 의 「동작 줄이기」가 `prefers-reduced-motion` 입니다.** 흔하게 켜져
  있습니다. 정지 화면으로 나오는 것은 고장이 아닙니다.

## 6. 인트로 미디어

960×960 · 5.04초 · 24fps · H.264 · 무음. 239 / 193 / 364 KB (합 796KB).
포스터 WebP 25 / 19 / 37 KB.

- `prefers-reduced-motion` 이면 **영상을 아예 받지 않고** 포스터만 그립니다.
- 자동 재생이 막히면 포스터가 남고, **화면을 한 번 만지면** 살아납니다.
- 다음 장을 미리 받아 둡니다 (움직임 줄이기면 그것도 건너뜁니다).

재인코딩 명령과 근거는 `src/features/intro/IntroMedia.tsx` 주석에 있습니다.

**잘림 안전 영역** — 정사각 영상을 정사각이 아닌 칸에 `cover` 로 넣습니다.
요즘 휴대폰 좌우 각 6~10%, 짧은 화면 위아래 각 10%. **사방 12% 를 비우면
안전합니다.** 표는 `intro.module.css` 의 `.artFrame` 주석에.

## 7. 열린 항목

### 자동 백업 — 막혀도 데이터는 지켜집니다

**자동 백업이 실기기에서 정말 파일을 만드는지는 여전히 확인되지
않았습니다.** 다만 이제 **확인되지 않아도 괜찮습니다.**

사용자 조작 없이 시작되는 다운로드는 브라우저가 조용히 막을 수 있고,
막아도 `a.click()` 은 예외를 던지지 않습니다. 그래서 `auto_backup_at` 은
**"시도한 시각"일 뿐 성공이 아닙니다.** 그 구멍을 안전망이 메웁니다
(`src/features/backup/safetyNet.ts`).

- 기록을 저장한 화면 맨 아래에 `백업 파일 받기` 카드 한 장.
  **직접 받은 파일이 하나도 없는 동안만** 나오고, 한 번 받으면 영영
  사라집니다. `backup_saved_at` 이 그 판정입니다.
- `/pet/backup` 의 수동 내보내기도 `backup_saved_at` 을 남깁니다.
- 두 키를 나눈 이유가 전부입니다 — `auto_backup_at` 으로 안전망을 끄면
  자동이 막힌 기기에서 백업이 **하나도 없게** 됩니다.
  `tests/data-export.test.ts` 의 「자동 백업이 시각을 남겼어도 안전망은
  그대로 나온다」가 이것을 붙잡습니다.

> **⚠️ 클릭 처리기 안에서 `await` 하지 마세요.** `downloadBlob` 앞에
> `await` 가 하나라도 있으면 사용자 활성화 창이 닫힌 뒤에 내려받기가
> 불릴 수 있고, 그러면 자동 백업과 **똑같은 자리에 다시 섭니다.**
> 그래서 `prepareBackup` 이 화면이 뜰 때 Blob 을 미리 만들어 두고,
> 클릭 처리기는 기다리는 것 없이 건네기만 합니다.

실기기에서 볼 것은 이제 하나 줄어 이것입니다 — **`백업 파일 받기` 를
눌렀을 때 아이폰에서 파일이 실제로 저장되는가.** 제스처 안이라 막힐
이유가 없지만, 이것이 막히면 `/pet/backup` 의 내보내기도 같이 막힌 것이고
그때는 백업 기능 전체를 다시 설계해야 합니다.

### 확인하면 좋은 것

- 사진 업로드 실기기 — 아이폰 HEIC, 세로 사진이 눕는지, 화면의 `NNKB` 가
  300 이하인지
- 영상이 **960px** 이라 처음 규격(1440)보다 작습니다. Pro Max 급에서 약간
  부드럽게 보입니다. 선명하게 가려면 1440 으로 다시 뽑아 같은 명령으로
  재인코딩하면 됩니다.

### 알면서 두고 온 것

- **이중 여백.** 인트로의 `.page` 는 여백이 없고 나머지 화면은
  `padding: 1rem` 이 더 있어 콘텐츠 좌측이 16px vs 32px 입니다. 본 MVP 에서
  넘어온 불일치이고, 로고를 셸이 그리게 해서 **로고 위치는 영향받지
  않습니다.** 정리하면 다른 화면들이 좌우로 16px 넓어집니다.
- `CONTEXT 5-2` 의 인트로 문구가 코드와 다릅니다 (4-1 참고).
- `ui/TabBar` 는 쓰이지 않습니다. 본 MVP 로 돌아갈 때 셸에 다시 얹으려고
  남겨 두었습니다.
- 벡터 일러스트(`IntroArt.tsx`)는 `d1d99d1` 에서 지웠습니다. git 이력에
  있습니다.

## 8. 도구 메모

**ffmpeg 는 이 머신에 설치되어 있지 않습니다.** 영상·이미지를 손봐야 하면
둘 중 하나입니다.

```bash
# 임시로 (시스템을 건드리지 않음)
mkdir -p /tmp/ff && cd /tmp/ff && npm init -y && npm i ffmpeg-static
# → node_modules/ffmpeg-static/ffmpeg.exe

# 영구 설치 (Windows 11)
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
```

로고 자산을 다시 만들 때:

```bash
ffmpeg -i logo.png -vf "crop=1342:719:128:240,scale=720:-1:flags=lanczos" \
  -c:v libwebp -quality 88 logo.webp
```

`crop` 값은 알파 채널의 실제 경계입니다 (원본 1536×1024 에서 여백을 뺀 것).
