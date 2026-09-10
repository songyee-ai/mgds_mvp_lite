import { HOME_PATH, INTRO_PATH, PET_NEW_PATH, WELCOME_PATH } from './routes'

/**
 * 앱을 열었을 때 어디로 가야 하는가 — 판단만 하는 순수 함수.
 *
 * `RootGate` 컴포넌트에서 이 판단을 떼어낸 이유는 **여기가 실제로 틀렸던
 * 자리**이기 때문입니다. 처음에는 온보딩 순서대로 인트로를 먼저 봤는데,
 * 주소로 곧바로 기록 화면에 들어온 사람은 인트로를 지나지 않고 등록으로
 * 가므로 그 다음 실행에서 인트로로 되돌아가고, 인트로를 지나면 다시 등록으로
 * 가서 **이미 있는 아이를 또 만들었습니다.**
 *
 * 컴포넌트 안에 있으면 그 갈래를 확인하려면 화면을 렌더해야 하고, 이
 * 저장소에는 아직 `jsdom` 이 없습니다. 함수로 떼어 놓으면 네 갈래를
 * 표로 확인할 수 있습니다 (`tests/app-gate.test.ts`).
 */
export interface GateState {
  /** 아이가 실제로 존재하는가. `active_pet_id` 만 남은 경우는 `false` 입니다. */
  readonly hasPet: boolean
  /** 인트로 3장을 지났는가 (`settings.intro_seen_at`). */
  readonly introSeen: boolean
  /** 의료 고지를 했는가 (`settings.medical_disclaimer_ack_at` · PRD NFR-M M-5). */
  readonly disclaimerAcked: boolean
}

/**
 * **아이가 있는지를 먼저 봅니다.**
 *
 * 아이가 있다는 것은 이 사람이 첫 실행이 아니라는 뜻이고, 인트로는 첫
 * 실행에만 있는 화면입니다. 그래서 인트로를 지났는지는 **아이가 없을 때만**
 * 묻습니다.
 *
 * 고지는 아이 뒤에 옵니다 — 마무리 화면이 아이 이름을 부르기 때문입니다.
 */
export function nextPath(state: GateState): string {
  if (state.hasPet) return state.disclaimerAcked ? HOME_PATH : WELCOME_PATH
  return state.introSeen ? PET_NEW_PATH : INTRO_PATH
}
