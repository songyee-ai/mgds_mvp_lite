import styles from './intro.module.css'

/**
 * 인트로 3장의 일러스트.
 *
 * ## 왜 SVG 를 손으로 그렸나
 *
 * CONTEXT 5-2 는 각 장의 그림을 문장으로 지시합니다 — 창가 햇자리에 엎드린
 * 아이와 그 옆에 앉은 사람의 무릎 · 손 안의 작은 기록 카드와 부드러운 그래프
 * 선 · 나란히 걷는 뒷모습. WORK_UNITS U31 이 일러스트 제작을 범위 밖으로
 * 두고 ⚠️ PRD U9 가 열려 있어 처음에는 **빈 자리로 두었습니다.**
 *
 * **공개 버전에서 그건 틀린 판단이었습니다.** 첫 화면의 절반이 빈 카드면
 * 덜 만든 앱으로 읽힙니다. 자리표시자는 개발 중에만 자리표시자입니다.
 *
 * 그래서 사진처럼 그리려 하지 않고, **장면이 읽히는 최소한의 선과 면**으로
 * 그렸습니다. 나중에 진짜 일러스트가 생기면 이 파일의 컴포넌트 셋만
 * 갈아치우면 되고, `IntroScreen` 은 건드릴 일이 없습니다.
 *
 * ## 색을 SVG 에 직접 쓰지 않습니다
 *
 * `fill="#..."` 로 쓰면 `scripts/lint-color.mjs` 의 눈을 벗어납니다 — 그
 * 린트는 `.css` 만 봅니다. 팔레트에 빨강이 없어서 상태 표시에 빨강을 쓸
 * 수 없다는 것이 이 제품의 구조인데(PRD 원칙 P6), `.tsx` 에 색을 적을 수
 * 있으면 그 구조에 구멍이 납니다.
 *
 * **그래서 모든 색이 `intro.module.css` 의 클래스에 있습니다.** 여기 있는
 * 것은 클래스 이름뿐이고, 검사는 CSS 쪽에서 이뤄집니다.
 *
 * ## 접근성
 *
 * 세 그림 모두 장식입니다. 문장이 이미 같은 말을 하고 있어서 대체 텍스트가
 * 있으면 스크린리더가 같은 내용을 두 번 읽습니다. `IntroScreen` 이 감싸는
 * 요소에 `aria-hidden` 을 걸고, 여기서는 `focusable="false"` 로 키보드
 * 순회에서만 빼 둡니다 (IE 잔재가 아니라 일부 브라우저가 SVG 를 여전히
 * 포커스 대상으로 잡습니다).
 */

type ArtProps = { readonly className?: string }

/**
 * 세 그림의 공통 껍데기.
 *
 * ## `xMidYMax` — 아래 정렬
 *
 * 가운데 정렬(`xMidYMid`)이면 그림이 자기 칸 가운데에 떠서 바닥선과 제목
 * 사이에 공백이 고입니다. 아래에 붙이면 그림의 바닥이 곧 제목 위의 선이
 * 되고, 남는 자리는 그림 위쪽으로 가서 방의 여백처럼 읽힙니다.
 *
 * ## viewBox 를 그림마다 다르게 두는 이유
 *
 * 처음에는 세 장이 `0 0 320 240` 하나를 같이 썼습니다. **그러면 아래 정렬이
 * 무의미해집니다** — 1장의 바닥선이 `y=190` 이라 viewBox 안에 이미 50 단위의
 * 빈 자리가 깔려 있고, 아래에 붙는 것은 그 빈 자리까지 포함한 상자입니다.
 * 화면에서는 바닥선과 제목 사이가 여전히 벌어져 보입니다.
 *
 * 그래서 **각 그림이 자기 내용에 딱 맞는 상자를 넘깁니다.** 가로는 셋 다
 * 320 이라 확대 비율이 같고, 세로만 달라서 바닥이 늘 같은 자리에 옵니다.
 */
function Frame({
  box,
  children,
  className,
}: ArtProps & { box: string; children: React.ReactNode }) {
  return (
    <svg
      className={[styles.artSvg, className].filter(Boolean).join(' ')}
      viewBox={box}
      preserveAspectRatio="xMidYMax meet"
      focusable="false"
      role="presentation"
    >
      {children}
    </svg>
  )
}

/**
 * 1장 — 창가 햇자리에 엎드린 아이, 그 옆에 앉은 사람의 무릎.
 *
 * 햇빛이 창에서 바닥으로 비스듬히 떨어지고 그 안에 아이가 엎드려 있습니다.
 * 사람은 오른쪽 화면 밖으로 잘려 무릎만 남습니다 — **얼굴을 그리지 않는
 * 것이 의도입니다.** 보는 사람이 자기 자신을 그 자리에 놓게 됩니다.
 */
export function ArtWindowLight() {
  return (
    <Frame box="0 14 320 182">
      {/* 창에서 바닥으로 떨어지는 햇자리. 그림에서 가장 먼저 읽혀야 합니다. */}
      <path className={styles.artGlow} d="M36 112 L136 112 L214 190 L104 190 Z" />

      {/* 창틀 */}
      <rect className={styles.artLine} x="36" y="20" width="100" height="92" rx="4" />
      <path className={styles.artLine} d="M86 20 L86 112 M36 66 L136 66" />

      {/* 바닥 */}
      <path className={styles.artLine} d="M14 190 L306 190" />

      {/*
        곁에 앉은 사람의 무릎. 바닥에서 솟은 큰 덩어리 하나입니다.

        **작고 자세하게 그리면 이 크기에서 안 읽힙니다.** 허벅지·정강이·발로
        나눠 그려 봤더니 지팡이처럼 보였습니다. 무릎은 앉은 사람에게서 가장
        큰 덩어리이고, 크고 단순한 것은 오독되지 않습니다 — 해부학적으로
        정확할 필요는 없고 "누군가 거기 앉아 있다"만 읽히면 됩니다.

        얼굴은 그리지 않습니다 — 보는 사람이 자기 자신을 그 자리에 놓게
        하려는 것이 이 장의 의도입니다.
      */}
      <path
        className={styles.artSoft}
        d="M316 190 L248 190 C248 166 266 146 288 138 C298 135 309 136 316 141 Z"
      />

      {/*
        엎드린 아이 — 낮고 긴 등, 오른쪽에 머리.
        **머리 원이 몸과 겹칩니다.** 떼어 놓으면 목이 끊겨 보입니다.
      */}
      <path className={styles.artInk} d="M104 190 C100 168 128 158 158 160 C182 162 196 172 200 190 Z" />
      <circle className={styles.artInk} cx="200" cy="170" r="17" />
      {/* 주둥이. 원 하나가 더 붙으면 개·고양이 쪽으로 읽힙니다. */}
      <circle className={styles.artInk} cx="215" cy="177" r="9" />
      {/* 귀. 엎드린 아이는 귀가 뒤로 눕습니다. */}
      <path className={styles.artInk} d="M189 161 L183 145 L198 155 Z" />
      {/* 꼬리 */}
      <path className={styles.artInkStroke} d="M104 190 C92 188 85 180 89 171" />
      <circle className={styles.artPaper} cx="207" cy="167" r="2.4" />
    </Frame>
  )
}

/**
 * 2장 — 손 안의 작은 기록 카드, 부드러운 그래프 선.
 *
 * 손이 카드를 받치고 있고 카드 안에 흐름이 그려져 있습니다. **그래프가
 * 올라가지도 내려가지도 않고 완만하게 흐릅니다** — 좋아졌다·나빠졌다를
 * 말하는 그림이 아니라 "흐름이 보인다"는 그림입니다 (PRD 원칙 P2).
 */
export function ArtCardInHand() {
  return (
    <Frame box="0 88 320 142">
      {/* 카드를 받치는 손. 손가락을 그리지 않고 받치는 곡선만 남깁니다. */}
      <path className={styles.artHand} d="M48 164 C48 204 80 224 124 224 L196 224 C240 224 272 204 272 164" />
      <path className={styles.artHand} d="M272 164 C282 158 288 146 284 134" />

      {/* 기록 카드 */}
      <rect className={styles.artCard} x="92" y="92" width="136" height="106" rx="12" />

      {/* 카드 안의 글줄 두 개 */}
      <rect className={styles.artSoft} x="110" y="110" width="70" height="7" rx="3.5" />
      <rect className={styles.artSoft} x="110" y="124" width="44" height="7" rx="3.5" />

      {/* 부드러운 흐름. 기준선 없이 선 하나로 둡니다. */}
      <path className={styles.artCurve} d="M110 176 C126 170 136 161 152 163 C168 165 178 151 195 145 C202 142 207 141 211 140" />
      <circle className={styles.artDot} cx="110" cy="176" r="3.2" />
      <circle className={styles.artDot} cx="152" cy="163" r="3.2" />
      <circle className={styles.artDot} cx="195" cy="145" r="3.2" />
    </Frame>
  )
}

/**
 * 3장 — 나란히 걷는 뒷모습.
 *
 * 앱 이름이 처음 나오는 장입니다. 둘이 **앞을 보고 걸어가는** 그림이고,
 * 그래서 앞쪽 여백을 비워 두었습니다 — 가는 방향에 아직 아무것도 그려
 * 넣지 않는 것이 이 장의 문장("좋은 날을 늘리는 앱입니다")과 같은 말입니다.
 */
export function ArtWalkingTogether() {
  return (
    <Frame box="0 54 320 166">
      {/* 바닥과 그 위에 깔린 빛 */}
      <ellipse className={styles.artGlow} cx="176" cy="200" rx="124" ry="16" />
      <path className={styles.artLine} d="M20 200 L300 200" />

      {/* 사람의 뒷모습. 얼굴이 없습니다. */}
      <circle className={styles.artInk} cx="150" cy="76" r="18" />
      <path className={styles.artInk} d="M132 98 C132 89 140 84 150 84 C160 84 168 89 168 98 L172 150 L128 150 Z" />
      <path className={styles.artInk} d="M137 150 L135 200 L146 200 L147 150 Z" />
      <path className={styles.artInk} d="M153 150 L154 200 L165 200 L163 150 Z" />
      <path className={styles.artInkStroke} d="M131 102 L123 146" />

      {/* 목줄. 팽팽하지 않게 늘어뜨립니다. */}
      <path className={styles.artLeash} d="M123 146 C148 158 174 154 198 154" />

      {/* 아이의 뒷모습 */}
      <path className={styles.artInk} d="M191 200 L193 174 C193 166 200 160 210 160 C220 160 227 166 227 174 L229 200 Z" />
      <circle className={styles.artInk} cx="210" cy="152" r="12" />
      <path className={styles.artInk} d="M201 147 L199 135 L208 143 Z" />
      <path className={styles.artInk} d="M219 147 L221 135 L212 143 Z" />
      <path className={styles.artInkStroke} d="M229 176 C237 170 239 160 235 152" />
    </Frame>
  )
}

/*
 * **이 파일은 컴포넌트만 내보냅니다.**
 *
 * 장 순서를 담은 배열을 여기서 내보내 봤더니 Fast Refresh 가 이 모듈을
 * 통째로 무효화했습니다 (`"INTRO_ART" export is incompatible`) — 개발 중에
 * 그림을 고치면 화면이 잠깐 하얗게 됩니다. react-refresh 는 컴포넌트 파일이
 * 컴포넌트만 내보낼 때 부분 갱신을 할 수 있습니다.
 *
 * 그래서 순서는 쓰는 쪽(`IntroScreen`)의 모듈 안에 둡니다.
 */
