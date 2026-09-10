/**
 * 앱 내 미완료 표시 (U11, TECH_SPEC 8-1).
 *
 * U11 의 테스트 목록이 요구하는 것: **`pendingItems` 경계 (오늘 기록
 * 있음/없음, 약 시각 전/후)**.
 *
 * `domain/**` 은 커버리지 100% 가 게이트라 갈래를 하나도 남기지 않습니다.
 */

import { describe, expect, it } from 'vitest'
import {
  WEIGHT_INTERVAL_DAYS,
  pendingItems,
  type Occurrence,
  type Pending,
  type PendingInput,
} from '../src/domain'

const TZ_NOON = new Date('2026-09-09T03:00:00.000Z') // KST 12:00
const TODAY = '2026-09-09'

/** 체중은 이 테스트의 관심사가 아닐 때 "방금 쟀다"로 둡니다. */
const base = (patch: Partial<PendingInput> = {}): PendingInput => ({
  targetDate: TODAY,
  now: TZ_NOON,
  logs: [{ date: TODAY }],
  occurrences: [],
  medLogs: [],
  latestWeightDate: TODAY,
  ...patch,
})

const occurrence = (medicationId: string, scheduledAt: string, localTime: string): Occurrence => ({
  medicationId,
  scheduledAt,
  localTime,
})

const kinds = (items: Pending[]): string[] => items.map((item) => item.kind)

// ── 오늘 기록 (U11 테스트 목록) ─────────────────────────────────────────

describe('오늘 기록', () => {
  it('그 날짜의 기록이 있으면 할 일이 아니다', () => {
    expect(pendingItems(base({ logs: [{ date: TODAY }] }))).toEqual([])
  })

  it('그 날짜의 기록이 없으면 날짜와 함께 돌려준다', () => {
    expect(pendingItems(base({ logs: [] }))).toEqual([
      { kind: 'today_log_missing', date: TODAY },
    ])
  })

  it('다른 날짜의 기록은 오늘을 채워 주지 않는다', () => {
    expect(kinds(pendingItems(base({ logs: [{ date: '2026-09-08' }] })))).toEqual([
      'today_log_missing',
    ])
  })

  /**
   * 04:00 이전이면 `targetDate` 가 어제입니다 (TECH_SPEC 3-2).
   * **이 함수는 그 계산을 하지 않고 받습니다** — `NIGHT_CUTOFF_HOUR` 가
   * 두 곳에 생기지 않게 한 것입니다. 여기서는 받은 날짜를 그대로 쓰는지만 봅니다.
   */
  it('targetDate 가 어제면 어제 기록을 본다', () => {
    const yesterday = '2026-09-08'
    // 어제 기록이 있으니 할 일이 아닙니다. 오늘 기록이 없어도 묻지 않습니다.
    expect(
      pendingItems(base({ targetDate: yesterday, logs: [{ date: yesterday }] })),
    ).toEqual([])
    // 어제 기록이 없으면 어제 날짜로 돌려줍니다.
    expect(pendingItems(base({ targetDate: yesterday, logs: [{ date: TODAY }] }))).toEqual([
      { kind: 'today_log_missing', date: yesterday },
    ])
  })
})

// ── 지난 약 시각 (U11 테스트 목록) ──────────────────────────────────────

describe('지난 약 시각', () => {
  const eightAm = '2026-09-09T00:00:00.000Z' // KST 09:00 — 정오보다 이전
  const eightPm = '2026-09-09T11:00:00.000Z' // KST 20:00 — 정오보다 이후

  it('이미 지났고 기록이 없으면 돌려준다', () => {
    const items = pendingItems(base({ occurrences: [occurrence('med-1', eightAm, '09:00')] }))
    expect(items).toEqual([
      { kind: 'med_due', occurrence: occurrence('med-1', eightAm, '09:00') },
    ])
  })

  it('아직 오지 않은 예정은 돌려주지 않는다', () => {
    expect(pendingItems(base({ occurrences: [occurrence('med-1', eightPm, '20:00')] }))).toEqual(
      [],
    )
  })

  it('지났지만 기록이 있으면 돌려주지 않는다', () => {
    const items = pendingItems(
      base({
        occurrences: [occurrence('med-1', eightAm, '09:00')],
        medLogs: [{ medication_id: 'med-1', scheduled_at: eightAm }],
      }),
    )
    expect(items).toEqual([])
  })

  it('다른 약·다른 시각의 기록은 이 예정을 채워 주지 않는다', () => {
    const withOtherMed = pendingItems(
      base({
        occurrences: [occurrence('med-1', eightAm, '09:00')],
        medLogs: [{ medication_id: 'med-2', scheduled_at: eightAm }],
      }),
    )
    expect(kinds(withOtherMed)).toEqual(['med_due'])

    const withOtherTime = pendingItems(
      base({
        occurrences: [occurrence('med-1', eightAm, '09:00')],
        medLogs: [{ medication_id: 'med-1', scheduled_at: eightPm }],
      }),
    )
    expect(kinds(withOtherTime)).toEqual(['med_due'])
  })

  /**
   * `nextOccurrence` 가 "`now` 와 정확히 같은 순간은 아직 지나지 않은 것"으로
   * 보므로 여기서도 같게 둡니다. 두 함수가 같은 순간을 서로 다르게 보면
   * 20:00 정각에 그 약이 두 카드에 동시에 뜨거나 어느 쪽에도 안 뜹니다.
   */
  it('now 와 정확히 같은 순간은 아직 지나지 않은 것으로 본다', () => {
    const exact = TZ_NOON.toISOString()
    expect(pendingItems(base({ occurrences: [occurrence('med-1', exact, '12:00')] }))).toEqual([])

    const oneMsEarlier = new Date(TZ_NOON.getTime() - 1).toISOString()
    expect(
      kinds(pendingItems(base({ occurrences: [occurrence('med-1', oneMsEarlier, '12:00')] }))),
    ).toEqual(['med_due'])
  })

  it('밀린 것이 여러 개면 이른 것부터 전부 돌려준다', () => {
    const items = pendingItems(
      base({
        occurrences: [
          occurrence('med-1', '2026-09-09T02:00:00.000Z', '11:00'),
          occurrence('med-2', '2026-09-08T00:00:00.000Z', '09:00'),
          occurrence('med-1', '2026-09-09T01:00:00.000Z', '10:00'),
          // 아직 안 온 것은 섞여 있어도 빠집니다.
          occurrence('med-2', eightPm, '20:00'),
        ],
      }),
    )
    expect(items.map((item) => (item.kind === 'med_due' ? item.occurrence.scheduledAt : ''))).toEqual(
      [
        '2026-09-08T00:00:00.000Z',
        '2026-09-09T01:00:00.000Z',
        '2026-09-09T02:00:00.000Z',
      ],
    )
  })

  it('같은 순간이 겹쳐도 순서가 뒤집히지 않는다', () => {
    const same = '2026-09-09T01:00:00.000Z'
    const items = pendingItems(
      base({ occurrences: [occurrence('med-1', same, '10:00'), occurrence('med-2', same, '10:00')] }),
    )
    expect(items).toHaveLength(2)
  })

  it('넘겨준 배열을 고치지 않는다', () => {
    const given = [
      occurrence('med-1', '2026-09-09T02:00:00.000Z', '11:00'),
      occurrence('med-2', '2026-09-09T01:00:00.000Z', '10:00'),
    ]
    const before = given.map((item) => item.scheduledAt)
    pendingItems(base({ occurrences: given }))
    expect(given.map((item) => item.scheduledAt)).toEqual(before)
  })
})

// ── 체중 주기 ───────────────────────────────────────────────────────────

describe('체중 주기', () => {
  it('한 번도 없으면 할 일이다', () => {
    expect(kinds(pendingItems(base({ latestWeightDate: null })))).toEqual(['weight_due'])
  })

  it('간격이 지나야 할 일이 된다', () => {
    const dayBefore = (days: number): string => {
      const shifted = new Date(Date.UTC(2026, 8, 9 - days))
      return shifted.toISOString().slice(0, 10)
    }
    // 경계 바로 앞은 아직 아닙니다.
    expect(pendingItems(base({ latestWeightDate: dayBefore(WEIGHT_INTERVAL_DAYS - 1) }))).toEqual(
      [],
    )
    // 경계에서 할 일이 됩니다.
    expect(
      kinds(pendingItems(base({ latestWeightDate: dayBefore(WEIGHT_INTERVAL_DAYS) }))),
    ).toEqual(['weight_due'])
    expect(
      kinds(pendingItems(base({ latestWeightDate: dayBefore(WEIGHT_INTERVAL_DAYS + 30) }))),
    ).toEqual(['weight_due'])
  })

  it('오늘 쟀으면 할 일이 아니다', () => {
    expect(pendingItems(base({ latestWeightDate: TODAY }))).toEqual([])
  })

  it('미래 날짜가 들어오면 할 일이 아니다', () => {
    // 잘못된 데이터입니다. 음수 간격을 "지났다"로 읽지 않습니다.
    expect(pendingItems(base({ latestWeightDate: '2026-12-25' }))).toEqual([])
  })

  it('날짜 형식이 아니면 던진다', () => {
    expect(() => pendingItems(base({ latestWeightDate: '2026-9-9' }))).toThrow(
      'YYYY-MM-DD 형식이 아닙니다',
    )
  })
})

// ── 순서와 조합 ─────────────────────────────────────────────────────────

describe('순서', () => {
  it('오늘 기록 → 지난 약 → 체중 순서다 (TECH_SPEC 8-1)', () => {
    const items = pendingItems(
      base({
        logs: [],
        occurrences: [occurrence('med-1', '2026-09-09T00:00:00.000Z', '09:00')],
        latestWeightDate: null,
      }),
    )
    expect(kinds(items)).toEqual(['today_log_missing', 'med_due', 'weight_due'])
  })

  it('할 일이 없으면 빈 배열이다', () => {
    expect(pendingItems(base())).toEqual([])
  })
})

// ── 지적하지 않는다는 계약 ──────────────────────────────────────────────

describe('표현 규칙 (원칙 P6)', () => {
  /**
   * **며칠 밀렸는지를 돌려주지 않는 것이 계약입니다.** 세지 않으면 화면이
   * 시간 경과를 강조할 수 없습니다 (TECH_SPEC 8-1 "시간 경과를 강조하지
   * 않고 담백하게"). 여기에 `daysLate` 같은 필드를 더하지 마세요.
   */
  it('경과 일수·건수를 담지 않는다', () => {
    const items = pendingItems(
      base({
        logs: [],
        occurrences: [occurrence('med-1', '2026-08-01T00:00:00.000Z', '09:00')],
        latestWeightDate: '2025-01-01',
      }),
    )
    const keys = items.flatMap((item) => Object.keys(item))
    for (const forbidden of ['daysLate', 'days', 'count', 'overdue', 'missed', 'streak']) {
      expect(keys).not.toContain(forbidden)
    }
    expect(new Set(keys)).toEqual(new Set(['kind', 'date', 'occurrence']))
  })

  it('힘든 날을 보지 않는다 — 입력에 overall 이 필요 없다', () => {
    // `DailyLog` 의 최소 모양이 `{ date }` 뿐입니다. 컨디션을 안 받으므로
    // 이 함수가 힘든 날을 셀 방법이 아예 없습니다 (원칙 P2).
    expect(pendingItems(base({ logs: [{ date: TODAY }] }))).toEqual([])
  })
})
