import { describe, expect, it } from 'vitest'
import {
  countGood,
  monthComparison,
  weekDots,
  type DailyLog,
  type Dot,
} from '../src/domain/goodDays'

const log = (date: string, overall: DailyLog['overall']): DailyLog => ({ date, overall })

describe('countGood', () => {
  it('기록이 0건이면 0 이다', () => {
    expect(countGood([])).toBe(0)
  })

  it('기록이 1건이면 그것만 본다', () => {
    expect(countGood([log('2026-09-09', 'good')])).toBe(1)
    expect(countGood([log('2026-09-09', 'hard')])).toBe(0)
  })

  it('좋은 날만 센다', () => {
    const logs = [
      log('2026-09-07', 'good'),
      log('2026-09-08', 'okay'),
      log('2026-09-09', 'hard'),
      log('2026-09-10', 'good'),
    ]
    expect(countGood(logs)).toBe(2)
  })
})

describe('weekDots', () => {
  const MONDAY = '2026-09-07'

  it('항상 7개를 돌려준다', () => {
    expect(weekDots([], MONDAY)).toHaveLength(7)
    expect(weekDots([log(MONDAY, 'good')], MONDAY)).toHaveLength(7)
  })

  it('기록이 0건이면 전부 none 이다', () => {
    expect(weekDots([], MONDAY)).toEqual<Dot[]>([
      'none', 'none', 'none', 'none', 'none', 'none', 'none',
    ])
  })

  it('good·okay·hard 를 filled·empty·gray 로 옮긴다', () => {
    const logs = [
      log('2026-09-07', 'good'),
      log('2026-09-08', 'okay'),
      log('2026-09-09', 'hard'),
    ]
    expect(weekDots(logs, MONDAY).slice(0, 3)).toEqual<Dot[]>(['filled', 'empty', 'gray'])
  })

  it('빈 날이 섞여도 자리를 지킨다', () => {
    // 월·수·일만 기록. PRD FR-5 의 "● ● ○ ● ● ● ·" 같은 모양입니다.
    const logs = [
      log('2026-09-07', 'good'),
      log('2026-09-09', 'okay'),
      log('2026-09-13', 'hard'),
    ]
    expect(weekDots(logs, MONDAY)).toEqual<Dot[]>([
      'filled', 'none', 'empty', 'none', 'none', 'none', 'gray',
    ])
  })

  it('주 바깥의 기록은 무시한다', () => {
    const logs = [
      log('2026-09-06', 'good'), // 전주 일요일
      log('2026-09-14', 'good'), // 다음 주 월요일
    ]
    expect(weekDots(logs, MONDAY).every((dot) => dot === 'none')).toBe(true)
  })

  it('월을 넘기는 주도 이어 붙인다', () => {
    const logs = [log('2026-09-30', 'good'), log('2026-10-01', 'hard')]
    expect(weekDots(logs, '2026-09-28').slice(2, 4)).toEqual<Dot[]>(['filled', 'gray'])
  })

  it('같은 날짜가 여러 건이면 먼저 나온 것을 쓴다', () => {
    const logs = [log(MONDAY, 'good'), log(MONDAY, 'hard')]
    expect(weekDots(logs, MONDAY)[0]).toBe<Dot>('filled')
  })

  it("반환값에 'red' 가 없다", () => {
    const logs = [
      log('2026-09-07', 'good'),
      log('2026-09-08', 'okay'),
      log('2026-09-09', 'hard'),
    ]
    const dots: Dot[] = weekDots(logs, MONDAY)

    // @ts-expect-error 'red' 는 Dot 에 존재하지 않습니다 (PRD 원칙 P6 · PRD 11-3)
    const forbidden: Dot = 'red'

    expect(dots).not.toContain(forbidden)
    expect(dots.every((dot) => dot !== forbidden)).toBe(true)
  })

  it('형식이 틀린 weekStart 면 던진다', () => {
    expect(() => weekDots([], '2026-9-7')).toThrow()
  })
})

describe('monthComparison — 감소한 달에 null 을 돌려주는 것이 계약이다', () => {
  const good = (count: number): DailyLog[] =>
    Array.from({ length: count }, (_unused, i) => log(`2026-09-${String(i + 1).padStart(2, '0')}`, 'good'))

  it('늘어난 달에만 값을 돌려준다', () => {
    expect(monthComparison(good(8), good(5))).toEqual({ text: '지난달보다 3일 더' })
  })

  it('줄어든 달에는 null 이다', () => {
    expect(monthComparison(good(5), good(8))).toBeNull()
  })

  it('같은 달에도 null 이다', () => {
    expect(monthComparison(good(5), good(5))).toBeNull()
  })

  it('한 개 차이도 잡는다', () => {
    expect(monthComparison(good(6), good(5))).toEqual({ text: '지난달보다 1일 더' })
    expect(monthComparison(good(5), good(6))).toBeNull()
  })

  it('양쪽 다 기록 0건이면 null 이다', () => {
    expect(monthComparison([], [])).toBeNull()
  })

  it('지난달이 0건이고 이번 달에 기록이 생기면 증가로 본다', () => {
    expect(monthComparison(good(1), [])).toEqual({ text: '지난달보다 1일 더' })
  })

  it('좋은 날이 아닌 기록은 비교에 넣지 않는다', () => {
    const thisMonth = [log('2026-09-01', 'good'), log('2026-09-02', 'hard'), log('2026-09-03', 'okay')]
    const lastMonth = [log('2026-08-01', 'good')]
    // 좋은 날은 양쪽 다 1건이므로 동일 → null
    expect(monthComparison(thisMonth, lastMonth)).toBeNull()
  })

  it('힘든 날이 늘어도 좋은 날이 같으면 아무 말도 하지 않는다', () => {
    const thisMonth = [log('2026-09-01', 'good'), log('2026-09-02', 'hard'), log('2026-09-03', 'hard')]
    const lastMonth = [log('2026-08-01', 'good')]
    expect(monthComparison(thisMonth, lastMonth)).toBeNull()
  })
})
