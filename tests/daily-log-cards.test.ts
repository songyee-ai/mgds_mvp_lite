/**
 * 카드 5장의 구조 계약 (U08 T-unit).
 *
 * 화면을 렌더하지 않고 봅니다. "탭 5회"와 "태그 9종"은 **모양의 문제**라
 * 브라우저 없이 확인할 수 있고, 그러면 U02 이후로 미뤄 온 jsdom 을 아직
 * 들이지 않아도 됩니다. 실제로 5번 눌러서 저장되는지는 Playwright 가 봅니다.
 */

import { describe, expect, it } from 'vitest'
import { CARDS, isComplete, type Draft } from '../src/features/daily-log/cards'
import { RISK_TAGS } from '../src/config'
import { ALL_TAGS } from '../src/data'
import { copy } from '../src/copy'

describe('카드 5장 (PRD FR-2)', () => {
  it('정확히 5장이다', () => {
    expect(CARDS).toHaveLength(5)
  })

  it('순서가 PRD FR-2 표 그대로다', () => {
    // 밥이 먼저인 것은 노령기 악화의 최초 신호가 거의 항상 식욕이라서고,
    // 하루 전체를 묻는 카드가 마지막인 것은 그것이 이 앱의 심장이라서입니다.
    expect(CARDS.map((card) => card.field)).toEqual([
      'meal',
      'water',
      'energy',
      'toilet',
      'overall',
    ])
  })

  it('5장 완료까지 탭이 5회다 (완료 판정 1)', () => {
    // 카드 하나에 선택지 하나를 고르면 곧바로 다음 장으로 갑니다.
    // 확인 버튼이나 저장 버튼이 끼면 이 수가 늘어납니다.
    const taps = CARDS.length
    expect(taps).toBe(5)
    expect(taps).toBeLessThanOrEqual(5)

    // 5번 고르면 저장할 수 있는 상태가 됩니다. 선택 항목(태그·메모)은
    // 여기에 들어가지 않습니다.
    const draft: Draft = {}
    for (const card of CARDS) {
      expect(isComplete(draft)).toBe(false)
      Object.assign(draft, { [card.field]: card.options[0]?.value })
    }
    expect(isComplete(draft)).toBe(true)
  })

  it('모든 카드에 선택지가 2개 이상 있다', () => {
    for (const card of CARDS) {
      expect(card.options.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('선택지 값이 TECH_SPEC 3-4 열거형과 같다', () => {
    const byField = Object.fromEntries(
      CARDS.map((card) => [card.field, card.options.map((option) => option.value)]),
    )
    expect(byField['meal']).toEqual(['ate_all', 'left_some', 'barely_ate', 'refused'])
    expect(byField['water']).toEqual(['normal', 'low', 'excessive'])
    expect(byField['energy']).toEqual(['normal', 'sluggish', 'barely_moving'])
    expect(byField['toilet']).toEqual(['normal', 'loose', 'constipated', 'accident'])
    expect(byField['overall']).toEqual(['good', 'okay', 'hard'])
  })

  it('마지막 카드의 질문 주체가 "우리"다', () => {
    // PRD FR-2 수용 기준. 아이나 보호자를 주체로 묻지 않습니다.
    const last = CARDS.at(-1)
    expect(last?.field).toBe('overall')
    expect(last?.question).toBe('오늘 우리는 어땠나요?')
    expect(last?.question).toContain('우리')
  })

  it('질문 문구가 모두 카피 저장소에서 온다', () => {
    const questions = CARDS.map((card) => card.question)
    expect(questions).toEqual([
      copy.dailyLog.meal.q,
      copy.dailyLog.water.q,
      copy.dailyLog.energy.q,
      copy.dailyLog.toilet.q,
      copy.dailyLog.overall.q,
    ])
  })

  it('isComplete 는 하나만 빠져도 거짓이다', () => {
    const full: Draft = {
      meal: 'ate_all',
      water: 'normal',
      energy: 'normal',
      toilet: 'normal',
      overall: 'good',
    }
    expect(isComplete(full)).toBe(true)
    for (const card of CARDS) {
      const missing = { ...full }
      delete missing[card.field]
      expect(isComplete(missing)).toBe(false)
    }
  })
})

describe('태그 9종 (PRD FR-2-1)', () => {
  it('정확히 9종이고 PRD 목록 그대로다', () => {
    expect(ALL_TAGS).toEqual([
      '기침',
      '구토',
      '절뚝임',
      '밤중 서성임',
      '떨림',
      '헐떡임',
      '긁음',
      '유독 붙어있음',
      '숨어있음',
    ])
    expect(ALL_TAGS).toHaveLength(9)
    expect(new Set(ALL_TAGS).size).toBe(9)
  })

  it('밤중 서성임과 숨어있음이 반드시 들어 있다', () => {
    // 보호자가 대수롭지 않게 넘기지만 인지 저하·통증의 중요한 신호입니다.
    // 태그로 존재하는 것만으로 관찰을 유도하는 효과가 있어 뺄 수 없습니다.
    expect(ALL_TAGS).toContain('밤중 서성임')
    expect(ALL_TAGS).toContain('숨어있음')
  })

  it('별도 라벨을 두지 않는다 — 저장값이 곧 표기다', () => {
    // TECH_SPEC 3-4. 표기와 값이 같아야 요약서 출력이 단순해집니다.
    // 라벨 사전을 만들면 여기서부터 어긋나기 시작합니다.
    expect(Object.keys(copy.dailyLog.tags).sort()).toEqual(['hint', 'title'])
  })
})

describe('위험 태그 설정 (PRD FR-2-3)', () => {
  it('전부 9종 안에 있다', () => {
    // JSON 은 런타임 데이터라 오타가 나도 컴파일이 통과합니다. 오타가 나면
    // 조용히 아무 태그도 걸리지 않고 병원 연락이 영영 안 뜹니다.
    for (const tag of RISK_TAGS) {
      expect(ALL_TAGS).toContain(tag)
    }
  })

  it('PRD 가 이름을 댄 둘을 담고 있다', () => {
    expect(RISK_TAGS).toContain('구토')
    expect(RISK_TAGS).toContain('헐떡임')
  })

  it('비어 있지 않고, 9종 전부도 아니다', () => {
    // 전부가 위험 태그면 아무것도 위험 태그가 아닌 것과 같습니다.
    expect(RISK_TAGS.length).toBeGreaterThan(0)
    expect(RISK_TAGS.length).toBeLessThan(ALL_TAGS.length)
  })
})

describe('확정 카피 (PRD FR-2-2)', () => {
  it('감사 반응 두 줄이 원문과 문자 단위로 같다', () => {
    expect(copy.hardDayThanks.line1).toBe('기록해주셔서 고맙습니다.')
    expect(copy.hardDayThanks.line2).toBe(
      '힘든 날을 남기는 것도 돌봄입니다. 이 기록이 병원에서 쓰입니다.',
    )
  })

  it('감사 반응에 판정·조언으로 읽힐 말이 없다', () => {
    const text = `${copy.hardDayThanks.line1}${copy.hardDayThanks.line2}`
    for (const word of ['해야', '하세요', '권장', '의심', '진단', '상담받']) {
      expect(text).not.toContain(word)
    }
  })

  it('병원 연락 문구에 놀라게 하는 말이 없다', () => {
    // PRD FR-2-3. lint-copy 도 같은 것을 보지만, 여기서 한 번 더 못 박습니다.
    const text = `${copy.riskContact.title}${copy.riskContact.cta}`
    for (const word of ['응급', '위급', '위험']) {
      expect(text).not.toContain(word)
    }
  })

  it('누락을 지적하는 문구가 없다', () => {
    // PRD FR-2 수용 기준. "기록을 놓쳤어요" 류의 표현을 만들지 않습니다.
    const all = JSON.stringify(copy)
    for (const word of ['놓쳤', '비어있어요', '끊겼']) {
      expect(all).not.toContain(word)
    }
  })
})
