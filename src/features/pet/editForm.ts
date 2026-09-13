/**
 * 아이 정보 수정의 규칙 (2026-09-13).
 *
 * 화면이 아니라 순수 함수로 둡니다 — `form.ts` 와 같은 이유입니다.
 * 여기서 정하는 것이 **병원 한 곳을 만들지 · 고칠지 · 지울지**이고, 그것을
 * 브라우저 없이 확인할 수 있어야 합니다.
 *
 * ## 왜 이 화면이 생겼는가
 *
 * 등록 화면이 유일한 입구였습니다. **이름 · 사진 · 병원 전부 등록할 때
 * 한 번이 마지막**이었고, 특히 병원 전화번호는 오타가 나면 되돌릴 방법이
 * 없었습니다. 그 번호는 밤중에 급할 때 누르는 번호입니다 (PRD FR-2-3).
 *
 * 사진도 같습니다 — 등록에서 건너뛰면 홈 맨 위가 영영 빈 자리였습니다.
 *
 * ## 여기서 고치지 않는 것
 *
 * **나이 · 종 · 성별은 없습니다.** 대략 나이는 저장할 때 `오늘 - N년` 으로
 * 날짜를 만드는데(`form.ts` 의 `approximateBirthDate`), 수정 화면에서 그대로
 * 다시 저장하면 **손대지 않은 나이가 조용히 며칠씩 밀립니다.** 그 문제를
 * 제대로 풀려면 "사용자가 나이 칸을 건드렸는가"를 따로 들고 있어야 하고,
 * 그것은 이 화면이 메우려는 구멍이 아닙니다. 필요해지면 그때 별도로.
 */

import type { Clinic } from '../../data'
import type { FormProblem } from './form'

/** 수정 화면이 다루는 칸. 사진은 파일이라 폼 밖에서 따로 움직입니다. */
export type PetEditForm = {
  name: string
  clinicName: string
  clinicPhone: string
}

/**
 * 수정을 막는 이유.
 *
 * **`FormProblem` 의 부분집합입니다.** 문구를 `copy.petCreate.problems` 에서
 * 그대로 가져다 쓰기 위해서입니다 — 같은 규칙에 다른 말을 두면 등록과 수정이
 * 서로 다른 앱처럼 보입니다.
 */
export type EditProblem = Extract<FormProblem, 'name_required' | 'clinic_incomplete'>

/** 비어 있으면 저장할 수 있습니다. */
export function editProblemsOf(form: PetEditForm): EditProblem[] {
  const problems: EditProblem[] = []

  if (form.name.trim() === '') problems.push('name_required')

  // 등록 화면과 같은 규칙입니다 — 반쪽짜리 연락처가 가장 나쁩니다.
  const hasName = form.clinicName.trim() !== ''
  const hasPhone = form.clinicPhone.trim() !== ''
  if (hasName !== hasPhone) problems.push('clinic_incomplete')

  return problems
}

/**
 * 병원을 어떻게 할 것인가. **비운다는 것도 뜻이 있는 입력입니다.**
 *
 * | 지금 | 적은 것 | |
 * |---|---|---|
 * | 없음 | 없음 | `none` |
 * | 없음 | 있음 | `create` |
 * | 있음 | 있음 | `update` — 같은 값이면 `none` |
 * | 있음 | 없음 | `remove` — 지우고 싶다는 뜻으로 받습니다 |
 *
 * 마지막 줄이 결정입니다. 비운 것을 무시하면 **한 번 적은 병원을 지울 방법이
 * 없어집니다** — 이 화면이 메우려던 것과 똑같은 구멍이 병원 쪽에 다시
 * 생깁니다. 지우는 것은 `softDelete` 라 되돌릴 수 있고, 백업 파일에도 지웠다는
 * 사실이 담깁니다 (TECH_SPEC 3-3).
 */
export type ClinicAction =
  | { kind: 'none' }
  | { kind: 'create'; name: string; phone: string }
  | { kind: 'update'; id: string; name: string; phone: string }
  | { kind: 'remove'; id: string }

export function clinicActionOf(
  form: PetEditForm,
  existing: Pick<Clinic, 'id' | 'name' | 'phone'> | undefined,
): ClinicAction {
  const name = form.clinicName.trim()
  const phone = form.clinicPhone.trim()
  const filled = name !== '' && phone !== ''

  if (!filled) {
    // 한쪽만 채운 폼은 `editProblemsOf` 가 먼저 막습니다.
    return existing === undefined ? { kind: 'none' } : { kind: 'remove', id: existing.id }
  }

  if (existing === undefined) return { kind: 'create', name, phone }
  // 같은 값이면 쓰지 않습니다 — `updated_at` 만 바뀌면 동기화가 헛일을 합니다.
  if (existing.name === name && existing.phone === phone) return { kind: 'none' }
  return { kind: 'update', id: existing.id, name, phone }
}

/**
 * 이름이 바뀌었을 때만 담는 패치.
 *
 * 바뀐 것이 없으면 `repo.pets.update` 를 아예 부르지 않습니다. 사진만 바꾼
 * 사람의 `updated_at` 이 이름 때문에 움직이지 않게 둡니다.
 */
export function namePatchOf(form: PetEditForm, current: string): { name: string } | null {
  const name = form.name.trim()
  return name === current ? null : { name }
}
