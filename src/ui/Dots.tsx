import { copy } from '../copy'
import type { Dot } from '../domain'
import styles from './ui.module.css'

/**
 * 주간 점 표시.
 *
 * **'red' 는 타입에 존재하지 않습니다.** 팔레트(tokens.css)에도 빨강이
 * 없습니다. PRD 원칙 P6 · PRD 11-3 을 타입과 팔레트 두 겹으로 막습니다.
 *
 * 색만으로 정보를 전달하지 않습니다 (NFR-A A-4).
 * 채움/빈/회색/작은 점이라는 형태 차이가 있고, 각 점에 텍스트 라벨이 붙습니다.
 *
 * ## `'none'` 은 U11 이 더했습니다
 *
 * U02 는 상태를 3종으로 두고 "임의로 4번째 상태를 만들지 말라"고 적어
 * 두었습니다. 도메인의 `Dot` 에는 `'none'`(미기록)이 있는데 대응하는 UI
 * 상태가 없어, 그 판단을 홈이 생기는 단위로 미뤄 둔 것입니다.
 *
 * **PRD FR-5 의 레이아웃이 `● ● ○ ● ● ● ·` 로 4번째 모양을 이미 보여
 * 줍니다.** 마지막 `·` 는 아직 기록하지 않은 오늘입니다. 그래서 여기서
 * 풉니다. `'none'` 은 **비어 있음이지 나쁨이 아닙니다** — 회색(힘든 날)보다
 * 옅고 작게, 지적으로 읽히지 않게 둡니다 (PRD 4-1 (6)).
 */
export const DOT_STATES = ['good', 'okay', 'hard', 'none'] as const

export type DotState = (typeof DOT_STATES)[number]

/**
 * 도메인의 `Dot` → UI 의 `DotState`.
 *
 * 두 어휘가 다른 이유는 도메인이 `copy/` 를 import 할 수 없어 표기가 아니라
 * 모양(`filled`·`empty`·`gray`)으로 말하기 때문입니다. **다리를 여기 둔
 * 이유는 어휘를 소유한 쪽이 이 컴포넌트라서입니다** — 주간 점을 쓰는
 * 화면이 둘(홈 U11 · 흐름 U19)이라 각자 변환하면 두 벌이 됩니다.
 *
 * 타입만 import 하므로 런타임 의존성은 생기지 않습니다.
 */
const STATE_BY_DOT: Record<Dot, DotState> = {
  filled: 'good',
  empty: 'okay',
  gray: 'hard',
  none: 'none',
}

export const dotStateOf = (dot: Dot): DotState => STATE_BY_DOT[dot]

/**
 * 스크린리더가 읽는 문구. 문구 자체는 copy/ko.ts 가 가집니다 (TECH_SPEC 13).
 *
 * 좋은 날·보통·힘든 날은 기록 화면의 선택지와 **같은 어휘를 씁니다** —
 * 사용자가 누른 말과 점이 읽히는 말이 달라지면 안 됩니다 (U02 계약).
 */
export const DOT_STATE_LABEL: Record<DotState, string> = {
  ...copy.dailyLog.overall.options,
  none: copy.home.week.notRecorded,
}

// CSS 모듈의 클래스 이름은 타입상 string | undefined 입니다
// (tsconfig 의 noUncheckedIndexedAccess). join 앞에서 걸러 냅니다.
const DOT_CLASS: Record<DotState, string | undefined> = {
  good: styles.dotGood,
  okay: styles.dotOkay,
  hard: styles.dotHard,
  none: styles.dotNone,
}

export interface DotsProps {
  values: readonly DotState[]
  /** 각 점이 가리키는 날의 이름. 예: ['월','화',…]. 접근성 라벨 앞에 붙습니다. */
  dayLabels?: readonly string[]
  /** 점 묶음 전체의 이름. 예: '이번 주'. */
  label: string
}

export function Dots({ values, dayLabels, label }: DotsProps) {
  return (
    <ul className={styles.dots} aria-label={label}>
      {values.map((value, index) => {
        const day = dayLabels?.[index]
        const text = day === undefined
          ? DOT_STATE_LABEL[value]
          : `${day} ${DOT_STATE_LABEL[value]}`

        return (
          <li key={index}>
            <span
              className={[styles.dot, DOT_CLASS[value]].filter(Boolean).join(' ')}
              role="img"
              aria-label={text}
            />
          </li>
        )
      })}
    </ul>
  )
}
