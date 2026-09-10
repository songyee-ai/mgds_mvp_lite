import { describe, expect, it, vi } from 'vitest'
import {
  NIGHT_CUTOFF_HOUR,
  addDays,
  ageText,
  daysTogether,
  diffDays,
  recordingTargetDate,
  today,
} from '../src/domain/dates'

const SEOUL = 'Asia/Seoul'
const NEW_YORK = 'America/New_York'

/** 한국 로컬 시각을 UTC 순간으로. 한국은 서머타임이 없어 항상 UTC+9 입니다. */
const seoul = (text: string): Date => new Date(`${text}+09:00`)

describe('today', () => {
  it('UTC 로 자르면 전날이 되는 시각을 당일로 본다', () => {
    // 한국 오전 9시 이전은 UTC 로는 아직 전날입니다.
    // 이 한 줄이 TECH_SPEC 3-2 가 경고하는 버그 전체입니다.
    const dawn = seoul('2026-09-09T08:59:59')
    expect(dawn.toISOString().slice(0, 10)).toBe('2026-09-08')
    expect(today(dawn, SEOUL)).toBe('2026-09-09')
  })

  it('자정 직전·직후에 날짜가 바뀐다', () => {
    expect(today(seoul('2026-09-09T23:59:59'), SEOUL)).toBe('2026-09-09')
    expect(today(seoul('2026-09-10T00:00:00'), SEOUL)).toBe('2026-09-10')
  })

  it('같은 순간이라도 타임존이 다르면 날짜가 다르다', () => {
    const instant = seoul('2026-09-09T10:00:00') // 뉴욕은 아직 9월 8일 저녁
    expect(today(instant, SEOUL)).toBe('2026-09-09')
    expect(today(instant, NEW_YORK)).toBe('2026-09-08')
  })

  it('연말을 넘긴다', () => {
    expect(today(seoul('2027-01-01T00:00:00'), SEOUL)).toBe('2027-01-01')
  })

  it('읽을 수 없는 타임존이면 던진다', () => {
    expect(() => today(seoul('2026-09-09T10:00:00'), '없는/타임존')).toThrow()
  })

  it('달력 부품이 비어 오면 조용히 NaN 을 만들지 않고 던진다', () => {
    // Intl 이 요청한 부품을 안 주는 상황은 실제로는 없습니다. 다만 그때
    // "2026-NaN-NaN" 같은 값이 DB 로 흘러가면 안 되므로 방어선을 테스트합니다.
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockReturnValue([])
    expect(() => today(seoul('2026-09-09T10:00:00'), SEOUL)).toThrow('날짜 부품')
    spy.mockRestore()
  })
})

describe('recordingTargetDate — 밤중 서성임', () => {
  it('경계값이 04:00 이다', () => {
    expect(NIGHT_CUTOFF_HOUR).toBe(4)
  })

  it('자정 직후는 전날로 제시한다', () => {
    expect(recordingTargetDate(seoul('2026-09-10T00:00:00'), SEOUL)).toBe('2026-09-09')
  })

  it('새벽 2시는 전날로 제시한다', () => {
    expect(recordingTargetDate(seoul('2026-09-10T02:00:00'), SEOUL)).toBe('2026-09-09')
  })

  it('03:59 는 전날, 04:00 은 당일이다', () => {
    expect(recordingTargetDate(seoul('2026-09-10T03:59:59'), SEOUL)).toBe('2026-09-09')
    expect(recordingTargetDate(seoul('2026-09-10T04:00:00'), SEOUL)).toBe('2026-09-10')
  })

  it('자정 직전은 당일이다', () => {
    expect(recordingTargetDate(seoul('2026-09-09T23:59:59'), SEOUL)).toBe('2026-09-09')
  })

  it('달 첫날 새벽이면 전달 마지막 날로 넘어간다', () => {
    expect(recordingTargetDate(seoul('2026-10-01T01:00:00'), SEOUL)).toBe('2026-09-30')
    expect(recordingTargetDate(seoul('2027-01-01T01:00:00'), SEOUL)).toBe('2026-12-31')
  })
})

describe('addDays · diffDays — 달력 산술', () => {
  it('월·연을 넘긴다', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('윤년 2월 29일을 안다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('0 을 더하면 그대로다', () => {
    expect(addDays('2026-09-09', 0)).toBe('2026-09-09')
  })

  it('서머타임이 낀 구간에서도 하루가 하루다', () => {
    // 미국 서머타임 시작(2026-03-08). 밀리초 산술이면 여기서 어긋납니다.
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2)
  })

  it('거꾸로면 음수다', () => {
    expect(diffDays('2026-09-10', '2026-09-09')).toBe(-1)
    expect(diffDays('2026-09-09', '2026-09-09')).toBe(0)
  })

  it('형식이 틀리면 던진다', () => {
    expect(() => addDays('2026-9-9', 1)).toThrow()
    expect(() => diffDays('어제', '2026-09-09')).toThrow()
  })
})

describe('daysTogether', () => {
  const now = seoul('2026-09-09T10:00:00')

  it('첫날이 1일이다', () => {
    expect(daysTogether('2026-09-09', '2026-09-09', now, SEOUL)).toBe(1)
  })

  it('생일이 있으면 등록일이 아니라 생일 기준으로 센다', () => {
    // 2013-01-01 → 2026-01-01 : 13년 = 4,745일 + 윤일 3개(2016·2020·2024) = 4,748일
    // 2026-01-01 → 2026-09-09 : 251일 (9월 9일은 그 해 252번째 날)
    // 경과 4,999일 + 첫날 1일 = 5,000
    expect(daysTogether('2013-01-01', '2026-01-01', now, SEOUL)).toBe(5000)
    // 등록일(2026-01-01)로 셌다면 253 이었을 값입니다.
    expect(daysTogether(null, '2026-01-01', now, SEOUL)).toBe(252)
  })

  it('생일이 없으면 등록일 기준으로 센다', () => {
    expect(daysTogether(null, '2026-09-01', now, SEOUL)).toBe(9)
  })

  it('매일 하나씩 올라간다', () => {
    const before = daysTogether('2026-09-01', '2026-09-01', seoul('2026-09-09T23:00:00'), SEOUL)
    const after = daysTogether('2026-09-01', '2026-09-01', seoul('2026-09-10T00:00:00'), SEOUL)
    expect(after).toBe(before + 1)
  })

  it('기준일이 미래면 0 이다 — 음수를 화면에 내보내지 않는다', () => {
    expect(daysTogether('2026-12-25', '2026-12-25', now, SEOUL)).toBe(0)
  })

  it('타임존을 따른다', () => {
    // 한국은 9월 9일, 뉴욕은 아직 9월 8일이라 하루 차이가 납니다.
    expect(daysTogether('2026-09-01', '2026-09-01', now, SEOUL)).toBe(9)
    expect(daysTogether('2026-09-01', '2026-09-01', now, NEW_YORK)).toBe(8)
  })
})

describe('ageText', () => {
  const now = new Date('2026-09-09T00:00:00Z')

  it('연과 개월을 함께 적는다', () => {
    expect(ageText('2013-05-09', false, now)).toBe('13살 4개월')
  })

  it('개월이 0 이면 연만 적는다', () => {
    expect(ageText('2013-09-09', false, now)).toBe('13살')
  })

  it('한 살이 안 되면 개월만 적는다', () => {
    expect(ageText('2026-05-09', false, now)).toBe('4개월')
  })

  it('생일이 이번 달에 아직 안 왔으면 한 달 덜 센다', () => {
    expect(ageText('2013-09-10', false, now)).toBe('12살 11개월')
    expect(ageText('2013-09-09', false, now)).toBe('13살')
  })

  it('birth_is_approximate 면 "약 N살" 로 적는다', () => {
    expect(ageText('2013-05-09', true, now)).toBe('약 13살')
    expect(ageText('2013-09-10', true, now)).toBe('약 12살')
  })

  it('birth_is_approximate 인데 한 살이 안 되면 개월로 적는다', () => {
    expect(ageText('2026-05-09', true, now)).toBe('약 4개월')
  })

  it('태어난 달이면 0개월이다', () => {
    expect(ageText('2026-09-01', false, now)).toBe('0개월')
  })

  it('생일이 미래면 0개월이다 — 음수 나이를 만들지 않는다', () => {
    expect(ageText('2027-01-01', false, now)).toBe('0개월')
    expect(ageText('2027-01-01', true, now)).toBe('약 0개월')
  })

  it('형식이 틀리면 던진다', () => {
    expect(() => ageText('2013/05/09', false, now)).toThrow()
  })
})
