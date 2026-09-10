/**
 * 카드 5장의 정의 (PRD FR-2).
 *
 * 화면이 아니라 데이터로 둡니다. **"5장 완료까지 탭 수가 5회를 넘지 않는다"**
 * 는 수용 기준이 화면을 열어 보지 않고도 검사되어야 하기 때문입니다.
 * 카드 하나에 선택지 하나를 고르면 곧바로 다음 장으로 넘어가므로,
 * 탭 수는 정확히 카드 수입니다. 확인 버튼이나 "다음" 버튼을 넣지 마세요 —
 * 넣는 순간 이 계약이 깨지고 `tests/daily-log-cards.test.ts` 가 잡습니다.
 *
 * 순서도 PRD FR-2 표 그대로입니다. 노령기 악화의 최초 신호가 거의 항상
 * 식욕이라 밥이 먼저 오고, 하루 전체를 묻는 카드가 마지막입니다.
 */

import { copy } from '../../copy'
import type { DailyLogInput } from '../../data'

/** 카드가 채우는 항목. 태그·메모는 선택 항목이라 여기 없습니다. */
export type CardField = 'meal' | 'water' | 'energy' | 'toilet' | 'overall'

export type CardOption<F extends CardField> = {
  value: DailyLogInput[F]
  label: string
}

export type CardDef<F extends CardField = CardField> = {
  field: F
  question: string
  options: readonly CardOption<F>[]
}

/** `{ ate_all: '다 먹음', … }` 를 순서가 있는 목록으로 폅니다. */
function toOptions<F extends CardField>(
  labels: Record<DailyLogInput[F] & string, string>,
): readonly CardOption<F>[] {
  return Object.entries(labels).map(([value, label]) => ({
    value: value as DailyLogInput[F],
    label: label as string,
  }))
}

export const CARDS: readonly CardDef[] = [
  {
    field: 'meal',
    question: copy.dailyLog.meal.q,
    options: toOptions<'meal'>(copy.dailyLog.meal.options),
  },
  {
    field: 'water',
    question: copy.dailyLog.water.q,
    options: toOptions<'water'>(copy.dailyLog.water.options),
  },
  {
    field: 'energy',
    question: copy.dailyLog.energy.q,
    options: toOptions<'energy'>(copy.dailyLog.energy.options),
  },
  {
    field: 'toilet',
    question: copy.dailyLog.toilet.q,
    options: toOptions<'toilet'>(copy.dailyLog.toilet.options),
  },
  {
    /** 마지막 카드. 질문의 주체가 "우리"입니다 (PRD FR-2). */
    field: 'overall',
    question: copy.dailyLog.overall.q,
    options: toOptions<'overall'>(copy.dailyLog.overall.options),
  },
]

/**
 * 아직 아무것도 고르지 않은 상태.
 *
 * `undefined` 로 두는 이유는 "안 고름"과 "정상을 골랐음"을 구분하기 위해서
 * 입니다. 기본값을 `normal` 로 채워 두면 5장을 넘기기만 해도 기록이 되고,
 * 그 데이터는 추세선에서 거짓말을 합니다.
 */
export type Draft = { [F in CardField]?: DailyLogInput[F] }

/** 5장을 모두 골랐는지. `DailyLogInput` 으로 좁히는 타입 가드입니다. */
export function isComplete(draft: Draft): draft is Required<Draft> {
  return CARDS.every((card) => draft[card.field] !== undefined)
}
