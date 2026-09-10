/**
 * 힘든 날 집계 검사 (U11 산출물, PRD 원칙 P2).
 *
 * **`domain/summary.ts` 밖에서 `hard` 를 세지 않습니다.**
 *
 * 왜 린트까지 두는가: 힘든 날 개수는 화면에 나오면 안 되는 숫자입니다
 * (PRD FR-5 수용 기준 "좋은 날 개수만 표시한다. 힘든 날 개수를 표시하지
 * 않는다"). 그런데 세는 코드는 **한 줄이면 생기고**, 한 번 생기면 그 값을
 * 화면에 쓰는 것은 그다음 한 줄입니다. `countGood` 옆에 `countHard` 를
 * 두는 것이 자연스러워 보이는 것이 이 원칙의 위험입니다.
 *
 * 세는 것 자체를 아예 금지하지는 않습니다 — 진료 요약서는 힘든 날 수를
 * 담아야 하고(PRD FR-8), 그것이 `domain/summary.ts`(U20)의 일입니다.
 * **그 한 파일 안에서만 허용합니다.**
 *
 * ## 무엇을 위반으로 보는가
 *
 * "한 건이 힘든 날인지" 묻는 것은 위반이 아닙니다 — `DailyLogScreen` 이
 * `overall === 'hard'` 로 감사 반응을 띄우는 것은 PRD FR-2-2 가 요구하는
 * 동작입니다. 위반은 **여러 건을 모아 세는 것**입니다. 그래서 두 모양을
 * 봅니다. 둘 다 `overall` 이 근처에 있어야 합니다 — 힘든 날을 세는 길은
 * 그 필드를 지나는 것뿐입니다.
 *
 *  1. `'hard'` 가 집계 토큰(`filter`·`reduce`·`length`·`count`·`++`·`+=`)과
 *     같은 표현 안에 있음
 *     → `logs.filter((log) => log.overall === 'hard').length`
 *  2. `hard` 가 카운터의 초기값·증가와 같은 표현 안에 있음
 *     → `const counts = { good: 0, okay: 0, hard: 0 }` + `counts[log.overall] += 1`
 *
 * 2번이 필요한 이유는 1번만으로는 **따옴표 없는 키로 새는 길**이 남기
 * 때문입니다. 열거형 3개를 한꺼번에 세는 코드는 `'hard'` 를 적지 않습니다.
 *
 * ## 한계 — 사람이 봐야 하는 부분
 *
 * 창(window) 기반 휴리스틱이라 아주 멀리 떨어뜨려 놓으면 지나갑니다
 * (`const H = 'hard'` 를 다른 파일에 두고 나중에 세는 식). 기계가 잡을 수
 * 있는 모양만 잡습니다. **U11 완료 판정의 "빨간색 0건, 힘든 날 개수 표시
 * 0건 육안 확인"이 여전히 필요합니다.**
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { collectFiles, displayPath, report, scanSource } from './lint-lib.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 집계가 허용되는 유일한 파일. **U20 이 만들 파일이고 아직 없습니다.**
 * 없어도 이 린트는 통과합니다 — 지금은 아무도 세지 않는 것이 맞는 상태입니다.
 */
const ALLOWED = ['src/domain/summary.ts']

/**
 * `tests/` 는 보지 않습니다. 테스트는 계약을 확인하려고 힘든 날을 세야 할
 * 수 있고(예: `weekDots` 가 회색 점을 내는지), 그 코드는 배포되지 않습니다.
 * 원칙은 제품 코드에 대한 것입니다.
 */
const TARGET = join(repoRoot, 'src')

/** 여러 건을 모으는 신호. */
const AGGREGATION = ['.filter(', '.reduce(', '.length', 'count', '++', '+='];

/** 카운터를 만들거나 올리는 신호. */
const COUNTER = [': 0', '++', '+='];

/**
 * 표현 하나로 볼 범위: **그 줄과 앞뒤 한 줄.**
 *
 * 처음에는 앞뒤 90자로 잡았는데 `type Overall = 'good' | 'okay' | 'hard'`
 * 같은 **타입 선언이 네 줄 아래 집계식에 닿아** 거짓 양성이 났습니다.
 * 집계식은 한 줄, 길어도 두 줄에 걸치므로 줄 단위가 더 정확합니다.
 */
const WINDOW_LINES = 1

const violations = []
let checked = 0

/** `text` 안에서 `needle` 이 나오는 위치 전부. */
function positionsOf(text, needle) {
  const out = []
  let from = 0
  for (;;) {
    const at = text.indexOf(needle, from)
    if (at === -1) return out
    out.push(at)
    from = at + needle.length
  }
}

const lineAt = (text, at) => text.slice(0, at).split('\n').length

/** 그 줄과 앞뒤 한 줄. `lines` 는 0-기준, `line` 은 1-기준입니다. */
function windowOf(lines, line) {
  const from = Math.max(0, line - 1 - WINDOW_LINES)
  const to = Math.min(lines.length, line + WINDOW_LINES)
  return lines.slice(from, to).join('\n')
}

/** 창에 든 코드를 한 줄로 눌러 보고서에 싣습니다. */
const excerpt = (around) => around.replace(/\s+/g, ' ').trim().slice(0, 100)

for (const file of collectFiles(TARGET, ['.ts', '.tsx'])) {
  const shown = displayPath(file, repoRoot)
  if (ALLOWED.includes(shown)) continue

  checked += 1
  const { stripped } = scanSource(readFileSync(file, 'utf8'))
  const lines = stripped.split('\n')

  /** 같은 줄은 한 번만 보고합니다. `hard` 가 한 줄에 여러 번 나올 수 있습니다. */
  const seen = new Set()
  const flag = (at, what, around) => {
    const where = `${shown}:${lineAt(stripped, at)}`
    if (seen.has(where)) return
    seen.add(where)
    violations.push({
      where,
      what: `${what} — ${excerpt(around)}`,
      hint: `힘든 날 집계는 ${ALLOWED[0]} (U20) 안에서만 합니다 (PRD 원칙 P2 · FR-5)`,
    })
  }

  // 1. 따옴표 붙은 'hard' 가 집계 표현 안에 있는가
  for (const quoted of ["'hard'", '"hard"']) {
    for (const at of positionsOf(stripped, quoted)) {
      const around = windowOf(lines, lineAt(stripped, at))
      if (!around.includes('overall')) continue
      if (!AGGREGATION.some((token) => around.includes(token))) continue
      flag(at, '힘든 날을 세고 있습니다', around)
    }
  }

  // 2. 따옴표 없는 hard 가 카운터와 함께 있는가 (열거형 3개를 한꺼번에 세는 길)
  for (const at of positionsOf(stripped, 'hard')) {
    // 'hard' 로 이미 잡힌 자리는 건너뜁니다.
    const quoteBefore = stripped[at - 1]
    if (quoteBefore === "'" || quoteBefore === '"') continue
    // `hardDayThanks` 처럼 더 긴 이름의 일부는 대상이 아닙니다.
    if (/[A-Za-z0-9_$]/.test(stripped[at + 4] ?? '')) continue

    const around = windowOf(lines, lineAt(stripped, at))
    if (!around.includes('overall')) continue
    if (!COUNTER.some((token) => around.includes(token))) continue
    flag(at, '힘든 날 카운터를 만들고 있습니다', around)
  }
}

process.exit(report('힘든 날 집계 (PRD 원칙 P2 · FR-5)', checked, violations))
