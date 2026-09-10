/**
 * 약 스케줄 · 컴플라이언스 (U06, TECH_SPEC 7-3).
 *
 * 이 단위의 정확도가 요약서 3번 블록의 신뢰입니다 (PRD FR-8-3). 수의사가
 * 노령 진료에서 가장 먼저 보는 숫자라, 여기가 틀리면 약효 판단이 틀립니다.
 *
 * 매직 넘버에는 유도 과정을 같이 적습니다. 나중에 값이 어긋났을 때
 * 코드를 의심할지 기대값을 의심할지 알 수 있어야 합니다 (U04 에서 배운 것).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LOOKAHEAD_DAYS,
  compliance,
  expectedOccurrences,
  nextOccurrence,
  type Medication,
  type MedicationLog,
} from '../src/domain/medSchedule'

const SEOUL = 'Asia/Seoul'
const NY = 'America/New_York'

const med = (over: Partial<Medication> & { id: string }): Medication => ({
  schedule_times: ['08:00', '20:00'],
  started_at: '2026-01-01',
  ended_at: null,
  is_active: true,
  ...over,
})

const log = (
  medicationId: string,
  scheduledAt: string,
  status: MedicationLog['status'],
  note: string | null = null,
): MedicationLog => ({ medication_id: medicationId, scheduled_at: scheduledAt, status, note })

/** 서울의 그 날 그 시각을 순간으로. KST 는 UTC+9 로 고정입니다. */
const kst = (date: string, time: string): string => `${date}T${time}:00.000Z`

describe('expectedOccurrences', () => {
  it('하루 2회를 순간 오름차순으로 돌려준다', () => {
    const result = expectedOccurrences([med({ id: 'a' })], '2026-09-09', '2026-09-09', SEOUL)

    // KST 08:00 은 전날 23:00Z, KST 20:00 은 같은 날 11:00Z 입니다.
    expect(result).toEqual([
      { medicationId: 'a', scheduledAt: kst('2026-09-08', '23:00'), localTime: '08:00' },
      { medicationId: 'a', scheduledAt: kst('2026-09-09', '11:00'), localTime: '20:00' },
    ])
  })

  it('자정을 넘는다 — 로컬 날짜와 UTC 날짜가 다르다', () => {
    const [morning] = expectedOccurrences([med({ id: 'a' })], '2026-09-09', '2026-09-09', SEOUL)

    expect(morning?.localTime).toBe('08:00')
    // 로컬로는 9일 아침인데 UTC 로는 8일 밤입니다. UTC 로 잘라 날짜를
    // 만들면 이 급여가 하루 앞으로 밀립니다 (TECH_SPEC 3-2).
    expect(morning?.scheduledAt.slice(0, 10)).toBe('2026-09-08')
  })

  it('시각 배열이 뒤죽박죽이어도 순서대로 나온다', () => {
    const result = expectedOccurrences(
      [med({ id: 'a', schedule_times: ['20:00', '08:00', '13:00'] })],
      '2026-09-09',
      '2026-09-09',
      SEOUL,
    )
    expect(result.map((o) => o.localTime)).toEqual(['08:00', '13:00', '20:00'])
  })

  it('하루 3회 × 5일 = 15회', () => {
    const result = expectedOccurrences(
      [med({ id: 'a', schedule_times: ['08:00', '14:00', '20:00'] })],
      '2026-09-01',
      '2026-09-05',
      SEOUL,
    )
    expect(result).toHaveLength(15)
  })

  it('경계 양끝을 포함한다', () => {
    // 9/1 부터 9/5 까지는 5일입니다 (양끝 포함). 하루 2회면 10회.
    const result = expectedOccurrences([med({ id: 'a' })], '2026-09-01', '2026-09-05', SEOUL)
    expect(result).toHaveLength(10)
  })

  it('to 가 from 보다 이르면 비어 있다', () => {
    expect(expectedOccurrences([med({ id: 'a' })], '2026-09-05', '2026-09-01', SEOUL)).toEqual([])
  })

  it('기간 중간에 시작하는 약은 시작일부터 센다', () => {
    const result = expectedOccurrences(
      [med({ id: 'a', started_at: '2026-09-03' })],
      '2026-09-01',
      '2026-09-05',
      SEOUL,
    )
    // 9/3·9/4·9/5 = 3일 × 2회 = 6회
    expect(result).toHaveLength(6)
    expect(result[0]?.scheduledAt).toBe(kst('2026-09-02', '23:00')) // 9/3 08:00 KST
  })

  it('기간 중간에 끝나는 약은 종료일까지만 센다', () => {
    const result = expectedOccurrences(
      [med({ id: 'a', ended_at: '2026-09-03' })],
      '2026-09-01',
      '2026-09-05',
      SEOUL,
    )
    // 9/1·9/2·9/3 = 3일 × 2회 = 6회. ended_at 당일은 포함합니다.
    expect(result).toHaveLength(6)
    expect(result.at(-1)?.scheduledAt).toBe(kst('2026-09-03', '11:00')) // 9/3 20:00 KST
  })

  it('종료일이 기간보다 뒤면 기간 끝까지만 센다', () => {
    const result = expectedOccurrences(
      [med({ id: 'a', ended_at: '2026-12-31' })],
      '2026-09-01',
      '2026-09-05',
      SEOUL,
    )
    expect(result).toHaveLength(10) // 5일 × 2회. ended_at 이 아니라 to 가 자릅니다
  })

  it('기간 안에서 시작하고 끝나는 약', () => {
    const result = expectedOccurrences(
      [med({ id: 'a', started_at: '2026-09-02', ended_at: '2026-09-04' })],
      '2026-09-01',
      '2026-09-05',
      SEOUL,
    )
    expect(result).toHaveLength(6) // 9/2·9/3·9/4
  })

  it('기간과 겹치지 않는 약은 아예 빠진다 — 비활성 약이 이 경로로 제외된다', () => {
    // 약을 끊으면 ended_at 이 채워집니다 (TECH_SPEC 4-3). 그 뒤 기간에는
    // 예정이 하나도 없습니다.
    const stopped = med({ id: 'a', ended_at: '2026-01-31', is_active: false })
    expect(expectedOccurrences([stopped], '2026-09-01', '2026-09-05', SEOUL)).toEqual([])

    // 아직 시작하지 않은 약도 같습니다.
    const future = med({ id: 'b', started_at: '2026-12-01' })
    expect(expectedOccurrences([future], '2026-09-01', '2026-09-05', SEOUL)).toEqual([])
  })

  it('is_active 가 거짓이어도 자기 구간 안에서는 그대로 센다', () => {
    // 완료 판정 2 의 핵심입니다. 지금 값(is_active)으로 과거 횟수를 바꾸면
    // 스케줄을 바꾸는 순간 지난달 컴플라이언스가 조용히 달라집니다.
    const closed = med({ id: 'a', started_at: '2026-01-01', ended_at: '2026-01-31', is_active: false })
    expect(expectedOccurrences([closed], '2026-01-01', '2026-01-31', SEOUL)).toHaveLength(62)
  })

  it('여러 약을 순간 기준으로 섞어서 정렬한다', () => {
    const result = expectedOccurrences(
      [med({ id: 'b', schedule_times: ['09:00'] }), med({ id: 'a', schedule_times: ['08:00'] })],
      '2026-09-09',
      '2026-09-09',
      SEOUL,
    )
    expect(result.map((o) => [o.medicationId, o.localTime])).toEqual([
      ['a', '08:00'],
      ['b', '09:00'],
    ])
  })

  it('같은 순간이면 약 id 로 순서를 고정한다', () => {
    const result = expectedOccurrences(
      [med({ id: 'b', schedule_times: ['08:00'] }), med({ id: 'a', schedule_times: ['08:00'] })],
      '2026-09-09',
      '2026-09-09',
      SEOUL,
    )
    expect(result.map((o) => o.medicationId)).toEqual(['a', 'b'])
  })

  it('시각이 없는 약은 아무것도 만들지 않는다', () => {
    expect(expectedOccurrences([med({ id: 'a', schedule_times: [] })], '2026-09-01', '2026-09-05', SEOUL)).toEqual([])
  })

  it('같은 시각이 두 번 적혀 있어도 한 번만 센다', () => {
    // &[medication_id+scheduled_at] 이 유니크라 둘 다 기록될 수 없습니다.
    // expected 만 늘면 그 약은 영원히 unrecorded 를 답니다.
    const result = expectedOccurrences(
      [med({ id: 'a', schedule_times: ['08:00', '08:00'] })],
      '2026-09-09',
      '2026-09-09',
      SEOUL,
    )
    expect(result).toHaveLength(1)
  })

  it('형식이 틀린 날짜·시각은 던진다', () => {
    expect(() => expectedOccurrences([med({ id: 'a' })], '2026-9-9', '2026-09-09', SEOUL)).toThrow(
      /YYYY-MM-DD/,
    )
    expect(() =>
      expectedOccurrences([med({ id: 'a', schedule_times: ['8:00'] })], '2026-09-09', '2026-09-09', SEOUL),
    ).toThrow(/HH:mm/)
    expect(() =>
      expectedOccurrences([med({ id: 'a', schedule_times: ['24:00'] })], '2026-09-09', '2026-09-09', SEOUL),
    ).toThrow(/HH:mm/)
  })
})

describe('expectedOccurrences — 서머타임', () => {
  it('가을에 한 시간이 되풀이돼도 하루 횟수가 늘지 않는다', () => {
    // 뉴욕 2026-11-01 에 01:00~02:00 이 두 번 옵니다.
    const result = expectedOccurrences(
      [med({ id: 'a', schedule_times: ['01:30'], started_at: '2026-11-01', ended_at: '2026-11-01' })],
      '2026-11-01',
      '2026-11-01',
      NY,
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.scheduledAt).toBe('2026-11-01T05:30:00.000Z') // 첫 번째(EDT)
  })

  it('봄에 건너뛴 시각은 앞 시각으로 접히고, 겹치면 한 번만 남는다', () => {
    // 뉴욕 2026-03-08 에 02:00~03:00 이 없습니다. 02:30 은 01:30 과 같은
    // 순간이 되고, 유니크 제약 때문에 둘 다 기록될 수는 없습니다.
    const result = expectedOccurrences(
      [
        med({
          id: 'a',
          schedule_times: ['01:30', '02:30', '03:30'],
          started_at: '2026-03-08',
          ended_at: '2026-03-08',
        }),
      ],
      '2026-03-08',
      '2026-03-08',
      NY,
    )
    expect(result).toEqual([
      { medicationId: 'a', scheduledAt: '2026-03-08T06:30:00.000Z', localTime: '01:30' },
      { medicationId: 'a', scheduledAt: '2026-03-08T07:30:00.000Z', localTime: '03:30' },
    ])
  })

  it('서머타임을 건너도 하루 2회가 유지된다', () => {
    // 3/7 ~ 3/9 사흘 × 2회 = 6회. 3/8 이 23시간이어도 횟수는 그대로입니다.
    const result = expectedOccurrences(
      [med({ id: 'a', started_at: '2026-03-07', ended_at: '2026-03-09' })],
      '2026-03-07',
      '2026-03-09',
      NY,
    )
    expect(result).toHaveLength(6)
    expect(result.map((o) => o.localTime)).toEqual(['08:00', '20:00', '08:00', '20:00', '08:00', '20:00'])
  })
})

describe('스케줄 변경 — append-only (TECH_SPEC 4-3)', () => {
  /**
   * 9/1~9/10 동안 하루 2회로 먹다가, 9/6 부터 하루 3회로 바뀐 상황.
   * 옛 행은 ended_at = 9/5 로 닫히고 새 행이 9/6 부터 시작합니다.
   */
  const before = med({ id: 'old', schedule_times: ['08:00', '20:00'], started_at: '2026-09-01', ended_at: '2026-09-05', is_active: false })
  const after = med({ id: 'new', schedule_times: ['08:00', '14:00', '20:00'], started_at: '2026-09-06' })

  it('두 행으로 쪼개져도 예정 횟수의 합이 맞는다', () => {
    const all = expectedOccurrences([before, after], '2026-09-01', '2026-09-10', SEOUL)
    // 9/1~9/5 = 5일 × 2회 = 10, 9/6~9/10 = 5일 × 3회 = 15. 합 25.
    expect(all).toHaveLength(25)
    expect(all.filter((o) => o.medicationId === 'old')).toHaveLength(10)
    expect(all.filter((o) => o.medicationId === 'new')).toHaveLength(15)
  })

  it('두 구간이 겹치지 않는다', () => {
    const all = expectedOccurrences([before, after], '2026-09-01', '2026-09-10', SEOUL)
    const lastOld = all.filter((o) => o.medicationId === 'old').at(-1)
    const firstNew = all.filter((o) => o.medicationId === 'new')[0]
    expect(lastOld?.scheduledAt).toBe(kst('2026-09-05', '11:00')) // 9/5 20:00 KST
    expect(firstNew?.scheduledAt).toBe(kst('2026-09-05', '23:00')) // 9/6 08:00 KST
  })

  it('과거 expected 가 변하지 않는다 (완료 판정 2)', () => {
    // 스케줄이 바뀌기 전 기간만 물어보면, 변경 뒤에 물어도 같은 답입니다.
    const past = ['2026-09-01', '2026-09-05'] as const

    const beforeChange = expectedOccurrences([before], past[0], past[1], SEOUL)
    const afterChange = expectedOccurrences([before, after], past[0], past[1], SEOUL)

    expect(beforeChange).toHaveLength(10)
    expect(afterChange).toEqual(beforeChange)
  })

  it('컴플라이언스도 과거 기간에서 같은 값을 낸다', () => {
    const logs = [log('old', kst('2026-08-31', '23:00'), 'given')] // 9/1 08:00 KST

    const only = compliance([before], logs, '2026-09-01', '2026-09-05', SEOUL)
    const both = compliance([before, after], logs, '2026-09-01', '2026-09-05', SEOUL)

    expect(only.byMedication).toHaveLength(1)
    // 새 행은 이 기간에 예정이 없어 아예 나오지 않습니다.
    expect(both.byMedication).toEqual(only.byMedication)
    expect(only.byMedication[0]?.expected).toBe(10)
    expect(only.byMedication[0]?.given).toBe(1)
    expect(only.byMedication[0]?.unrecorded).toBe(9)
  })
})

describe('compliance', () => {
  const one = med({ id: 'a', schedule_times: ['08:00'], started_at: '2026-09-01' })
  const range = ['2026-09-01', '2026-09-05'] as const
  /** 9/1 ~ 9/5 의 08:00 KST 다섯 개. */
  const slots = [
    kst('2026-08-31', '23:00'),
    kst('2026-09-01', '23:00'),
    kst('2026-09-02', '23:00'),
    kst('2026-09-03', '23:00'),
    kst('2026-09-04', '23:00'),
  ]

  it('기록 0건이면 given=0, unrecorded=expected', () => {
    const result = compliance([one], [], range[0], range[1], SEOUL)
    expect(result.byMedication[0]).toMatchObject({
      expected: 5,
      given: 0,
      notGiven: 0,
      unrecorded: 5,
      regiven: [],
    })
  })

  it('unrecorded 와 notGiven 이 섞이지 않는다', () => {
    const logs = [
      log('a', slots[0]!, 'given'),
      log('a', slots[1]!, 'skipped'),
      log('a', slots[2]!, 'spat_out'),
      // 9/4·9/5 는 기록 자체가 없습니다.
    ]
    const result = compliance([one], logs, range[0], range[1], SEOUL)

    expect(result.byMedication[0]).toMatchObject({
      expected: 5,
      given: 1,
      notGiven: 2, // skipped + spat_out. "안 먹였다고 기록함"
      unrecorded: 2, // "기록이 없음". 임상적으로 다른 정보입니다
    })
  })

  it('unrecorded 가 expected - (given + notGiven) 과 일치한다 (완료 판정 1)', () => {
    const cases: MedicationLog[][] = [
      [],
      [log('a', slots[0]!, 'given')],
      [log('a', slots[0]!, 'skipped'), log('a', slots[1]!, 'spat_out')],
      [log('a', slots[0]!, 'regiven'), log('a', slots[1]!, 'given'), log('a', slots[2]!, 'skipped')],
      slots.map((slot) => log('a', slot, 'given')),
    ]

    for (const logs of cases) {
      const row = compliance([one], logs, range[0], range[1], SEOUL).byMedication[0]!
      expect(row.unrecorded).toBe(row.expected - (row.given + row.notGiven))
      expect(row.unrecorded).toBeGreaterThanOrEqual(0)
    }
  })

  it('regiven 이 given 에 포함되고 별도 목록에도 남는다', () => {
    const logs = [
      log('a', slots[0]!, 'given'),
      log('a', slots[1]!, 'regiven', '뱉어서 다시 줌'),
      log('a', slots[2]!, 'regiven', null),
    ]
    const row = compliance([one], logs, range[0], range[1], SEOUL).byMedication[0]!

    expect(row.given).toBe(3) // given 1 + regiven 2
    expect(row.notGiven).toBe(0)
    expect(row.regiven).toEqual([
      { date: '2026-09-02', note: '뱉어서 다시 줌' },
      { date: '2026-09-03', note: null },
    ])
  })

  it('regiven 의 date 는 UTC 가 아니라 기기 로컬 날짜다', () => {
    // 9/1 08:00 KST = 8/31 23:00Z. UTC 로 자르면 8월 31일이 됩니다.
    const row = compliance([one], [log('a', slots[0]!, 'regiven')], range[0], range[1], SEOUL)
      .byMedication[0]!
    expect(row.regiven[0]?.date).toBe('2026-09-01')
  })

  it('전부 먹였으면 unrecorded 가 0 이다', () => {
    const logs = slots.map((slot) => log('a', slot, 'given'))
    expect(compliance([one], logs, range[0], range[1], SEOUL).byMedication[0]).toMatchObject({
      expected: 5,
      given: 5,
      unrecorded: 0,
    })
  })

  it('다른 약의 기록을 세지 않는다', () => {
    const logs = [log('zzz', slots[0]!, 'given')]
    expect(compliance([one], logs, range[0], range[1], SEOUL).byMedication[0]?.given).toBe(0)
  })

  it('예정에 닿지 않는 기록을 세지 않는다', () => {
    // 08:00 이 예정인데 09:00 에 기록이 있는 경우. 세면 unrecorded 가
    // 음수가 됩니다.
    const logs = [log('a', kst('2026-09-01', '00:00'), 'given')]
    const row = compliance([one], logs, range[0], range[1], SEOUL).byMedication[0]!
    expect(row.given).toBe(0)
    expect(row.unrecorded).toBe(5)
  })

  it('기간 밖의 기록을 세지 않는다', () => {
    const logs = [log('a', kst('2026-09-05', '23:00'), 'given')] // 9/6 08:00 KST
    expect(compliance([one], logs, range[0], range[1], SEOUL).byMedication[0]?.given).toBe(0)
  })

  it('기간에 예정이 없는 약은 byMedication 에 넣지 않는다', () => {
    const stopped = med({ id: 'z', ended_at: '2026-01-31', is_active: false })
    const result = compliance([one, stopped], [], range[0], range[1], SEOUL)
    expect(result.byMedication.map((row) => row.medication.id)).toEqual(['a'])
  })

  it('약이 없으면 byMedication 이 비어 있다', () => {
    expect(compliance([], [], range[0], range[1], SEOUL)).toEqual({ byMedication: [] })
  })

  it('넘겨준 순서를 지킨다', () => {
    const b = med({ id: 'b', schedule_times: ['09:00'], started_at: '2026-09-01' })
    const result = compliance([b, one], [], range[0], range[1], SEOUL)
    expect(result.byMedication.map((row) => row.medication.id)).toEqual(['b', 'a'])
  })

  it('넘겨준 약 객체를 그대로 돌려준다 — 부르는 쪽 타입이 살아 있다', () => {
    const full = { ...one, name: '아모디핀', dose_text: '1/2정' }
    const row = compliance([full], [], range[0], range[1], SEOUL).byMedication[0]!
    expect(row.medication).toBe(full)
    // 제네릭이라 최소 모양으로 좁혀지지 않습니다. 요약서(U21)가 이걸 씁니다.
    expect(row.medication.name).toBe('아모디핀')
  })
})

describe('nextOccurrence', () => {
  const twice = med({ id: 'a', started_at: '2026-01-01' }) // 08:00 · 20:00

  it('now 다음 예정을 돌려준다', () => {
    // 9/9 12:00 KST = 03:00Z. 다음은 9/9 20:00 KST = 11:00Z.
    const now = new Date(kst('2026-09-09', '03:00'))
    expect(nextOccurrence([twice], [], now, SEOUL)).toEqual({
      medicationId: 'a',
      scheduledAt: kst('2026-09-09', '11:00'),
      localTime: '20:00',
    })
  })

  it('그날 마지막 예정이 지나면 다음 날 첫 예정으로 넘어간다', () => {
    // 9/9 21:00 KST = 12:00Z. 다음은 9/10 08:00 KST = 9/9 23:00Z.
    const now = new Date(kst('2026-09-09', '12:00'))
    expect(nextOccurrence([twice], [], now, SEOUL)?.scheduledAt).toBe(kst('2026-09-09', '23:00'))
  })

  it('now 와 정확히 같은 순간의 예정은 아직 지나지 않은 것으로 본다', () => {
    const at = kst('2026-09-09', '11:00') // 9/9 20:00 KST 정각
    expect(nextOccurrence([twice], [], new Date(at), SEOUL)?.scheduledAt).toBe(at)

    // 1밀리초만 지나면 다음으로 넘어갑니다.
    const past = new Date(new Date(at).getTime() + 1)
    expect(nextOccurrence([twice], [], past, SEOUL)?.scheduledAt).toBe(kst('2026-09-09', '23:00'))
  })

  it('이미 기록한 예정은 건너뛴다', () => {
    const now = new Date(kst('2026-09-09', '03:00'))
    const logs = [log('a', kst('2026-09-09', '11:00'), 'given')]
    expect(nextOccurrence([twice], logs, now, SEOUL)?.scheduledAt).toBe(kst('2026-09-09', '23:00'))
  })

  it('안 먹였다고 기록한 것도 기록된 것이다', () => {
    const now = new Date(kst('2026-09-09', '03:00'))
    const logs = [log('a', kst('2026-09-09', '11:00'), 'skipped')]
    expect(nextOccurrence([twice], logs, now, SEOUL)?.scheduledAt).toBe(kst('2026-09-09', '23:00'))
  })

  it('지나간 예정은 기록이 없어도 돌려주지 않는다', () => {
    // 9/9 12:00 KST 인데 아침 08:00 약을 기록하지 않았습니다. 계약이
    // "now 이후"라 아침 약은 나오지 않습니다 (TECH_SPEC 7-3).
    // 놓친 약을 어떻게 보여줄지는 홈(U11)이 정할 문제입니다.
    const now = new Date(kst('2026-09-09', '03:00'))
    const result = nextOccurrence([twice], [], now, SEOUL)
    expect(result?.localTime).toBe('20:00')
  })

  it('비활성 약은 제안하지 않는다', () => {
    const now = new Date(kst('2026-09-09', '03:00'))
    const paused = med({ id: 'a', is_active: false })
    expect(nextOccurrence([paused], [], now, SEOUL)).toBeNull()
  })

  it('종료된 약은 제안하지 않는다', () => {
    const now = new Date(kst('2026-09-09', '03:00'))
    const done = med({ id: 'a', ended_at: '2026-09-08' })
    expect(nextOccurrence([done], [], now, SEOUL)).toBeNull()
  })

  it('여러 약 중 가장 가까운 것을 고른다', () => {
    const now = new Date(kst('2026-09-09', '03:00')) // 9/9 12:00 KST
    const evening = med({ id: 'a', schedule_times: ['20:00'] })
    const afternoon = med({ id: 'b', schedule_times: ['14:00'] })
    expect(nextOccurrence([evening, afternoon], [], now, SEOUL)?.medicationId).toBe('b')
  })

  it('약이 없으면 null 이다', () => {
    expect(nextOccurrence([], [], new Date(kst('2026-09-09', '03:00')), SEOUL)).toBeNull()
  })

  it('앞으로 며칠 뒤에 시작하는 약도 찾는다', () => {
    const now = new Date(kst('2026-09-09', '03:00'))
    const soon = med({ id: 'a', started_at: '2026-09-12' })
    expect(nextOccurrence([soon], [], now, SEOUL)?.scheduledAt).toBe(kst('2026-09-11', '23:00'))
  })

  it('LOOKAHEAD_DAYS 너머는 보지 않는다', () => {
    const now = new Date(kst('2026-09-09', '03:00'))
    // 30일 뒤까지만 봅니다. 그 너머에 시작하는 약은 null 입니다.
    const far = med({ id: 'a', started_at: '2026-11-01' })
    expect(nextOccurrence([far], [], now, SEOUL)).toBeNull()
    expect(LOOKAHEAD_DAYS).toBe(30)
  })

  it('모든 예정이 기록되어 있으면 null 이다', () => {
    const now = new Date(kst('2026-09-09', '03:00'))
    const oneDay = med({ id: 'a', schedule_times: ['20:00'], started_at: '2026-09-09', ended_at: '2026-09-09' })
    const logs = [log('a', kst('2026-09-09', '11:00'), 'given')]
    expect(nextOccurrence([oneDay], logs, now, SEOUL)).toBeNull()
  })
})

describe('방어선', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Intl 이 날짜 부품을 주지 않으면 던진다', () => {
    // 실제로 일어나지 않는 상황이지만, 조용히 NaN 이 흘러가면 예정 급여가
    // Invalid Date 로 저장됩니다. 방어선이 정말 던지는지 확인합니다.
    vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockReturnValue([])
    expect(() => expectedOccurrences([med({ id: 'a' })], '2026-09-09', '2026-09-09', SEOUL)).toThrow(
      /날짜 부품 year 를 읽지 못했습니다/,
    )
  })
})
