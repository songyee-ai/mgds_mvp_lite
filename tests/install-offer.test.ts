/**
 * 홈 화면에 추가 권유의 판정 (TECH_SPEC 8-6 대응 1번).
 *
 * `installOffer` 는 순수 함수라 브라우저 없이 갈래를 전부 밟을 수 있습니다.
 * 이 파일이 지키는 것은 세 문장입니다.
 *
 * 1. **이미 설치한 사람에게는 아무것도 보이지 않는다** — 닫았는지와 무관
 * 2. **한 번 닫으면 다시 묻지 않는다** — 매일 지나는 화면입니다
 * 3. **모르는 브라우저에는 아무 말도 하지 않는다** — 없는 메뉴를 찾게 하는 것이
 *    안내하지 않는 것보다 나쁩니다
 */

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type Dexie from 'dexie'
import { createDb, createLocalRepo, type Tables } from '../src/data'
import { copy } from '../src/copy'
import {
  dismissInstallPrompt,
  installOffer,
  type InstallFacts,
} from '../src/features/install/install'

/** 아무것도 설치하지 않았고 닫지도 않은, 안드로이드 크롬. */
const BASE: InstallFacts = {
  standalone: false,
  hasPromptEvent: true,
  isIos: false,
  dismissedAt: undefined,
}

const facts = (patch: Partial<InstallFacts> = {}): InstallFacts => ({ ...BASE, ...patch })

const AT = '2026-09-13T05:32:00.000Z'

describe('무엇을 보여 줄 것인가', () => {
  it('버튼을 띄울 수 있으면 버튼이다 (Android Chrome)', () => {
    expect(installOffer(facts())).toBe('prompt')
  })

  it('iOS 는 글로 알려 준다 — 앱이 창을 띄울 API 가 없습니다', () => {
    expect(installOffer(facts({ hasPromptEvent: false, isIos: true }))).toBe('ios_manual')
  })

  it('설치 방법을 모르는 브라우저에는 아무 말도 하지 않는다', () => {
    expect(installOffer(facts({ hasPromptEvent: false, isIos: false }))).toBe('hidden')
  })

  it('한 번 닫으면 다시 묻지 않는다', () => {
    expect(installOffer(facts({ dismissedAt: AT }))).toBe('hidden')
    expect(installOffer(facts({ hasPromptEvent: false, isIos: true, dismissedAt: AT }))).toBe(
      'hidden',
    )
  })

  /**
   * **순서가 있는 판정입니다.** 닫은 적이 없어도, 이벤트가 있어도,
   * 이미 홈 화면에서 열렸으면 권할 것이 없습니다.
   */
  it('이미 설치했으면 다른 무엇과도 무관하게 숨는다', () => {
    expect(installOffer(facts({ standalone: true }))).toBe('hidden')
    expect(installOffer(facts({ standalone: true, isIos: true, hasPromptEvent: false }))).toBe(
      'hidden',
    )
    expect(installOffer(facts({ standalone: true, dismissedAt: AT }))).toBe('hidden')
  })

  it('버튼이 글보다 먼저다 — iOS 라도 이벤트가 있으면 버튼', () => {
    expect(installOffer(facts({ isIos: true, hasPromptEvent: true }))).toBe('prompt')
  })
})

// ── 닫은 시각 ───────────────────────────────────────────────────────────

const opened: (Dexie & Tables)[] = []
let counter = 0

async function fresh(): Promise<Dexie & Tables> {
  counter += 1
  const db = createDb(`mgds-install-${counter}`)
  await db.open()
  opened.push(db)
  return db
}

afterEach(async () => {
  while (opened.length > 0) {
    const db = opened.pop()
    if (db !== undefined) await db.delete()
  }
})

describe('닫은 시각', () => {
  it('install_prompt_dismissed_at 에 남고, 그 뒤로 숨는다', async () => {
    const settings = createLocalRepo(await fresh()).settings
    const now = new Date(AT)

    expect(await settings.get('install_prompt_dismissed_at')).toBeUndefined()
    expect(await dismissInstallPrompt({ now, settings })).toBe(AT)
    expect(await settings.get('install_prompt_dismissed_at')).toBe(AT)

    expect(installOffer(facts({ dismissedAt: await settings.get('install_prompt_dismissed_at') })))
      .toBe('hidden')
  })

  it('저장에 실패해도 던지지 않는다 — 홈이 깨지면 안 됩니다', async () => {
    const broken = {
      get: () => Promise.reject(new Error('storage gone')),
      set: () => Promise.reject(new Error('storage gone')),
    }
    expect(await dismissInstallPrompt({ settings: broken })).toBeNull()
  })
})

// ── 문구 ────────────────────────────────────────────────────────────────

/**
 * **TECH_SPEC 8-6 대응 1번의 단서** — "단 문구에서 소실을 위협으로 쓰지
 * 않습니다". `lint-copy` 의 금지 표현 사전은 "위험"·"걱정"을 잡지만
 * "사라져요"·"7일" 은 잡지 않습니다. 그 빈칸을 여기서 막습니다.
 */
describe('겁을 주지 않는다', () => {
  const all = [
    copy.install.title,
    copy.install.why,
    copy.install.cta,
    copy.install.iosHow,
    copy.install.dismiss,
  ]

  it('소실을 말하지 않는다', () => {
    const scary = ['사라', '지워', '삭제', '없어져', '잃', '7일', '날아']
    for (const text of all) {
      for (const word of scary) {
        expect(text, `${JSON.stringify(text)} 에 "${word}"`).not.toContain(word)
      }
    }
  })

  it('얻는 것을 말한다', () => {
    expect(copy.install.why).toContain('안전하게 남아요')
  })

  /** 라이트에는 알림이 없습니다. 8-6 의 확정 문구에서 그 절반만 가져온 이유입니다. */
  it('오지 않을 알림을 약속하지 않는다', () => {
    for (const text of all) expect(text).not.toContain('알림')
  })
})
