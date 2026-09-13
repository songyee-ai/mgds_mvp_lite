/**
 * 서비스 워커 (`public/sw.js`).
 *
 * ## 이 파일이 왜 이렇게 생겼나
 *
 * 워커는 번들되지 않습니다. `public/` 에 그대로 놓인 평범한 JS 라 import
 * 할 수가 없습니다. 그래서 **파일을 글자 그대로 읽어(`?raw`) 함수로 감싸
 * 돌립니다.** 가짜 `self` · `caches` · `fetch` 를 넣어 주고, 진짜 코드가
 * 진짜로 무엇을 하는지 봅니다.
 *
 * `node:fs` 와 `node:vm` 을 쓰지 않는 이유는 `@types/node` 입니다. 들이면
 * tsconfig 의 `types` 에 `node` 를 넣어야 하고, 그러면 **앱 코드에서도**
 * `process` 같은 것이 보이게 됩니다. Vite 의 `?raw` 로 충분합니다.
 *
 * 자리표시자는 `scripts/stamp-sw.mjs` 의 **진짜 `stamp()`** 로 채웁니다.
 * 여기서 흉내 내면 자리표시자가 바뀌는 날 테스트만 초록이 됩니다.
 *
 * ## 무엇을 지키는가
 *
 * 캐시는 잘못 넣으면 **사용자가 고칠 방법을 모릅니다.** 앱이 낡은 화면을
 * 들고 있어도, 403 을 캐시에 물고 있어도, 화면에는 "고장"이라고 안 쓰여
 * 있습니다. 그래서 담지 **않아야** 하는 경우들이 여기 절반입니다.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import SOURCE from '../public/sw.js?raw'
import { precacheList, stamp } from '../scripts/stamp-sw.mjs'
import { shouldRegister } from '../src/app/sw'

const ORIGIN = 'https://mgds-mvp-lite.vercel.app'

/** 이번 빌드가 미리 받아 두는 것들. 실제 `dist/` 와 같은 모양입니다. */
const PRECACHE = ['/index.html', '/assets/index-AAA.css', '/assets/index-BBB.js']

// ── 가짜 브라우저 ───────────────────────────────────────────────────────

const absolute = (url: string): string => new URL(url, ORIGIN).href

/**
 * Cache API 흉내.
 *
 * **`match` 가 복제본을 돌려주는 것이 중요합니다.** 진짜도 그렇습니다 —
 * 응답 본문은 한 번만 읽을 수 있어서, 같은 객체를 두 번 주면 두 번째
 * 방문이 빈 화면이 됩니다.
 */
type Entry = {
  response: Response
  /**
   * 담을 때 함께 간 `Origin` 헤더.
   *
   * 서버가 자산에 `Vary: Origin` 을 붙입니다. 그러면 이것이 **짝의 일부**가
   * 되어, 꺼낼 때의 `Origin` 이 다르면 캐시에 있어도 못 찾습니다.
   * `ignoreVary` 가 그 규칙을 끕니다.
   */
  origin: string | null
}

class FakeCache {
  readonly entries = new Map<string, Entry>()

  async match(
    key: string | FakeRequest,
    options: { ignoreVary?: boolean } = {},
  ): Promise<Response | undefined> {
    const found = this.entries.get(absolute(typeof key === 'string' ? key : key.url))
    if (found === undefined) return undefined
    if (options.ignoreVary !== true && found.origin !== originOf(key)) return undefined
    return found.response.clone()
  }

  async put(key: string | FakeRequest, value: Response): Promise<void> {
    const url = absolute(typeof key === 'string' ? key : key.url)
    this.entries.set(url, { response: value.clone(), origin: originOf(key) })
  }

  async addAll(urls: string[]): Promise<void> {
    for (const url of urls) {
      const response = await network(absolute(url))
      if (!response.ok) throw new TypeError(`addAll 실패: ${url}`)
      // 진짜 `addAll` 도 `Origin` 없이 받아 옵니다. 이 한 줄이 함정의 절반입니다.
      this.entries.set(absolute(url), { response, origin: null })
    }
  }
}

/** 요청이 들고 간 `Origin`. 문자열로 부르면 헤더가 없습니다. */
function originOf(key: string | FakeRequest): string | null {
  if (typeof key === 'string') return null
  return key.headers.get('origin')
}

const caches = new Map<string, FakeCache>()

const cacheStorage = {
  async open(name: string): Promise<FakeCache> {
    const existing = caches.get(name)
    if (existing !== undefined) return existing
    const made = new FakeCache()
    caches.set(name, made)
    return made
  },
  async keys(): Promise<string[]> {
    return [...caches.keys()]
  },
  async delete(name: string): Promise<boolean> {
    return caches.delete(name)
  },
}

/** 서버에 놓인 것들. 여기 없는 경로는 `vercel.json` 이 HTML 로 돌려줍니다. */
let served: Map<string, Response>
let offline = false
let requests: string[] = []

const HTML = { headers: { 'content-type': 'text/html; charset=utf-8' } }
const JS = { headers: { 'content-type': 'text/javascript' } }

async function network(input: string | { url: string }): Promise<Response> {
  const url = absolute(typeof input === 'string' ? input : input.url)
  requests.push(url)
  if (offline) throw new TypeError('Failed to fetch')
  const found = served.get(url)
  if (found !== undefined) return found.clone()
  /*
   * **없는 파일이 404 가 아닙니다.** `vercel.json` 의 `"/(.*)"` 가 전부
   * index.html 로 보냅니다 (handoff/STATE.md 4-5). 워커가 이것을 담으면
   * 그 경로는 영영 HTML 을 돌려줍니다.
   */
  return new Response('<!doctype html><title>More Good Days</title>', { status: 200, ...HTML })
}

type FetchEvent = {
  request: FakeRequest
  respondWith: (value: Promise<Response>) => void
  waitUntil: (value: Promise<unknown>) => void
}

type FakeRequest = { url: string; method: string; mode: string; headers: Headers }

function request(
  url: string,
  init: { method?: string; mode?: string; headers?: Record<string, string> } = {},
): FakeRequest {
  return {
    url: absolute(url),
    method: init.method ?? 'GET',
    mode: init.mode ?? 'cors',
    headers: new Headers(init.headers),
  }
}

/** 워커 한 벌. 핸들러 세 개를 밖에서 부를 수 있게 내놓습니다. */
function boot(source: string) {
  const handlers = new Map<string, (event: unknown) => void>()
  const skipWaiting = { called: false }
  const claim = { called: false }

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers.set(type, handler)
    },
    skipWaiting: async () => {
      skipWaiting.called = true
    },
    clients: {
      claim: async () => {
        claim.called = true
      },
    },
  }

  /*
   * 함수로 감싸서 돌립니다. 워커가 전역으로 아는 이름들(`self` · `caches` ·
   * `fetch`)이 여기서는 인자가 되고, 워커의 최상위 `const` 들은 이 호출
   * 안에만 삽니다 — 한 테스트가 다음 테스트에 새지 않습니다.
   */
  new Function('self', 'caches', 'fetch', 'Response', 'Headers', 'URL', source)(
    self,
    cacheStorage,
    network,
    Response,
    Headers,
    URL,
  )

  const lifecycle = async (type: 'install' | 'activate'): Promise<void> => {
    const waits: Promise<unknown>[] = []
    handlers.get(type)?.({ waitUntil: (value: Promise<unknown>) => waits.push(value) })
    await Promise.all(waits)
  }

  return {
    skipWaiting,
    claim,
    install: () => lifecycle('install'),
    activate: () => lifecycle('activate'),
    /** 요청 하나를 흘려 보냅니다. 워커가 손대지 않았으면 `undefined`. */
    async fetch(req: FakeRequest): Promise<Response | undefined> {
      const waits: Promise<unknown>[] = []
      let answered: Promise<Response> | undefined
      const event: FetchEvent = {
        request: req,
        respondWith: (value) => {
          answered = value
        },
        waitUntil: (value) => {
          waits.push(value)
        },
      }
      handlers.get('fetch')?.(event)
      if (answered === undefined) return undefined
      const response = await answered
      // 배경 작업(캐시 갱신)이 끝나야 다음 단언이 제대로 봅니다.
      await Promise.all(waits)
      return response
    },
  }
}

/** 자리표시자가 채워진, 실제로 배포되는 모양의 워커. */
const stamped = (): string =>
  stamp(SOURCE, { version: 'testbuild01', precache: PRECACHE })

beforeEach(() => {
  caches.clear()
  requests = []
  offline = false
  served = new Map([
    [absolute('/index.html'), new Response('<!doctype html>새 껍데기', { status: 200, ...HTML })],
    [absolute('/assets/index-AAA.css'), new Response('body{}', { status: 200 })],
    [absolute('/assets/index-BBB.js'), new Response('console.log(1)', { status: 200, ...JS })],
    [absolute('/assets/logo-CCC.webp'), new Response('webp', { status: 200 })],
  ])
})

// ── 설치와 활성화 ───────────────────────────────────────────────────────

describe('설치', () => {
  it('프리캐시 목록을 전부 받아 둔다', async () => {
    const worker = boot(stamped())
    await worker.install()

    const cache = caches.get('mgds-testbuild01')
    expect(cache).toBeDefined()
    expect([...(cache?.entries.keys() ?? [])].sort()).toEqual(PRECACHE.map(absolute).sort())
  })

  it('받아 두기만 하고 자리를 뺏지 않는다 (TECH_SPEC 17-3)', async () => {
    /*
     * > 새 SW를 즉시 활성화하지 않고, 다음 앱 시작 시 적용합니다.
     * > 기록 중에 앱이 갱신되어 입력이 날아가는 것을 막습니다.
     *
     * `skipWaiting()` 은 그 규칙을 깹니다. 화면 이동이 캐시 우선이라
     * **넣어도 새 화면이 더 빨리 오지 않고**, 활성화가 예전 캐시를 지우는
     * 바람에 열려 있던 화면만 위태로워집니다.
     */
    const worker = boot(stamped())
    await worker.install()

    expect(worker.skipWaiting.called).toBe(false)
  })

  it('하나라도 못 받으면 설치가 실패한다 — 반쪽짜리 캐시를 만들지 않는다', async () => {
    // 같은 이름의 CSS 를 404 로 바꿉니다. 배포가 덜 올라간 상황입니다.
    served.set(absolute('/assets/index-AAA.css'), new Response('', { status: 404 }))
    const worker = boot(stamped())

    await expect(worker.install()).rejects.toThrow()
  })
})

describe('활성화', () => {
  it('예전 빌드의 캐시만 지우고 남의 캐시는 두고 간다', async () => {
    caches.set('mgds-oldbuild99', new FakeCache())
    caches.set('workbox-precache', new FakeCache())

    const worker = boot(stamped())
    await worker.install()
    await worker.activate()

    expect([...caches.keys()].sort()).toEqual(['mgds-testbuild01', 'workbox-precache'])
    expect(worker.claim.called).toBe(true)
  })
})

// ── 화면 이동 ───────────────────────────────────────────────────────────

describe('화면 이동', () => {
  it('어느 주소든 캐시에 있는 껍데기로 답한다 — SPA 라 index.html 한 장입니다', async () => {
    const worker = boot(stamped())
    await worker.install()
    requests = []

    const response = await worker.fetch(request('/today/2026-09-13', { mode: 'navigate' }))

    expect(response?.status).toBe(200)
    await expect(response?.text()).resolves.toContain('껍데기')
    // 네트워크를 **기다리지 않았습니다.** 배경에서 한 번 받아 둘 뿐입니다.
    expect(requests).toEqual([absolute('/index.html')])
  })

  it('오프라인에서도 열린다', async () => {
    const worker = boot(stamped())
    await worker.install()
    offline = true

    const response = await worker.fetch(request('/pet/edit', { mode: 'navigate' }))

    await expect(response?.text()).resolves.toContain('껍데기')
  })

  it('배경에서 받은 새 껍데기가 다음 방문에 나온다', async () => {
    const worker = boot(stamped())
    await worker.install()
    served.set(absolute('/index.html'), new Response('<!doctype html>고친 껍데기', { status: 200, ...HTML }))

    await worker.fetch(request('/today', { mode: 'navigate' }))
    const second = await worker.fetch(request('/today', { mode: 'navigate' }))

    await expect(second?.text()).resolves.toContain('고친 껍데기')
  })

  it('챌린지 403 을 껍데기로 담지 않는다', async () => {
    const worker = boot(stamped())
    await worker.install()
    // Vercel 의 Attack Challenge Mode 가 켜진 상태 (handoff/STATE.md 4-5).
    served.set(absolute('/index.html'), new Response('차단', { status: 403, ...HTML }))

    await worker.fetch(request('/today', { mode: 'navigate' }))
    const second = await worker.fetch(request('/today', { mode: 'navigate' }))

    await expect(second?.text()).resolves.toContain('껍데기')
  })
})

// ── 자산 ────────────────────────────────────────────────────────────────

describe('자산', () => {
  it('캐시에 있으면 네트워크를 부르지 않는다', async () => {
    const worker = boot(stamped())
    await worker.install()
    requests = []

    await worker.fetch(request('/assets/index-BBB.js'))

    expect(requests).toEqual([])
  })

  it('`Origin` 을 들고 온 요청도 캐시에서 찾는다 — 이것이 흰 화면의 원인이었습니다', async () => {
    /*
     * Vite 는 진입 스크립트와 스타일시트에 `crossorigin` 을 붙입니다. 그
     * 요청만 `Origin` 헤더를 들고 오는데, `cache.addAll` 은 `Origin` 없이
     * 받아 담습니다. 서버가 `Vary: Origin` 을 붙이면 둘이 짝이 되지 않아
     * **캐시에 있는데도 네트워크로 나갑니다.**
     *
     * 온라인에서는 아무 표도 안 납니다. 서버를 끄고 열어야 보입니다 —
     * 2026-09-13 에 미리보기 서버를 끄고 확인했을 때 JS 와 CSS **둘만**
     * 떨어지고 화면이 하얬습니다. `ignoreVary` 가 답입니다.
     */
    const worker = boot(stamped())
    await worker.install()
    offline = true

    const js = await worker.fetch(request('/assets/index-BBB.js', { headers: { origin: ORIGIN } }))
    const css = await worker.fetch(request('/assets/index-AAA.css', { headers: { origin: ORIGIN } }))

    await expect(js?.text()).resolves.toBe('console.log(1)')
    await expect(css?.text()).resolves.toBe('body{}')
  })

  it('처음 보는 것은 받아서 담아 둔다 — 인트로 포스터가 이 경로입니다', async () => {
    const worker = boot(stamped())
    await worker.install()

    await worker.fetch(request('/assets/logo-CCC.webp'))
    requests = []
    const again = await worker.fetch(request('/assets/logo-CCC.webp'))

    await expect(again?.text()).resolves.toBe('webp')
    expect(requests).toEqual([])
  })

  it('없는 파일이 200 HTML 로 와도 담지 않는다', async () => {
    /*
     * `vercel.json` 이 404 를 안 돌려줍니다. 이것을 담으면 그 경로는 캐시가
     * 지워질 때까지 HTML 을 돌려주고, 화면은 조용히 깨진 채로 남습니다.
     */
    const worker = boot(stamped())
    await worker.install()

    await worker.fetch(request('/assets/오타-DDD.js'))
    const cache = caches.get('mgds-testbuild01')

    expect(cache?.entries.has(absolute('/assets/오타-DDD.js'))).toBe(false)
  })

  it('실패한 응답을 담지 않는다', async () => {
    served.set(absolute('/assets/logo-CCC.webp'), new Response('', { status: 500 }))
    const worker = boot(stamped())
    await worker.install()

    await worker.fetch(request('/assets/logo-CCC.webp'))
    const cache = caches.get('mgds-testbuild01')

    expect(cache?.entries.has(absolute('/assets/logo-CCC.webp'))).toBe(false)
  })
})

// ── 손대지 않는 것들 ────────────────────────────────────────────────────

describe('가로채지 않는 요청', () => {
  it('Range 요청 — 인트로 영상입니다. 206 은 캐시에 넣을 수 없습니다', async () => {
    const worker = boot(stamped())
    await worker.install()

    const response = await worker.fetch(
      request('/assets/intro-1-EEE.mp4', { headers: { range: 'bytes=0-' } }),
    )

    expect(response).toBeUndefined()
  })

  it('GET 이 아닌 요청', async () => {
    const worker = boot(stamped())
    await worker.install()

    expect(await worker.fetch(request('/index.html', { method: 'POST' }))).toBeUndefined()
  })

  it('다른 출처', async () => {
    const worker = boot(stamped())
    await worker.install()

    expect(await worker.fetch(request('https://example.com/a.js'))).toBeUndefined()
  })

  it('자리표시자가 안 박힌 워커는 아무것도 하지 않는다', async () => {
    /*
     * 개발 서버의 `public/sw.js` 가 이 상태입니다. 빌드가 `stamp:sw` 를
     * 빠뜨려도 마찬가지입니다 — **깨진 채로 가로채는 것보다 비켜서는 것이
     * 낫습니다.**
     */
    const worker = boot(SOURCE)
    await worker.install()

    expect(await worker.fetch(request('/today', { mode: 'navigate' }))).toBeUndefined()
    expect(await worker.fetch(request('/assets/index-BBB.js'))).toBeUndefined()
    expect(caches.size).toBe(0)
  })
})

// ── 빌드가 박아 넣는 값 ─────────────────────────────────────────────────

describe('프리캐시 목록', () => {
  const DIST = [
    'index.html',
    'sw.js',
    'manifest.webmanifest',
    'app-icon-512.png',
    'favicon-32.png',
    'assets/index-AAA.css',
    'assets/index-BBB.js',
    'assets/intro-1-EEE.mp4',
    'assets/intro-1-poster-FFF.webp',
  ]

  it('영상과 아이콘과 워커 자신을 뺀다', () => {
    expect(precacheList(DIST)).toEqual([
      '/assets/index-AAA.css',
      '/assets/index-BBB.js',
      '/assets/intro-1-poster-FFF.webp',
      '/index.html',
      '/manifest.webmanifest',
    ])
  })

  it('껍데기가 없으면 던진다 — 오프라인에서 아무것도 안 열립니다', () => {
    expect(() => precacheList(['assets/index-BBB.js'])).toThrow()
  })

  it('자리표시자를 못 찾으면 던진다 — 조용히 지나가면 배포가 빈 워커를 싣습니다', () => {
    expect(() => stamp('const VERSION = 1', { version: 'x', precache: [] })).toThrow()
  })
})

// ── 등록 ────────────────────────────────────────────────────────────────

describe('등록 판정', () => {
  it('프로덕션에서만 등록한다 — 개발 중 캐시는 자기 코드를 의심하게 만듭니다', () => {
    expect(shouldRegister({ prod: true, supported: true })).toBe(true)
    expect(shouldRegister({ prod: false, supported: true })).toBe(false)
  })

  it('모르는 브라우저에서는 등록하지 않는다', () => {
    expect(shouldRegister({ prod: true, supported: false })).toBe(false)
  })
})
