import { describe, expect, it } from 'vitest'
import { nextPath, type GateState } from '../src/app/gate'
import { HOME_PATH, INTRO_PATH, PET_NEW_PATH, WELCOME_PATH } from '../src/app/routes'

/**
 * 진입 관문의 갈래 (`src/app/gate.ts`).
 *
 * **이 표가 한 번 틀렸습니다.** 처음 구현은 온보딩 순서대로 인트로를 먼저
 * 봤는데, 그러면 주소로 곧바로 기록 화면에 들어온 사람이 갇혔습니다 —
 * 기록 화면이 아이가 없다고 등록으로 보내고, 인트로는 지나지 않은 채로
 * 남아서, 다음에 앱을 열면 인트로 → 등록으로 가서 **이미 있는 아이를 또
 * 만들었습니다.**
 *
 * 그래서 여기 있는 것은 "구현이 이렇게 되어 있다"가 아니라 **"어떤 상태에서
 * 열어도 갇히지 않는다"** 는 단언입니다. 여덟 갈래를 전부 적어 둔 이유도
 * 그것입니다 — 하나를 바꾸면 나머지 일곱이 아직 맞는지 여기서 보입니다.
 */

/** 여덟 갈래를 빠짐없이 적기 위한 조합 생성. */
const STATES: readonly GateState[] = [false, true].flatMap((hasPet) =>
  [false, true].flatMap((introSeen) =>
    [false, true].map((disclaimerAcked) => ({ hasPet, introSeen, disclaimerAcked })),
  ),
)

describe('진입 관문', () => {
  it('아무것도 없으면 인트로', () => {
    expect(nextPath({ hasPet: false, introSeen: false, disclaimerAcked: false })).toBe(INTRO_PATH)
  })

  it('인트로만 지났으면 아이 등록', () => {
    expect(nextPath({ hasPet: false, introSeen: true, disclaimerAcked: false })).toBe(PET_NEW_PATH)
  })

  it('아이가 있고 고지 전이면 마무리', () => {
    // 마무리 화면이 아이 이름을 부르므로 아이보다 앞에 올 수 없습니다.
    expect(nextPath({ hasPet: true, introSeen: true, disclaimerAcked: false })).toBe(WELCOME_PATH)
  })

  it('셋 다 있으면 홈', () => {
    expect(nextPath({ hasPet: true, introSeen: true, disclaimerAcked: true })).toBe(HOME_PATH)
  })

  it('아이가 있으면 인트로를 지나지 않았어도 인트로로 보내지 않는다', () => {
    /**
     * **이것이 갇히던 갈래입니다.** 아이가 있다는 것은 첫 실행이 아니라는
     * 뜻이고, 인트로는 첫 실행에만 있는 화면입니다. 여기서 인트로로 보내면
     * 그 뒤가 등록이라 아이가 하나 더 생깁니다.
     */
    expect(nextPath({ hasPet: true, introSeen: false, disclaimerAcked: true })).toBe(HOME_PATH)
    expect(nextPath({ hasPet: true, introSeen: false, disclaimerAcked: false })).toBe(WELCOME_PATH)
  })

  it('아이가 없으면 고지를 했더라도 등록보다 앞서지 않는다', () => {
    // 고지만 남고 아이가 사라진 상태(백업을 가져오다 만 경우 등).
    expect(nextPath({ hasPet: false, introSeen: true, disclaimerAcked: true })).toBe(PET_NEW_PATH)
    expect(nextPath({ hasPet: false, introSeen: false, disclaimerAcked: true })).toBe(INTRO_PATH)
  })

  it('어떤 상태에서도 관문 자신으로 되보내지 않는다', () => {
    // `/` 로 되보내면 리다이렉트가 무한히 돕니다.
    for (const state of STATES) expect(nextPath(state)).not.toBe('/')
  })

  it('여덟 갈래 전부가 아는 화면으로 간다', () => {
    const known = [INTRO_PATH, PET_NEW_PATH, WELCOME_PATH, HOME_PATH]
    expect(STATES).toHaveLength(8)
    for (const state of STATES) expect(known).toContain(nextPath(state))
  })
})
