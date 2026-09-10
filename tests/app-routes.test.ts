import { describe, expect, it } from 'vitest'
import {
  BACKUP_PATH,
  HOME_PATH,
  INTRO_PATH,
  PET_NEW_PATH,
  WELCOME_PATH,
} from '../src/app/routes'

/**
 * 라이트 버전의 경로 (`src/app/routes.ts`).
 *
 * 본 MVP 의 `tests/shell.test.ts` 는 탭이 4개인지, 순서가 오늘·흐름·병원·
 * 아이인지를 봤습니다. **라이트에는 탭바가 없어** 그 단언이 전부 사라졌고,
 * 대신 여기서 보는 것은 **주소가 서로 겹치지 않는가** 하나입니다.
 *
 * 겹치면 리다이렉트가 조용히 순환합니다 — `RootGate` 가 보낸 곳이 다시
 * 관문으로 돌아오면 화면이 영원히 비고, 콘솔에도 아무것도 남지 않습니다.
 * 타입 검사가 못 잡는 종류의 오타라 테스트로 막습니다.
 */
describe('라이트 버전 경로', () => {
  const ALL = [INTRO_PATH, PET_NEW_PATH, WELCOME_PATH, HOME_PATH, BACKUP_PATH]

  it('경로가 서로 겹치지 않는다', () => {
    expect(new Set(ALL).size).toBe(ALL.length)
  })

  it('모든 경로가 / 로 시작한다', () => {
    // 라우터가 상대 경로로 해석해 버리면 이동이 현재 위치에 따라 달라집니다.
    for (const path of ALL) expect(path.startsWith('/')).toBe(true)
  })

  it('관문(/)을 경로로 쓰지 않는다', () => {
    // `/` 는 RootGate 의 자리입니다. 화면 경로가 여기 겹치면 관문이 사라집니다.
    for (const path of ALL) expect(path).not.toBe('/')
  })
})
