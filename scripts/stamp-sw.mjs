/**
 * 서비스 워커에 빌드 지문과 프리캐시 목록을 박아 넣습니다.
 *
 * `public/sw.js` 는 번들되지 않습니다. Vite 가 `dist/sw.js` 로 그냥 복사할
 * 뿐이라, 이번 빌드가 무엇을 만들었는지 그 파일이 알 길이 없습니다.
 * 빌드가 끝난 뒤 `dist/` 를 훑어서 두 자리를 채우는 것이 이 스크립트입니다.
 *
 * ## 왜 손으로 적은 버전 번호를 쓰지 않는가
 *
 * 사람이 올려야 하는 숫자는 언젠가 안 올라갑니다. 그러면 새 배포가 예전
 * 캐시 이름으로 들어가고, 예전 파일이 지워지지 않은 채 섞입니다.
 * 지문은 **프리캐시할 파일들의 내용에서 뽑습니다** — 한 바이트라도 다르면
 * 다른 이름이 되고, 아무것도 안 바뀌었으면 캐시도 그대로 남습니다.
 *
 * ## 무엇을 미리 받아 두는가
 *
 * 설치할 때 통째로 받습니다. **영상과 아이콘만 뺍니다.**
 *
 * - `.mp4` — 인트로 3편 합쳐 800KB 입니다. 인트로는 처음 한 번뿐이고,
 *   그때는 방금 앱을 연 사람이라 온라인입니다. 나중에 실제로 보면 그때
 *   캐시에 담깁니다.
 * - `.png` — 아이콘 5장 합쳐 330KB 인데 대부분이 `app-icon-512` 입니다.
 *   홈 화면 아이콘은 **운영체제가** 가져가는 것이지 화면이 쓰는 것이
 *   아닙니다. 오프라인에서 아쉬울 자리가 없습니다.
 * - `sw.js` — 자기 자신은 담지 않습니다. 브라우저가 따로 관리합니다.
 *
 * 포스터(`.webp`)는 넣습니다. 합쳐 80KB 이고, 이것이 없으면 자동 재생이
 * 막힌 화면에서 인트로가 빈 칸으로 뜹니다.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, sep } from 'node:path'

/** 자리표시자. `public/sw.js` 에 **글자 그대로** 있어야 합니다. */
export const VERSION_TOKEN = "'__BUILD_ID__'"
export const PRECACHE_TOKEN = "['__PRECACHE__']"

/** 프리캐시에서 빼는 확장자. 이유는 위 주석에. */
export const SKIP_EXTENSIONS = ['.mp4', '.png']

/** 프리캐시에서 빼는 파일 이름. */
export const SKIP_FILES = ['sw.js']

/**
 * `dist/` 상대 경로 목록에서 미리 받을 것만 골라 URL 로 만듭니다.
 *
 * 순서를 고정합니다 — 목록이 지문에 들어가므로, 파일 시스템이 주는 순서가
 * 바뀌었다는 이유만으로 지문이 달라지면 안 됩니다.
 */
export function precacheList(paths) {
  const kept = paths
    .filter((path) => !SKIP_FILES.includes(path))
    .filter((path) => !SKIP_EXTENSIONS.some((ext) => path.endsWith(ext)))
    .map((path) => `/${path}`)
    .sort()

  // 껍데기가 없으면 오프라인에서 아무것도 열리지 않습니다. 조용히 넘기지 않습니다.
  if (!kept.includes('/index.html')) {
    throw new Error('프리캐시 목록에 /index.html 이 없습니다. 빌드가 덜 끝났습니다.')
  }
  return kept
}

/**
 * 주어진 파일들의 **내용**에서 뽑은 지문. 경로도 함께 넣어 이름 변경을 잡습니다.
 *
 * 담는 목록에 없는 `sw.js` 도 넣어 부릅니다 (아래 `main`). 워커의 전략이
 * 바뀌었는데 캐시 이름이 그대로면 **예전 규칙으로 담긴 것들을 새 규칙이
 * 물려받습니다.** 워커를 고치는 일은 드물고, 값은 한 번의 재다운로드입니다.
 */
export function buildId(dist, urls) {
  const hash = createHash('sha256')
  for (const url of urls) {
    hash.update(url)
    hash.update(readFileSync(join(dist, url.slice(1))))
  }
  return hash.digest('hex').slice(0, 12)
}

/**
 * 자리표시자 두 개를 값으로 바꿉니다.
 *
 * **못 찾으면 던집니다.** 조용히 지나가면 자리표시자가 그대로 배포되고,
 * 워커는 `stamped()` 가 거짓이라 아무 일도 안 하게 됩니다 — 오프라인도
 * 설치 권유도 없는데 빌드는 초록입니다.
 */
export function stamp(source, { version, precache }) {
  for (const token of [VERSION_TOKEN, PRECACHE_TOKEN]) {
    if (!source.includes(token)) {
      throw new Error(
        `자리표시자 ${token} 를 찾지 못했습니다 — ` +
          '이미 박혔거나(빌드 없이 두 번 돌렸습니다) public/sw.js 가 바뀌었습니다.',
      )
    }
  }
  return source
    .replace(VERSION_TOKEN, () => JSON.stringify(version))
    .replace(PRECACHE_TOKEN, () => JSON.stringify(precache))
}

/** `dist/` 아래 모든 파일의 상대 경로 (`/` 구분자). */
function walk(root, here = root) {
  const out = []
  for (const name of readdirSync(here)) {
    const full = join(here, name)
    if (statSync(full).isDirectory()) out.push(...walk(root, full))
    else out.push(relative(root, full).split(sep).join('/'))
  }
  return out
}

function main() {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const dist = join(repoRoot, 'dist')
  const target = join(dist, 'sw.js')

  if (!existsSync(target)) {
    console.error('  NG  서비스 워커 — dist/sw.js 가 없습니다.')
    console.error('      public/sw.js 가 사라졌거나 빌드가 덜 끝났습니다.')
    process.exit(1)
  }

  const precache = precacheList(walk(dist))
  // 아직 자리표시자가 박히기 전의 `sw.js` 라 값이 흔들리지 않습니다.
  const version = buildId(dist, [...precache, '/sw.js'])
  writeFileSync(target, stamp(readFileSync(target, 'utf8'), { version, precache }))

  const bytes = precache.reduce((sum, url) => sum + statSync(join(dist, url.slice(1))).size, 0)
  console.log(
    `  OK  서비스 워커 — mgds-${version}, ${precache.length}개 파일 ` +
      `${(bytes / 1000).toFixed(1)} kB (영상·아이콘 제외)`,
  )
}

// 직접 실행할 때만 돕니다. 테스트는 위 함수들만 가져다 씁니다.
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(`  NG  서비스 워커 — ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
