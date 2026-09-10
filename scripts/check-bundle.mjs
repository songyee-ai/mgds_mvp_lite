/**
 * 초기 JS 예산 검사 (TECH_SPEC 18).
 *
 * | 항목 | 목표 | 측정 |
 * |---|---|---|
 * | 초기 JS (gzip) | 150KB 이하 | **빌드 시 자동 검사** |
 *
 * 명세서가 "빌드 시 자동 검사"라고 적어 두었는데 U08 까지 사람이 빌드
 * 출력을 눈으로 보고 있었습니다. 게이트에 걸지 않은 숫자는 오늘 한 번
 * 참이고 내일부터 아무도 안 보게 됩니다 (U04 의 커버리지에서 배운 것).
 *
 * **150KB 자체가 목적이 아닙니다.** 바로 아래 줄인 "홈 LCP (4G, 중급
 * 안드로이드) 2.5초 이하"를 지키기 위한 수단입니다. 이 앱은 밤중에 급할
 * 때 여는 앱이고(PRD FR-10), 그때 3초를 기다리게 하면 그 기능은 없는
 * 것과 같습니다.
 *
 * ## 무엇을 "초기 JS" 로 세는가
 *
 * `dist/index.html` 이 **처음 화면을 그리기 위해 받으라고 적어 둔 것**만
 * 셉니다 — `<script type="module">` 과 `<link rel="modulepreload">`.
 *
 * 지연 로드되는 청크(`import()` 로 갈라진 것)는 index.html 에 없으므로
 * 자동으로 빠집니다. 그래서 나중에 요약서 라우트(U22 의 `jspdf`·
 * `html-to-image`)를 lazy 로 나누면 이 숫자가 실제로 내려갑니다.
 * `/dev/*` 라우트가 이미 그 패턴입니다.
 *
 * CSS 는 세지 않습니다. 예산 항목이 "초기 **JS**" 입니다.
 *
 * ## 단위
 *
 * 1kB = **1,000 바이트**입니다. Vite 의 빌드 출력이 그 관례를 쓰고,
 * Lighthouse 도 같습니다. 바로 위에 찍히는 Vite 의 숫자와 이 검사의
 * 숫자가 달라 보이면 아무도 둘 다 믿지 않게 됩니다.
 *
 * 압축 수준 차이로 Vite 가 찍는 gzip 값과 1% 안팎 어긋날 수 있습니다.
 * 예산까지 1% 를 다투는 상황이면 이미 나눠야 할 때입니다.
 */

import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(repoRoot, 'dist')

/** TECH_SPEC 18. 바꾸려면 명세서를 먼저 고쳐야 합니다. */
const BUDGET_BYTES = 150 * 1000

const KB = (bytes) => `${(bytes / 1000).toFixed(2)} kB`

const html = join(dist, 'index.html')
if (!existsSync(html)) {
  console.error('  NG  초기 JS 예산 — dist/index.html 이 없습니다. 먼저 빌드하세요.')
  process.exit(1)
}

const source = readFileSync(html, 'utf8')

/**
 * 진입 스크립트와 그것이 정적으로 의존하는 청크.
 *
 * Vite 는 진입점이 정적으로 끌어오는 청크에 `modulepreload` 를 붙입니다.
 * 둘을 합친 것이 "첫 화면을 그리기 전에 반드시 받아야 하는 JS" 입니다.
 */
const entries = [
  ...source.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/g),
  ...source.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
].map((match) => match[1])

if (entries.length === 0) {
  console.error('  NG  초기 JS 예산 — index.html 에서 진입 스크립트를 찾지 못했습니다.')
  console.error('      Vite 의 출력 형식이 바뀌었을 수 있습니다. 이 스크립트를 고치세요.')
  process.exit(1)
}

let total = 0
const rows = []
for (const href of entries) {
  const file = join(dist, href.replace(/^\//, ''))
  if (!existsSync(file)) {
    console.error(`  NG  초기 JS 예산 — ${href} 를 찾지 못했습니다.`)
    process.exit(1)
  }
  const gzipped = gzipSync(readFileSync(file)).length
  total += gzipped
  rows.push({ href, raw: readFileSync(file).length, gzipped })
}

for (const row of rows) {
  console.log(`      ${row.href}  raw ${KB(row.raw)} / gzip ${KB(row.gzipped)}`)
}

const headroom = BUDGET_BYTES - total

if (total > BUDGET_BYTES) {
  console.error(`  NG  초기 JS 예산 (TECH_SPEC 18) — gzip ${KB(total)} > ${KB(BUDGET_BYTES)}`)
  console.error(`      ${KB(total - BUDGET_BYTES)} 초과했습니다.`)
  console.error('      → 라우트를 동적 import 로 나누세요. 지금 화면에 필요하지 않은 것부터.')
  console.error('        요약서(jspdf·html-to-image)처럼 매일 열지 않는 화면이 먼저입니다.')
  process.exit(1)
}

console.log(
  `  OK  초기 JS 예산 (TECH_SPEC 18) — gzip ${KB(total)} / ${KB(BUDGET_BYTES)}, 여유 ${KB(headroom)}`,
)
