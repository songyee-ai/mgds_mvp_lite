/**
 * "힘든 날" 감사 반응 누락 검사 (U08 산출물, PRD FR-2-2).
 *
 * 왜 린트까지 두는가: 이 문구는 위로 장치가 아니라 **데이터 정직도를 지키는
 * 구현**입니다. 보호자가 죄책감 때문에 나쁜 날을 나쁘다고 기록하지 못하면
 * 데이터가 낙관적으로 편향되고 추세선 전체의 의미가 사라집니다. 그래서
 * PRD 는 이것을 P0 · 생략 금지로 두었습니다.
 *
 * 생략은 보통 "지웠다"가 아니라 **조용히 안 쓰이게 된다**로 옵니다. 화면을
 * 고치다가 렌더가 빠지거나, 카피를 다듬다가 문구가 달라지는 식입니다.
 * 그래서 세 가지를 봅니다.
 *
 *  1. `copy.hardDayThanks` 두 줄이 PRD FR-2-2 원문과 **문자 단위로** 같은가
 *  2. 그 문구를 실제로 그리는 컴포넌트가 있는가 (정의만 있고 미사용 금지)
 *  3. 저장 화면이 그 컴포넌트를 부르는가 (컴포넌트만 있고 미연결 금지)
 *
 * 판정·조언 문장이 들어갔는지는 사람이 봐야 합니다. 기계가 대신할 수 있는
 * 부분만 여기서 봅니다.
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { displayPath, report } from './lint-lib.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** PRD FR-2-2 원문. 이 두 줄을 바꾸려면 PRD 를 먼저 고쳐야 합니다. */
const REQUIRED_LINES = [
  '기록해주셔서 고맙습니다.',
  '힘든 날을 남기는 것도 돌봄입니다. 이 기록이 병원에서 쓰입니다.',
]

const COPY = join(repoRoot, 'src', 'copy', 'ko.ts')
const COMPONENT = join(repoRoot, 'src', 'features', 'daily-log', 'HardDayThanks.tsx')
const SCREEN = join(repoRoot, 'src', 'features', 'daily-log', 'DailyLogScreen.tsx')

const violations = []
let checked = 0

function readOrFail(file, what) {
  if (!existsSync(file)) {
    violations.push({
      where: displayPath(file, repoRoot),
      what: `${what} 파일이 없습니다`,
      hint: 'PRD FR-2-2 는 P0 · 생략 금지입니다',
    })
    return null
  }
  checked += 1
  return readFileSync(file, 'utf8')
}

// 1. 확정 문구가 원문 그대로인가
const copySource = readOrFail(COPY, '카피')
if (copySource !== null) {
  for (const line of REQUIRED_LINES) {
    if (copySource.includes(`'${line}'`)) continue
    violations.push({
      where: displayPath(COPY, repoRoot),
      what: `확정 문구가 원문과 다릅니다 — ${JSON.stringify(line)}`,
      hint: 'PRD FR-2-2 확정 문구는 문자 단위로 일치해야 합니다',
    })
  }
}

// 2. 두 줄을 실제로 그리는 컴포넌트가 있는가
const componentSource = readOrFail(COMPONENT, '감사 반응 컴포넌트')
if (componentSource !== null) {
  for (const key of ['hardDayThanks.line1', 'hardDayThanks.line2']) {
    if (componentSource.includes(key)) continue
    violations.push({
      where: displayPath(COMPONENT, repoRoot),
      what: `${key} 를 그리지 않습니다`,
      hint: '카피에 있기만 하고 화면에 나오지 않으면 없는 것과 같습니다',
    })
  }
}

// 3. 저장 화면이 그 컴포넌트를 hard 일 때 부르는가
const screenSource = readOrFail(SCREEN, '기록 화면')
if (screenSource !== null) {
  if (!screenSource.includes('<HardDayThanks')) {
    violations.push({
      where: displayPath(SCREEN, repoRoot),
      what: 'HardDayThanks 를 그리지 않습니다',
      hint: "overall === 'hard' 로 저장한 직후 100% 표시되어야 합니다 (PRD FR-2-2)",
    })
  } else if (!/'hard'[\s\S]{0,120}<HardDayThanks/.test(screenSource)) {
    violations.push({
      where: displayPath(SCREEN, repoRoot),
      what: "HardDayThanks 가 'hard' 조건과 이어져 있지 않습니다",
      hint: '힘든 날에만, 그리고 힘든 날에는 반드시 나와야 합니다',
    })
  }
}

process.exit(report('힘든 날 감사 반응 (PRD FR-2-2)', checked, violations))
