/**
 * 좋은 날 집계 (TECH_SPEC 7-2).
 *
 * **이 파일은 아무것도 import 하지 않습니다.** 아래 타입들은 다른 파일에도
 * 같은 정의가 있지만(`dates.ts` 의 `DateStr`, U05 의 `DailyLog`), 도메인이
 * 다른 계층을 끌어오지 않는 것이 이 계층의 존재 이유라 일부러 다시 적었습니다.
 *
 * 힘든 날을 세는 함수가 여기 없습니다. 그게 원칙 P2 의 구현입니다.
 * 집계는 요약서(U20)에서만 합니다.
 */

/** `YYYY-MM-DD`. `dates.ts` 와 같은 정의입니다. */
export type DateStr = string

/** TECH_SPEC 3-4. 이 문자열 값은 DB 에 저장되므로 바꾸지 않습니다. */
export type Overall = 'good' | 'okay' | 'hard'

/**
 * 주간 점 하나의 모양.
 *
 * **`'red'` 가 없습니다. 그 자체가 원칙 P6 의 구현입니다** (PRD 11-3).
 * 타입에 없으므로 화면이 빨간 점을 그릴 방법이 없습니다.
 *
 * `'none'` 은 아직 기록이 없는 날입니다. 비어 있음이지 나쁨이 아닙니다.
 * 지적하는 표시로 쓰지 마세요 (PRD 4-1 (6)).
 */
export type Dot = 'filled' | 'empty' | 'gray' | 'none'

/**
 * 집계에 필요한 최소 모양입니다.
 *
 * U05 의 실제 `DailyLog` 레코드는 이보다 필드가 많지만 구조적으로 대입됩니다.
 * 삭제된 기록(`deleted_at`)을 걸러 내는 것은 넘기는 쪽의 몫입니다.
 * 도메인은 받은 것을 셀 뿐입니다.
 */
export interface DailyLog {
  readonly date: DateStr
  readonly overall: Overall
}

const DOT_BY_OVERALL: Record<Overall, Dot> = {
  good: 'filled',
  okay: 'empty',
  hard: 'gray',
}

/** 하루 = 86,400,000 밀리초. 달력 산술은 UTC 로만 합니다. */
function addDays(date: DateStr, delta: number): DateStr {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (match === null) throw new Error(`YYYY-MM-DD 형식이 아닙니다: ${date}`)

  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + delta))
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/** 좋은 날의 수. 힘든 날은 세지 않습니다 (PRD 원칙 P2). */
export function countGood(logs: DailyLog[]): number {
  return logs.filter((log) => log.overall === 'good').length
}

/**
 * `weekStart` 부터 7일치 점.
 *
 * 기록이 없는 날은 `'none'` 입니다. 빈 날이 섞여도 항상 7개를 돌려줍니다.
 * 같은 날짜가 여러 건이면 먼저 나온 것을 씁니다 — U05 가 날짜에 유니크
 * 제약을 걸므로 실제로는 생기지 않습니다.
 */
export function weekDots(logs: DailyLog[], weekStart: DateStr): Dot[] {
  const byDate = new Map<DateStr, Overall>()
  for (const log of logs) {
    if (!byDate.has(log.date)) byDate.set(log.date, log.overall)
  }

  return Array.from({ length: 7 }, (_unused, offset) => {
    const overall = byDate.get(addDays(weekStart, offset))
    return overall === undefined ? 'none' : DOT_BY_OVERALL[overall]
  })
}

/**
 * 전월 대비 좋은 날 비교.
 *
 * **늘어난 달에만 값을 돌려주고, 줄거나 같으면 `null` 입니다. 이것이 이 함수의
 * 계약입니다** (PRD FR-6 · TECH_SPEC 7-2). 화면이 판단하지 않습니다.
 * 하락 추세를 어떻게 보여줄지는 이 제품에서 가장 어려운 UI 문제이고,
 * MVP 는 비교를 생략하는 보수적 회피책을 씁니다. 임의로 바꾸지 마세요.
 *
 * 지난달 기록이 아예 없을 때(0건)도 늘어난 것으로 봅니다. 계약이
 * "증가/감소·동일" 두 갈래뿐이라 그렇습니다. handoff/U04.md 참고.
 */
export function monthComparison(
  thisMonth: DailyLog[],
  lastMonth: DailyLog[],
): { text: string } | null {
  const difference = countGood(thisMonth) - countGood(lastMonth)
  return difference > 0 ? { text: `지난달보다 ${difference}일 더` } : null
}
