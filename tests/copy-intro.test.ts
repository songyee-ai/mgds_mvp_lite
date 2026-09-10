import { describe, expect, it } from 'vitest'
import { copy } from '../src/copy'

/**
 * 인트로 3장 확정 카피 원문 일치 (PRD NFR-C C-2).
 *
 * ## 왜 문구를 두 번 적는가
 *
 * 아래 `SOURCE` 는 확정 카피를 **손으로 옮겨 적은 사본**입니다.
 * `copy/ko.ts` 와 같은 문장을 두 번 적는 것이 중복처럼 보이지만, 그 중복이
 * 이 테스트의 전부입니다 — 한쪽만 고치면 여기서 갈라집니다.
 *
 * **명세 문서(`MORE_GOOD_DAYS_CONTEXT.md`)는 이 저장소에 없습니다.** 작업
 * 머신의 상위 폴더에만 있어서 테스트가 읽을 수 없고, 읽을 수 있다 해도
 * 저장소를 받은 사람이 그 파일을 갖고 있지 않으면 테스트가 깨집니다.
 * 그래서 원문을 여기 박아 두고, 명세가 바뀌면 사람이 두 곳을 함께 고칩니다.
 *
 * ## 고칠 때
 *
 * 이 테스트가 실패했다면 둘 중 하나입니다.
 *
 * 1. **`copy/ko.ts` 를 잘못 고쳤다** — 되돌리세요. 확정 카피입니다.
 * 2. **명세의 확정 카피가 실제로 바뀌었다** — CONTEXT 5-2 를 확인하고
 *    `SOURCE` 와 `copy/ko.ts` 를 함께 고치세요. 한쪽만 고치면 이 테스트가
 *    다시 잡습니다.
 *
 * 눈으로 비교하기 쉽게 원문의 생김새(제목 한 줄, 빈 줄, 본문 두 줄)를
 * 그대로 유지합니다.
 */

/**
 * 확정 카피 원문 (2026-09-10 사용자 개정안).
 *
 * **CONTEXT 5-2 의 문구가 아닙니다.** 각 장이 두 줄씩 길어졌고 1장과 3장에
 * 새 문장이 들어왔습니다. 저장소 밖의 CONTEXT 를 고칠 수 없어 정본이
 * `copy/ko.ts` 에 있고, 이 파일이 그것과 갈라지는지 봅니다.
 *
 * 앞뒤 빈 줄과 들여쓰기는 비교 전에 걷어냅니다.
 */
const SOURCE = [
  `
오늘 우리 아이는 어땠나요?

매일 보고 있어도
매일 조금씩 달라집니다.

괜찮은 날도, 조금 힘든 날도
그 모습을 오래 바라봐 주세요.
`,
  `
기억하지 않아도 괜찮아요.

매일 10초,
오늘 우리가 어땠는지만 남겨두세요.

하루하루 쌓인 기록이
우리 아이의 흐름을 보여줄 거예요.
`,
  `
좋은 날을 하루라도 더.

남은 날을 세는 앱이 아니에요.

오늘의 좋은 날을 하나씩 발견하고,
그런 날을 조금 더 오래 이어가는 앱.

More Good Days
`,
]

/**
 * 화면에 붙은 문구를 원문과 같은 모양의 한 덩어리로 되돌립니다.
 *
 * 제목·문단·워드마크를 **빈 줄로** 잇고, 한 문단 안의 줄은 줄바꿈으로만
 * 잇습니다. 원문의 빈 줄이 곧 문단 경계이므로, 문단을 하나로 합치거나
 * 쪼개면 여기서 갈라집니다.
 */
function rendered(index: number): string {
  const page = copy.intro.pages[index]
  if (page === undefined) throw new Error(`인트로 ${index + 1}장이 없습니다`)

  const blocks = [page.title, ...page.stanzas.map((stanza) => stanza.join('\n'))]
  if ('wordmark' in page) blocks.push(page.wordmark)
  return blocks.join('\n\n')
}

/** 앞뒤 빈 줄만 걷어냅니다. **줄 안의 문자는 건드리지 않습니다.** */
function trimmed(text: string): string {
  return text.replace(/^\n+/, '').replace(/\n+$/, '')
}

describe('인트로 3장 확정 카피', () => {
  it('장이 3개다', () => {
    // CONTEXT 5-2 는 3장입니다. 늘리거나 줄이는 것도 원문 변경입니다.
    expect(copy.intro.pages).toHaveLength(SOURCE.length)
  })

  SOURCE.forEach((source, index) => {
    it(`${index + 1}장이 원문과 문자 단위로 같다`, () => {
      expect(rendered(index)).toBe(trimmed(source))
    })
  })

  it('앱 이름은 3장에서 처음 나온다', () => {
    /**
     * CONTEXT 5-2: "**3장** — 여기서 앱 이름이 처음 등장합니다."
     * 1·2장에 워드마크를 얹으면 그 순서가 깨집니다.
     */
    const withWordmark = copy.intro.pages.filter((page) => 'wordmark' in page)
    expect(withWordmark).toHaveLength(1)
    expect(copy.intro.pages[2]).toHaveProperty('wordmark', 'More Good Days')
  })

  it('건너뛰기가 존재한다', () => {
    // CONTEXT 5-2: "스킵 버튼은 우측 상단에 작게."
    expect(copy.intro.skip.length).toBeGreaterThan(0)
  })
})
