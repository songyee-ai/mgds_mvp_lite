/**
 * 금지 표현 검사 (U03).
 *
 * 대상: `src/copy/**` 의 문자열 리터럴, `src/config/**` 의 JSON 문자열.
 * 사전: PRD 11-2. 대응 원칙: P4, C-1. 릴리스 차단 조건 PRD 4-1 (1).
 *
 * 문구를 한 파일에 모아 둔 이유가 "이 파일만 보면 제품의 모든 문구를 감수할 수
 * 있다"(TECH_SPEC 13)는 것이므로, 검사도 그 파일들만 봅니다.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { collectFiles, displayPath, report, scanSource } from './lint-lib.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** PRD 11-2 의 표를 그대로 옮긴 것입니다. 표가 바뀌면 여기도 바꿉니다. */
const FORBIDDEN = [
  { terms: ['응급', '위급'], instead: '밤중에 급하면' },
  { terms: ['후견인', '관리자', '권한', '등급'], instead: '함께 돌보는 사람 / UI 노출 금지' },
  { terms: ['환자', '케어 대상'], instead: '아이' },
  { terms: ['왜 오셨나요'], instead: '어떤 마음으로 오셨어요' },
  { terms: ['돌봐달라고 초대했어요'], instead: '좋은 날들을 함께 만들고 싶어 해요' },
  { terms: ['위험', '걱정', '나빠졌다', '악화'], instead: '관찰한 사실만 서술' },
  {
    terms: ['남은 날', '마지막', '이별', '상실', '장례', '승계', '사망'],
    instead: '함께한 날 / 기능 자체를 만들지 않음',
  },
  { terms: ['기록을 놓쳤어요', '연속 기록이 끊겼어요'], instead: '문구 자체를 만들지 않음' },
]

/**
 * 확정 카피 예외 (PRD NFR-C C-2).
 *
 * **금지 표현 사전보다 확정 카피가 우선합니다.** 인트로 3장은 CONTEXT 5-2 의
 * 원문을 그대로 써야 하고(C-2), 그 3장이 금지어 "남은 날"을 **부정문으로**
 * 담고 있습니다 — 이 제품의 핵심 주장이 바로 그 부정이라 바꿀 수 없습니다.
 *
 * **부분 일치가 아니라 문자열 전체가 같아야 통과합니다.** 그래야 예외가
 * "남은 날"이라는 단어에 열리는 것이 아니라 **이 한 문장에만** 열립니다.
 * 문장을 조금이라도 고치면 예외가 풀려 린트가 다시 잡습니다.
 *
 * 여기에 줄을 더하는 것은 카피 원칙을 깎는 일입니다. 확정 카피 원문이라는
 * 근거 없이는 더하지 마세요.
 */
const ALLOWED = [
  {
    value: '남은 날을 세는 앱이 아니에요.',
    why: '인트로 3장 확정 카피 (CONTEXT 5-2 · PRD NFR-C C-2)',
  },
]

/** JSON 값을 재귀로 훑어 문자열만 경로와 함께 뽑습니다. */
function jsonStrings(value, path = '') {
  if (typeof value === 'string') return [{ value, line: path || '(루트)' }]
  if (Array.isArray(value)) return value.flatMap((item, i) => jsonStrings(item, `${path}[${i}]`))
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      jsonStrings(item, path === '' ? key : `${path}.${key}`),
    )
  }
  return []
}

function check(strings, where) {
  const violations = []
  for (const { value, line } of strings) {
    // 확정 카피는 사전보다 우선합니다. 문자열 전체가 같을 때만 넘어갑니다.
    if (ALLOWED.some((allowed) => allowed.value === value)) continue
    for (const { terms, instead } of FORBIDDEN) {
      for (const term of terms) {
        if (!value.includes(term)) continue
        violations.push({
          where: `${where}:${line}`,
          what: `금지 표현 "${term}" — ${JSON.stringify(value)}`,
          hint: `대체: ${instead} (PRD 11-2)`,
        })
      }
    }
  }
  return violations
}

const violations = []
let checked = 0

for (const file of collectFiles(join(repoRoot, 'src', 'copy'), ['.ts', '.tsx'])) {
  const { strings } = scanSource(readFileSync(file, 'utf8'))
  checked += strings.length
  violations.push(...check(strings, displayPath(file, repoRoot)))
}

for (const file of collectFiles(join(repoRoot, 'src', 'config'), ['.json'])) {
  const strings = jsonStrings(JSON.parse(readFileSync(file, 'utf8')))
  checked += strings.length
  violations.push(...check(strings, displayPath(file, repoRoot)))
}

// config 에 아직 .json 이 없어도(U18·U23·U24 에서 생깁니다) .ts 자리표시자는 봅니다.
for (const file of collectFiles(join(repoRoot, 'src', 'config'), ['.ts'])) {
  const { strings } = scanSource(readFileSync(file, 'utf8'))
  checked += strings.length
  violations.push(...check(strings, displayPath(file, repoRoot)))
}

process.exit(report('금지 표현 (PRD 11-2)', checked, violations))
