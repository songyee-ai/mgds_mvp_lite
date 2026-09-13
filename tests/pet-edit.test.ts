/**
 * 아이 정보 고치기의 규칙 (`features/pet/editForm.ts`).
 *
 * 이 화면이 생긴 이유는 **등록 화면이 유일한 입구였기 때문**입니다 —
 * 이름 · 사진 · 병원이 등록할 때 한 번이 마지막이었고, 특히 병원
 * 전화번호는 오타를 되돌릴 방법이 없었습니다. 그 번호는 밤중에 급할 때
 * 누르는 번호입니다 (PRD FR-2-3).
 *
 * 여기가 지키는 계약은 둘입니다.
 *
 * 1. **비운다는 것도 뜻이 있는 입력이다** — 병원을 지울 유일한 방법입니다
 * 2. **바뀌지 않았으면 쓰지 않는다** — `updated_at` 만 움직이면 나중의
 *    동기화가 헛일을 합니다
 */

import { describe, expect, it } from 'vitest'
import { copy } from '../src/copy'
import {
  clinicActionOf,
  editProblemsOf,
  namePatchOf,
  type EditProblem,
  type PetEditForm,
} from '../src/features/pet/editForm'

const form = (patch: Partial<PetEditForm> = {}): PetEditForm => ({
  name: '보리',
  clinicName: '',
  clinicPhone: '',
  ...patch,
})

const existing = { id: 'clinic-1', name: '행복동물병원', phone: '02-000-0000' }

describe('저장을 막는 이유', () => {
  it('이름만 있으면 막지 않는다', () => {
    expect(editProblemsOf(form())).toEqual([])
  })

  it('이름이 비면 막는다. 공백만 적어도 막는다', () => {
    expect(editProblemsOf(form({ name: '' }))).toEqual(['name_required'])
    expect(editProblemsOf(form({ name: '   ' }))).toEqual(['name_required'])
  })

  it('병원을 한쪽만 적으면 막는다 — 반쪽짜리 연락처가 가장 나쁩니다', () => {
    expect(editProblemsOf(form({ clinicName: '행복동물병원' }))).toEqual(['clinic_incomplete'])
    expect(editProblemsOf(form({ clinicPhone: '02-000-0000' }))).toEqual(['clinic_incomplete'])
  })

  it('둘 다 적거나 둘 다 비우면 막지 않는다', () => {
    expect(editProblemsOf(form({ clinicName: '행복', clinicPhone: '02-1' }))).toEqual([])
    expect(editProblemsOf(form())).toEqual([])
  })

  /**
   * 문구는 등록 화면 것을 그대로 씁니다. 같은 규칙에 다른 말을 두면
   * 등록과 수정이 서로 다른 앱처럼 보입니다.
   */
  it('막는 이유마다 등록 화면의 문구가 있다', () => {
    const keys: EditProblem[] = ['name_required', 'clinic_incomplete']
    for (const key of keys) {
      expect(copy.petCreate.problems[key]).toBeTypeOf('string')
      expect(copy.petCreate.problems[key].length).toBeGreaterThan(0)
    }
  })
})

describe('병원을 어떻게 할 것인가', () => {
  it('없던 것을 적으면 만든다. 앞뒤 공백은 지운다', () => {
    const action = clinicActionOf(
      form({ clinicName: ' 행복동물병원 ', clinicPhone: ' 02-000-0000 ' }),
      undefined,
    )
    expect(action).toEqual({ kind: 'create', name: '행복동물병원', phone: '02-000-0000' })
  })

  it('있던 것을 바꾸면 고친다', () => {
    const action = clinicActionOf(
      form({ clinicName: '행복동물병원', clinicPhone: '02-999-9999' }),
      existing,
    )
    expect(action).toEqual({
      kind: 'update',
      id: 'clinic-1',
      name: '행복동물병원',
      phone: '02-999-9999',
    })
  })

  /** `updated_at` 만 움직이면 나중의 동기화가 헛일을 합니다. */
  it('같은 값이면 아무것도 하지 않는다', () => {
    const action = clinicActionOf(
      form({ clinicName: '행복동물병원', clinicPhone: '02-000-0000' }),
      existing,
    )
    expect(action).toEqual({ kind: 'none' })
  })

  /**
   * **이 줄이 이 파일에서 가장 중요합니다.** 비운 것을 무시하면 한 번 적은
   * 병원을 지울 방법이 없어집니다 — 이 화면이 메우려던 구멍이 병원 쪽에
   * 그대로 다시 생깁니다.
   */
  it('있던 것을 비우면 지운다', () => {
    expect(clinicActionOf(form(), existing)).toEqual({ kind: 'remove', id: 'clinic-1' })
    expect(clinicActionOf(form({ clinicName: '  ', clinicPhone: ' ' }), existing)).toEqual({
      kind: 'remove',
      id: 'clinic-1',
    })
  })

  it('없던 것을 비운 채로 두면 아무것도 하지 않는다', () => {
    expect(clinicActionOf(form(), undefined)).toEqual({ kind: 'none' })
  })
})

describe('이름 패치', () => {
  it('바뀌었을 때만 담는다', () => {
    expect(namePatchOf(form({ name: '보리' }), '보리')).toBeNull()
    expect(namePatchOf(form({ name: '초코' }), '보리')).toEqual({ name: '초코' })
  })

  it('앞뒤 공백만 다른 것은 바뀐 것이 아니다', () => {
    expect(namePatchOf(form({ name: '  보리  ' }), '보리')).toBeNull()
  })
})
