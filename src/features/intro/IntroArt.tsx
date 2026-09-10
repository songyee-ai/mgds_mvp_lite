import styles from './intro.module.css'

/**
 * 인트로 3장의 일러스트.
 *
 * ## 세 장이 한 이야기입니다
 *
 * ```
 * 1장 바라보기  →  2장 남겨보기  →  3장 이어가기
 * 오늘을 바라보고 → 오늘을 남기고 → 좋은 날을 늘린다
 * ```
 *
 * 1장에 엎드려 있던 아이가 3장에서 걸어갑니다 — 자란 것이 아니라 같은
 * 존재의 다른 순간이고, 그것이 읽히도록 귀·꼬리·몸의 곡선을 두 장에서
 * 같은 어휘로 그립니다.
 *
 * ## 세 장의 자리가 같습니다
 *
 * 그림이 놓이는 칸의 크기와 위치가 장마다 똑같습니다 (`intro.module.css`
 * 의 `.page` 가 grid 로 고정합니다). 장을 넘길 때 그림만 바뀌고 화면은
 * 움직이지 않습니다.
 *
 * **그림 블록은 그 칸을 폭까지 꽉 채웁니다.** 글이 왼쪽 정렬이라 그림이
 * 그보다 좁으면 두 덩어리가 따로 놉니다 — 한때 정사각을 지키려고 폭을
 * 줄였다가 실제로 그렇게 보였습니다.
 *
 * ## 그리지 않는 것
 *
 * 병원·약병·주사기·아픈 표정·눈물. 그리고 **노령과 질병을 강조하는 연출
 * 일체.** 첫 화면이 전할 감정은 `불안 → 관리` 가 아니라
 * `관심 → 기록 → 희망` 입니다. 1장이 보여 주는 것은 "아픈 아이"가 아니라
 * **"오늘의 아이"** 입니다.
 *
 * 눈·코·털도 그리지 않습니다. 자세와 실루엣만으로 편안함이 느껴져야
 * 합니다 — 인트로는 작게 표시되고, 그 크기에서 눈·코는 형태를 흐리는
 * 노이즈가 됩니다.
 *
 * ## 색을 SVG 에 직접 쓰지 않습니다
 *
 * `fill="#..."` 로 쓰면 `scripts/lint-color.mjs` 의 눈을 벗어납니다 — 그
 * 린트는 `.css` 만 봅니다. 팔레트에 빨강이 없어서 상태 표시에 빨강을 쓸
 * 수 없다는 것이 이 제품의 구조인데(PRD 원칙 P6), `.tsx` 에 색을 적을 수
 * 있으면 그 구조에 구멍이 납니다. **그래서 모든 색이 CSS 클래스에
 * 있습니다.**
 *
 * ## 애니메이션
 *
 * 각 그림의 `light`·`decorative` 그룹에만 붙습니다. 형태가 움직이지
 * 않으므로 무엇을 그린 것인지는 정지 상태로도 읽히고, 움직임은 살아 있는
 * 느낌만 더합니다. `prefers-reduced-motion` 에서는 전부 멈춥니다 —
 * 규칙은 `intro.module.css` 끝에 있습니다.
 *
 * ## 접근성
 *
 * 세 그림 모두 장식입니다. 문장이 이미 같은 말을 하고 있어서 대체 텍스트가
 * 있으면 스크린리더가 같은 내용을 두 번 읽습니다. `IntroScreen` 이 감싸는
 * 요소에 `aria-hidden` 을 걸고, 여기서는 `focusable="false"` 로 키보드
 * 순회에서만 빼 둡니다.
 */

type ArtProps = { readonly className?: string }

/**
 * 세 그림의 공통 껍데기.
 *
 * `xMidYMid meet` — **가운데 정렬**입니다.
 *
 * 담는 블록(`.artFrame`)이 칸을 꽉 채우면서 화면에 따라 세로로 긴
 * 사각형이 됩니다. 이 그림들은 가로로 긴 띠라서 그 안에서 남는 자리가
 * 생기고, **아래에 붙이면 띠가 바닥에 떨어진 것처럼 보입니다.**
 * 가운데 두면 위아래 여백이 같아 액자에 담긴 것으로 읽힙니다.
 *
 * 이건 **임시 상태의 타협**입니다. 1440×1440 일러스트가 들어오면 이미지가
 * 블록을 `cover` 로 덮으므로 남는 자리가 아예 없습니다.
 *
 * `viewBox` 를 그림마다 다르게 넘깁니다. 하나를 같이 쓰면 상자 안에 이미
 * 바닥선 아래의 빈 자리가 깔려 있어, 정렬이 그 빈 자리까지 함께 다룹니다.
 * 가로는 셋 다 320 이라 확대 비율이 같습니다.
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
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      role="presentation"
    >
      {children}
    </svg>
  )
}

/**
 * 1장 — 바라보기. 창가에 엎드린 아이, 그 곁 바닥에 놓인 보호자의 손.
 *
 * ## 다리에서 손으로 바꿨습니다
 *
 * 처음에는 앉은 보호자의 다리를 그렸습니다. 세 번 고쳐도 기둥·지팡이·언덕으로
 * 읽혔습니다. **작은 크기에서 다리는 안 읽힙니다** — 무릎도 정강이도 그
 * 자체로는 아무 형태가 아니고, 사람이라는 것은 몸 전체의 관계에서 나옵니다.
 *
 * 손은 다릅니다. 손가락 넷이면 그것만으로 손입니다. 그리고 **곁에 놓인 손이
 * 다리보다 이 장의 뜻에 가깝습니다** — 돌보는 손짓이 아니라 그냥 옆에
 * 있음이고, 아이를 만지지도 않습니다.
 *
 * 팔이 화면 오른쪽 밖에서 들어옵니다. **얼굴을 그리지 않으면 보는 사람이
 * 자기 자신을 그 자리에 놓습니다.**
 */
export function ArtWindowLight() {
  return (
    <Frame box="0 12 320 208">
      {/* ── light ── 창에서 바닥으로 퍼지는 햇살. 두 겹을 겹쳐 경계를 지웁니다. */}
      <g className={styles.artLight}>
        <path d="M30 112 L126 112 C158 140 190 172 210 196 L80 196 C64 168 46 138 30 112 Z" />
        <path d="M52 112 L114 112 C140 140 166 168 182 196 L98 196 C86 170 68 140 52 112 Z" />
      </g>

      {/* ── environment ── 창틀 · 러그 · 바닥 */}
      <g>
        <rect className={styles.artLine} x="30" y="20" width="96" height="92" rx="5" />
        <path className={styles.artLine} d="M78 20 L78 112 M30 66 L126 66" />
        {/* 러그. 아이가 맨바닥이 아니라 자기 자리에 있다는 표시입니다. */}
        <ellipse className={styles.artRug} cx="142" cy="198" rx="98" ry="14" />
        <path className={styles.artLine} d="M12 196 L308 196" />
      </g>

      {/* ── pet ── 엎드린 아이. 머리 원이 몸과 겹쳐야 목이 끊기지 않습니다. */}
      <g className={styles.artBreathe}>
        <ellipse className={styles.artShadow} cx="136" cy="195" rx="60" ry="7" />
        <path className={styles.artInk} d="M82 194 C76 172 104 160 134 162 C158 164 172 174 176 194 Z" />
        <circle className={styles.artInk} cx="176" cy="172" r="17" />
        {/* 주둥이. 원 하나가 더 붙으면 개·고양이 쪽으로 읽힙니다. */}
        <circle className={styles.artInk} cx="191" cy="179" r="9" />
        {/* 귀. 3장의 아이와 같은 모양입니다 — 같은 존재로 읽히게 합니다. */}
        <path className={styles.artInk} d="M165 163 L159 147 L174 157 Z" />
        <path className={styles.artInkStroke} d="M82 194 C69 192 61 183 65 173" />
      </g>

      {/*
        ── person ── 바닥에 놓인 손과, 오른쪽 밖에서 들어오는 팔.

        아이를 만지지 않습니다. 손끝과 아이 사이에 한 뼘을 남겨 두었습니다 —
        닿으면 돌보는 장면이 되고, 이 장은 바라보는 장면입니다.
      */}
      <g>
        <ellipse className={styles.artShadow} cx="252" cy="195" rx="46" ry="5" />
        {/* 팔 — 화면 오른쪽 밖에서 들어옵니다. */}
        <path
          className={styles.artFigure}
          d="M320 116 L320 168 C300 172 278 178 262 186 L246 160 C270 144 296 126 320 116 Z"
        />
        {/* 손등 */}
        <ellipse className={styles.artFigure} cx="252" cy="182" rx="24" ry="14" />
        {/* 손가락 넷. 바닥까지 내려와 닿습니다 — 이것이 손으로 읽히는 이유입니다. */}
        <g className={styles.artFinger}>
          <path d="M236 176 L214 186" />
          <path d="M238 183 L216 192" />
          <path d="M242 189 L224 196" />
          <path d="M248 193 L236 196" />
        </g>
      </g>
    </Frame>
  )
}

/**
 * 2장 — 남겨보기. 손에 든 작은 기록 카드, 카드 밖으로 이어지는 점들.
 *
 * ## 처음부터 다시 그렸습니다
 *
 * 첫 판은 손을 곡선 두 개로만 그렸는데 **그릇처럼 보였습니다.** 손을 선으로
 * 그리면 손이 되지 않습니다 — 손바닥이라는 면과 손가락이라는 덩어리가
 * 있어야 손입니다. 그래서 손을 실루엣으로 바꾸고, **손가락 셋이 카드 앞을
 * 지나가게** 했습니다. 카드 위로 손가락이 겹치는 것이 "들고 있다"를
 * 만드는 유일한 신호입니다.
 *
 * 카드도 작게 줄였습니다. 크면 UI 카드처럼 보이고, 이 장이 피해야 하는
 * 것이 대시보드입니다.
 *
 * ## 카드 안은 기록, 카드 밖은 흐름
 *
 * 안에는 날짜 한 줄과 점 세 개가 부드러운 선으로 이어져 있고, 밖으로는
 * **점만** 이어집니다. 선을 밖까지 끌고 나가면 한 개의 그래프가 되고,
 * 그러면 의료 차트가 됩니다.
 *
 * 선은 각지지 않고 오르지도 떨어지지도 않습니다 — 좋아졌다·나빠졌다를
 * 말하는 그림이 아니라 흐름이 보인다는 그림입니다 (PRD 원칙 P2).
 */
export function ArtCardInHand() {
  return (
    <Frame box="0 40 320 180">
      {/* ── person ── 손바닥. 면으로 그려야 손이 됩니다. */}
      <g className={styles.artFigure}>
        <path d="M64 186 C58 166 70 150 92 148 L206 140 C230 138 246 150 248 170 C250 192 236 208 212 211 L108 220 C82 223 68 208 64 186 Z" />
        {/* 엄지 — 왼쪽에서 카드를 받칩니다. */}
        <path d="M70 156 C60 142 62 126 74 120 C86 114 98 122 100 136 L104 158 Z" />
      </g>

      {/* ── environment ── 기록 카드. 홈의 카드와 같은 재질로 읽히게 합니다. */}
      <g transform="rotate(-6 156 128)">
        <rect className={styles.artCard} x="96" y="78" width="120" height="86" rx="11" />
        {/* 날짜 한 줄. 무슨 카드인지만 알면 됩니다. */}
        <rect className={styles.artRug} x="112" y="94" width="34" height="6" rx="3" />
        {/* 기록 — 부드러운 선 하나와 점 세 개. */}
        <path
          className={styles.artCurve}
          d="M114 142 C128 137 136 130 150 132 C162 134 170 126 182 121"
        />
        <circle className={styles.artDot} cx="114" cy="142" r="3" />
        <circle className={styles.artDot} cx="150" cy="132" r="3" />
        <circle className={styles.artDot} cx="182" cy="121" r="3" />
      </g>

      {/*
        ── person ── 카드 앞을 지나가는 손가락 셋.

        **카드보다 뒤에 그리면 손이 카드를 든 것이 아니라 옆에 있는 것이
        됩니다.** 순서가 뜻을 만듭니다.
      */}
      <g className={styles.artFigure}>
        <rect x="104" y="150" width="30" height="34" rx="15" />
        <rect x="142" y="146" width="30" height="34" rx="15" />
        <rect x="180" y="143" width="30" height="34" rx="15" />
      </g>

      {/*
        ── decorative ── 카드 밖으로 이어지는 흐름.

        점만 있습니다. 점들이 스스로 곡선을 이루고 멀어지며 작아집니다.
        하나씩 차례로 나타나는 애니메이션이 붙습니다 (`artFlowDot`) —
        기록이 쌓여 이어진다는 말을 움직임으로 한 번 더 합니다.
      */}
      <g className={styles.artFlowDot}>
        <circle cx="236" cy="112" r="3.4" />
        <circle cx="258" cy="96" r="2.9" />
        <circle cx="277" cy="83" r="2.4" />
        <circle cx="293" cy="73" r="1.9" />
      </g>
    </Frame>
  )
}

/**
 * 3장 — 이어가기. 나란히 걷는 보호자와 아이, 멀리 이어지는 길.
 *
 * ## 목줄을 가까운 쪽 팔로 옮겼습니다
 *
 * 첫 판은 팔을 사람의 왼쪽(아이 반대편)에 그리고 목줄을 거기서 뽑았습니다.
 * **목줄이 몸을 가로질러 아이에게 갔습니다** — 실제로 그렇게 잡을 수는
 * 있지만 그림에서는 팔이 어디 붙었는지 알 수 없어져서 자세가 어색해집니다.
 *
 * 이제 팔이 아이 쪽 옆구리에서 내려오고 목줄이 그 손끝에서 곧장 갑니다.
 * 반대쪽 팔은 그리지 않았습니다 — 뒷모습에서 반대쪽 팔은 몸에 가려
 * 거의 보이지 않고, 그리면 실루엣만 복잡해집니다.
 *
 * ## 도착하지 않습니다
 *
 * 길이 화면 위쪽으로 열린 채 끝나고 그 앞에 아무것도 없습니다. 어딘가에
 * 도착하는 장면이 아니라 함께 걷는 과정이어야 하고, 가는 방향을 비워
 * 두는 것이 "좋은 날을 늘리는 앱"이라는 문장과 같은 말입니다.
 */
export function ArtWalkingTogether() {
  return (
    <Frame box="0 60 320 162">
      {/* ── environment ── 멀어지며 좁아지는 산책길 */}
      <path
        className={styles.artPath}
        d="M44 220 C96 198 136 176 152 146 L178 146 C194 176 234 198 286 220 Z"
      />

      {/* ── light ── 길이 끝나는 자리의 빛. 여기서 화면이 열립니다. */}
      <ellipse className={styles.artLight} cx="165" cy="146" rx="56" ry="14" />

      {/* ── environment ── 길가의 식물. 평범한 동네라는 표시입니다. */}
      <g className={styles.artPlant}>
        <path d="M40 206 C35 191 44 181 55 181 C67 181 75 191 70 206 Z" />
        <path d="M272 176 C264 154 278 138 294 138 C311 138 322 155 314 176 Z" />
      </g>
      <path className={styles.artTrunk} d="M293 176 L293 204" />

      {/* ── decorative ── 공기 중의 작은 빛. 천천히 떠오릅니다. 셋을 넘기지 마세요. */}
      <g className={styles.artSpark}>
        <circle cx="96" cy="120" r="3" />
        <circle cx="238" cy="106" r="2.4" />
        <circle cx="68" cy="152" r="2" />
      </g>

      {/* ── person · pet ── 같은 방향으로 걷는 뒷모습. 얼굴이 없습니다. */}
      <g>
        <ellipse className={styles.artShadow} cx="140" cy="205" rx="30" ry="6" />
        <ellipse className={styles.artShadow} cx="200" cy="205" rx="26" ry="5" />

        <circle className={styles.artInk} cx="140" cy="104" r="17" />
        <path
          className={styles.artInk}
          d="M121 127 C121 117 129 112 140 112 C151 112 159 117 159 127 L163 166 L117 166 Z"
        />
        <path className={styles.artInk} d="M126 166 L124 204 L136 204 L137 166 Z" />
        <path className={styles.artInk} d="M143 166 L145 204 L157 204 L154 166 Z" />
        {/* 아이 쪽 팔. 목줄이 이 손끝에서 나갑니다. */}
        <path className={styles.artInkStroke} d="M160 131 L169 162" />

        {/* 목줄. 팽팽하지 않게 늘어뜨립니다 — 끌고 가는 것이 아닙니다. */}
        <path className={styles.artLeash} d="M169 163 C178 171 186 172 194 170" />

        <path
          className={styles.artInk}
          d="M180 204 L182 180 C182 171 190 165 200 165 C210 165 218 171 218 180 L220 204 Z"
        />
        <circle className={styles.artInk} cx="200" cy="157" r="12" />
        <path className={styles.artInk} d="M191 152 L189 140 L198 148 Z" />
        <path className={styles.artInk} d="M209 152 L211 140 L202 148 Z" />
        <path className={styles.artInkStroke} d="M220 182 C228 176 230 166 226 158" />
      </g>
    </Frame>
  )
}
