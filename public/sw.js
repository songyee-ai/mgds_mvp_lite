/*
 * 서비스 워커 — 오프라인과 설치 조건.
 *
 * **이 파일은 번들되지 않습니다.** `public/` 에 있어 그대로 `/sw.js` 로
 * 나갑니다. import 를 쓸 수 없고, 타입 검사도 테스트의 import 도 닿지
 * 않습니다. 그래서 `tests/sw.test.ts` 가 **이 파일을 글자 그대로 읽어**
 * 가짜 브라우저 위에서 돌립니다.
 *
 * ## 왜 넣었나
 *
 * 1. **안드로이드 크롬의 설치 조건.** `beforeinstallprompt` 는 매니페스트만
 *    으로는 오지 않습니다 — **fetch 처리기가 있는 서비스 워커**가 조건에
 *    들어 있습니다. 그것이 없어서 `features/install` 의 `prompt` 갈래가
 *    안드로이드에서 한 번도 뜨지 못했습니다.
 * 2. **오프라인.** 기록은 이미 IndexedDB 에 있지만, 화면을 그릴 JS 를
 *    받지 못하면 아무것도 못 봅니다. 지하철·병원 지하에서 열리지 않는
 *    앱이면 로컬 우선이라고 할 수 없습니다.
 *
 * ## 캐시 전략 — 두 가지뿐입니다
 *
 * | 무엇 | 어떻게 | 왜 |
 * |---|---|---|
 * | 화면 이동 (`mode: 'navigate'`) | 캐시 먼저, 배경에서 갱신 | 즉시 열려야 합니다 |
 * | 그 밖의 같은 출처 GET | 캐시 먼저, 없으면 받아서 담기 | 파일 이름에 해시가 있어 안 바뀝니다 |
 * | 나머지 전부 | **손대지 않습니다** | 모르는 것은 건드리지 않습니다 |
 *
 * **화면 이동을 네트워크 우선으로 두지 않은 이유**는 PRD FR-10 입니다 —
 * 밤중에 급할 때 여는 앱이고, 신호가 나쁜 곳에서 HTML 을 기다리게 하면
 * 그 기능은 없는 것과 같습니다. 대신 **새 배포가 한 번 늦게 보입니다.**
 * 그것을 당기려고 `skipWaiting()` 을 넣지 마세요 — 아래 `setUp` 의 ⛔ 에
 * 이유가 있습니다 (TECH_SPEC 17-3).
 *
 * ## 낡은 화면이 남지 않게 하는 것들
 *
 * - 자산 이름에 내용 해시가 붙어 있습니다. 내용이 바뀌면 **이름이 바뀌어**
 *   캐시 우선이 낡은 것을 줄 수가 없습니다.
 * - 캐시 이름에 빌드 지문이 들어갑니다 (`scripts/stamp-sw.mjs`). 새 배포는
 *   새 캐시로 들어가고, `activate` 가 예전 것을 지웁니다.
 * - `index.html` 은 배경에서 매번 다시 받습니다.
 *
 * ## 손대면 안 되는 자리 셋
 *
 * 1. **Range 요청을 가로채지 마세요.** 부분 응답(206)은 Cache API 에 넣을
 *    수 없습니다. 인트로 영상이 정확히 그 경로입니다.
 * 2. **`response.ok` 가 아니면 담지 마세요.** Vercel 의 Attack Challenge
 *    Mode 가 403 HTML 을 돌려줍니다 (handoff/STATE.md 4-5). 담으면 그 403 이
 *    캐시에 눌러앉습니다.
 * 3. **HTML 로 온 자산을 담지 마세요.** `vercel.json` 이 없는 파일을 404 가
 *    아니라 `index.html` 로 돌려줍니다. 오타 난 자산 경로가 "200 에 HTML" 로
 *    오고, 담으면 영영 깨집니다.
 */

/*
 * 빌드가 값을 박아 넣는 두 자리입니다 (`scripts/stamp-sw.mjs`).
 * 개발 서버에서는 자리표시자 그대로라 아래 `stamped()` 가 거짓이 되고,
 * 이 워커는 **아무것도 가로채지 않습니다.**
 */
const VERSION = '__BUILD_ID__'
const PRECACHE = ['__PRECACHE__']

const PREFIX = 'mgds-'
const CACHE = PREFIX + VERSION

/** 화면 이동에 돌려줄 껍데기. SPA 라 어느 주소든 이 한 장입니다. */
const SHELL = '/index.html'

/*
 * **`ignoreVary` 없이는 자바스크립트와 CSS 가 캐시에서 안 잡힙니다.**
 *
 * 서버가 자산에 `Vary: Origin` 을 붙입니다. 그러면 Cache API 는 담을 때와
 * 꺼낼 때의 `Origin` 헤더가 같아야 짝으로 쳐 줍니다. 그런데
 *
 * - `cache.addAll` 은 `Origin` 없이 받아 옵니다.
 * - Vite 는 진입 스크립트와 스타일시트에 `crossorigin` 을 붙입니다.
 *   그 요청은 **`Origin` 을 보냅니다.**
 *
 * 둘이 어긋나 캐시에 **있는데도 못 찾고** 네트워크로 나갑니다. 온라인일
 * 때는 티가 안 나고 오프라인에서만 흰 화면이 됩니다 — 실제로 그랬습니다
 * (2026-09-13, 미리보기 서버를 끄고 확인). 이미지·영상은 `crossorigin` 이
 * 없어 멀쩡했고 **JS 와 CSS 둘만** 떨어졌습니다.
 *
 * 주소가 곧 내용인 파일들입니다(이름에 해시가 있습니다). 출처에 따라 다른
 * 것을 줄 이유가 없으니 `Vary` 를 무시하는 것이 맞습니다.
 */
const MATCH = { ignoreVary: true }

/**
 * 빌드가 값을 박아 넣었는가.
 *
 * 안 박혔으면 조용히 비켜섭니다. **깨진 채로 가로채는 것보다 아무것도
 * 안 하는 것이 낫습니다** — 잘못 담은 캐시는 사용자가 지우는 법을 모릅니다.
 */
function stamped() {
  return !VERSION.startsWith('__')
}

// ── 설치 ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(setUp())
})

async function setUp() {
  if (!stamped()) return
  const cache = await caches.open(CACHE)
  /*
   * `addAll` 은 전부 아니면 전무입니다. 하나라도 못 받으면 설치가 실패하고
   * **예전 워커가 그대로 남습니다** — 반쪽짜리 새 버전보다 낫습니다.
   */
  await cache.addAll(PRECACHE)

  /*
   * ⛔ **여기에 `skipWaiting()` 을 넣지 마세요.** TECH_SPEC 17-3 입니다.
   *
   * > 새 SW를 즉시 활성화하지 않고, 다음 앱 시작 시 적용합니다.
   * > 기록 중에 앱이 갱신되어 입력이 날아가는 것을 막습니다.
   *
   * 새 워커는 여기서 받아만 두고 **기다립니다.** 앱을 완전히 닫아야
   * 자리를 넘겨받고, 그때 `activate` 가 예전 캐시를 지웁니다.
   *
   * 넣어도 **빨라지지 않습니다.** 화면 이동이 캐시 우선이라 새 껍데기는
   * 어차피 다음에 열 때 보입니다. 대신 위험만 생깁니다 — 활성화가
   * 예전 캐시를 지우는데, 그 순간 열려 있던 화면이 인트로 영상처럼
   * 아직 안 받은 것을 찾으면 네트워크로 나가고, 예전 배포의 자산은
   * 이미 서버에 없습니다 (`vercel.json` 이 그것을 HTML 로 돌려줍니다).
   *
   * 대가는 **배포가 한 번 더 늦게 보이는 것**입니다. 그 값으로 기록 중인
   * 화면이 발밑에서 바뀌지 않는 것을 삽니다.
   */
}

// ── 활성화 ──────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(takeOver())
})

async function takeOver() {
  /*
   * 여기까지 왔다는 것은 **앱이 완전히 닫혔다 열렸다**는 뜻입니다
   * (`skipWaiting` 을 쓰지 않으므로). 그래서 지금은 지워도 안전합니다 —
   * 예전 캐시를 보고 있는 화면이 없습니다.
   *
   * 앱을 안 닫은 채 배포가 여러 번 나면 기다리는 워커마다 캐시를 하나씩
   * 만들어 둡니다. 여기서 한꺼번에 정리되므로 쌓이지 않습니다.
   */
  const names = await caches.keys()
  await Promise.all(
    names
      // 접두사로 거릅니다. 같은 출처에 다른 캐시가 있을 수 있고, 남의 것을
      // 지우면 그쪽이 조용히 망가집니다.
      .filter((name) => name.startsWith(PREFIX) && name !== CACHE)
      .map((name) => caches.delete(name)),
  )
  /*
   * 첫 방문에도 이 워커가 그 화면을 맡습니다. 없으면 처음 연 사람은
   * 아무것도 캐시되지 않은 채 두 번째 방문을 기다려야 합니다.
   *
   * **위 17-3 과 부딪히지 않습니다.** 그 규칙은 *갱신*에 관한 것이고,
   * 갱신 때의 활성화는 이미 모든 창이 닫힌 뒤라 맡을 화면이 없습니다.
   * 여기가 실제로 일하는 경우는 **처음 설치** 하나뿐입니다.
   */
  await self.clients.claim()
}

// ── 요청 ────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const plan = route(event.request)
  if (plan === 'pass') return
  event.respondWith(plan === 'shell' ? fromShell(event) : fromCache(event))
})

/**
 * 이 요청을 어떻게 할 것인가. **판정을 여기 한 곳에 모읍니다** —
 * 테스트가 갈래를 전부 밟을 수 있어야 합니다.
 */
function route(request) {
  if (!stamped()) return 'pass'
  // GET 이 아닌 것은 캐시에 넣을 수 없습니다.
  if (request.method !== 'GET') return 'pass'
  // Range 요청은 206 으로 옵니다. `cache.put` 이 거부합니다 (인트로 영상).
  if (request.headers.has('range')) return 'pass'
  if (new URL(request.url).origin !== self.location.origin) return 'pass'
  if (request.mode === 'navigate') return 'shell'
  return 'asset'
}

/** 화면 이동 — 캐시에 있는 껍데기를 즉시 주고, 배경에서 새것을 받아 둡니다. */
async function fromShell(event) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(SHELL, MATCH)
  // 아직 아무것도 없으면(설치 직후, 또는 캐시가 지워짐) 그냥 네트워크입니다.
  if (cached === undefined) return fetch(event.request)
  event.waitUntil(refreshShell(cache))
  return cached
}

async function refreshShell(cache) {
  try {
    // `no-cache` 로 HTTP 캐시를 건너뜁니다. 안 그러면 배포가 하루 늦게 보입니다.
    const response = await fetch(SHELL, { cache: 'no-cache' })
    if (keepable(SHELL, response)) await cache.put(SHELL, response)
  } catch {
    // 오프라인입니다. 들고 있는 껍데기가 그대로 유효합니다.
  }
}

/** 그 밖의 자산 — 이름에 해시가 붙어 있어 캐시 우선이 안전합니다. */
async function fromCache(event) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(event.request, MATCH)
  if (cached !== undefined) return cached

  const response = await fetch(event.request)
  if (keepable(new URL(event.request.url).pathname, response)) {
    event.waitUntil(cache.put(event.request, response.clone()))
  }
  return response
}

/**
 * 이 응답을 캐시에 담아도 되는가. **위 주석의 「손대면 안 되는 자리」
 * 2번과 3번이 여기 있습니다.**
 */
function keepable(path, response) {
  // 403(챌린지)·404·500 을 담으면 그 실패가 캐시에 눌러앉습니다.
  if (!response.ok) return false
  // 다른 출처의 불투명 응답은 내용을 볼 수 없어 판단할 수 없습니다.
  if (response.type === 'opaque') return false
  /*
   * `vercel.json` 의 `"/(.*)"` 가 없는 파일을 전부 `index.html` 로 보냅니다.
   * 그래서 오타 난 자산 경로가 **200 에 HTML** 로 옵니다. 담으면 그 경로는
   * 영영 HTML 을 돌려줍니다.
   */
  const type = response.headers.get('content-type') ?? ''
  if (path !== SHELL && type.startsWith('text/html')) return false
  return true
}
