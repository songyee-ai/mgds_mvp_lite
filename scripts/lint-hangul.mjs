/**
 * 한글 리터럴 위치 검사 (U03).
 *
 * 대상: `src/features/**`·`src/ui/**` 의 `.tsx`. 대응 원칙: C-3.
 *
 * 주석은 지우고 나머지에서 한글을 찾습니다. 문자열 리터럴뿐 아니라 JSX 본문
 * (`<p>닫기</p>`)도 잡습니다. 둘 다 화면에 그대로 나가는 문구이고, 하나만
 * 막으면 나머지로 새기 때문입니다.
 *
 * `src/app/**` 은 대상이 아닙니다(TECH_SPEC 16 이 정한 범위). 라우팅 셸의
 * 문자열은 U31 이 카피를 확정할 때 함께 정리합니다.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { HANGUL, collectFiles, displayPath, report, scanSource } from './lint-lib.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const TARGETS = [join(repoRoot, 'src', 'features'), join(repoRoot, 'src', 'ui')]

const violations = []
let checked = 0

for (const dir of TARGETS) {
  for (const file of collectFiles(dir, ['.tsx'])) {
    checked += 1
    const { stripped } = scanSource(readFileSync(file, 'utf8'))

    stripped.split('\n').forEach((text, index) => {
      if (!HANGUL.test(text)) return
      violations.push({
        where: `${displayPath(file, repoRoot)}:${index + 1}`,
        what: `한글 리터럴 — ${text.trim()}`,
        hint: 'src/copy/ko.ts 로 옮기고 거기서 가져다 쓰세요 (TECH_SPEC 13)',
      })
    })
  }
}

process.exit(report('한글 리터럴 위치 (features·ui)', checked, violations))
