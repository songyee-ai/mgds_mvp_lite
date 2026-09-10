import { describe, expect, it } from 'vitest'
import {
  DOT_STATES,
  DOT_STATE_LABEL,
  dotStateOf,
  type DotsProps,
  type DotState,
} from '../src/ui/Dots'
import type { Dot } from '../src/domain'

/*
 * U02 T-unit — 컴파일 단정.
 *
 * @ts-expect-error 는 그 줄에 타입 에러가 "없으면" 컴파일을 실패시킵니다.
 * 그래서 이 두 줄은 `npm run typecheck` 에서 'red' 가 거부된다는 증거가 됩니다.
 * 누군가 DotState 에 'red' 를 넣는 순간 타입 검사가 깨집니다.
 */

// @ts-expect-error 'red' 는 DotState 에 존재하지 않습니다 (PRD P6 · PRD 11-3)
const forbiddenState: DotState = 'red'

const forbiddenProps: DotsProps = {
  label: '이번 주',
  // @ts-expect-error Dots 의 values 에도 'red' 를 넘길 수 없습니다
  values: ['red'],
}

describe('Dots 의 상태', () => {
  /**
   * U02 는 3종이었고 **U11 이 `'none'`(미기록) 을 더했습니다.**
   * PRD FR-5 의 레이아웃(`● ● ○ ● ● ● ·`)이 4번째 모양을 이미 보여 줍니다 —
   * 마지막 `·` 는 아직 기록하지 않은 오늘입니다. 도메인의 `Dot` 에도
   * 원래 `'none'` 이 있었고 대응하는 UI 상태만 없던 상태였습니다.
   *
   * **여기에 5번째를 임의로 더하지 마세요.** 명세서가 보여 준 모양이
   * 네 개입니다.
   */
  it('좋은 날·보통·힘든 날·미기록 4종뿐이다', () => {
    expect(DOT_STATES).toEqual(['good', 'okay', 'hard', 'none'])
  })

  it('도메인 Dot 4종이 빠짐없이 UI 상태로 옮겨진다', () => {
    const dots: Dot[] = ['filled', 'empty', 'gray', 'none']
    expect(dots.map(dotStateOf)).toEqual(['good', 'okay', 'hard', 'none'])
    // 옮긴 결과가 전부 실제 상태여야 합니다 — 오타가 있으면 여기서 걸립니다.
    for (const dot of dots) expect(DOT_STATES).toContain(dotStateOf(dot))
  })

  it('빨강 계열 상태가 없다', () => {
    expect(DOT_STATES).not.toContain(forbiddenState)
    expect(forbiddenProps.values).not.toEqual(DOT_STATES)
    expect(DOT_STATES.some((state) => /red|빨/i.test(state))).toBe(false)
  })

  it('모든 상태에 읽어 줄 문구가 있다', () => {
    for (const state of DOT_STATES) {
      expect(DOT_STATE_LABEL[state].length).toBeGreaterThan(0)
    }
  })
})
