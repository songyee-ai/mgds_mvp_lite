/**
 * 아이 등록 입력 (U10, PRD FR-1 ①).
 *
 * U10 의 테스트 목록이 요구하는 T-unit 은 한 줄입니다 — **"대략 나이 입력
 * 시 `birth_is_approximate = true`"**. 그 한 줄이 성립하려면 `대략 N살` 을
 * `birth_date` 로 옮기는 규칙도 함께 맞아야 하므로, **`ageText` 가 사용자가
 * 적은 숫자를 그대로 돌려주는지**를 왕복으로 확인합니다.
 *
 * 사진 리사이즈(`resizePhoto`)는 여기 없습니다. `canvas` 가 필요해 브라우저
 * 에서만 돕니다 — T-dev 로 확인하고 결과를 handoff/U10.md 에 적습니다.
 */

import { describe, expect, it } from 'vitest'
import { ageText } from '../src/domain'
import { copy } from '../src/copy'
import {
  EMPTY_FORM,
  MAX_APPROXIMATE_YEARS,
  approximateBirthDate,
  problemsOf,
  toNewClinic,
  toNewPet,
  type FormProblem,
  type PetForm,
} from '../src/features/pet/form'

const KST = 'Asia/Seoul'
const NOW = new Date('2026-09-09T05:00:00.000Z')

const filled = (patch: Partial<PetForm> = {}): PetForm => ({
  ...EMPTY_FORM,
  name: '보리',
  ageMode: 'birthday',
  birthDate: '2013-04-20',
  ...patch,
})

const approximate = (years: string, patch: Partial<PetForm> = {}): PetForm =>
  filled({ ageMode: 'approximate', birthDate: '', approximateYears: years, ...patch })

// ── 대략 나이 (U10 테스트 목록) ─────────────────────────────────────────

describe('대략 나이', () => {
  it('birth_is_approximate 가 true 다', () => {
    const pet = toNewPet(approximate('13'), NOW, KST)
    expect(pet.birth_is_approximate).toBe(true)
    expect(pet.birth_date).not.toBeNull()
  })

  it('생일을 고르면 birth_is_approximate 가 false 이고 고른 날짜가 그대로 남는다', () => {
    const pet = toNewPet(filled({ birthDate: '2013-04-20' }), NOW, KST)
    expect(pet.birth_is_approximate).toBe(false)
    expect(pet.birth_date).toBe('2013-04-20')
  })

  /**
   * 이 왕복이 이 파일의 핵심입니다. 사용자가 "13"을 적었으면 등록 직후
   * 화면에 "약 13살"이 떠야 합니다. `ageText` 는 `now` 를 UTC 달력으로
   * 읽고(TECH_SPEC 7-1) 등록 화면은 기기 로컬 날짜로 세므로, 두 날짜가
   * 하루 다른 시간대에 등록해도 숫자가 흔들리지 않아야 합니다.
   */
  it.each([
    ['한국 낮', '2026-09-09T05:00:00.000Z', KST],
    ['한국 오전 — UTC 는 아직 전날', '2026-09-08T23:00:00.000Z', KST],
    ['한국 자정 직후', '2026-09-09T15:00:00.000Z', KST],
    ['월 경계 — 한국은 9월 1일, UTC 는 8월 31일', '2026-08-31T23:00:00.000Z', KST],
    ['UTC 뒤쪽 시간대', '2026-09-01T02:00:00.000Z', 'America/New_York'],
    ['UTC 자체', '2026-09-09T12:00:00.000Z', 'UTC'],
  ])('%s 에서도 ageText 가 적은 숫자를 그대로 돌려준다', (_label, iso, tz) => {
    const now = new Date(iso)
    for (const years of [1, 2, 7, 13, 20, MAX_APPROXIMATE_YEARS]) {
      const pet = toNewPet(approximate(String(years)), now, tz)
      expect(ageText(pet.birth_date as string, true, now)).toBe(`약 ${years}살`)
    }
  })

  it('2월 29일에 등록해도 없는 날짜를 만들지 않는다', () => {
    // 2024-02-29 은 윤일. 3년 전 2021-02-29 는 없습니다.
    const now = new Date('2024-02-29T12:00:00.000Z')
    const birth = approximateBirthDate(3, now, 'UTC')
    expect(birth).toBe('2021-02-27')
    expect(ageText(birth, true, now)).toBe('약 3살')
  })

  it('0살은 개월로 표기된다', () => {
    const pet = toNewPet(approximate('0'), NOW, KST)
    expect(pet.birth_is_approximate).toBe(true)
    expect(ageText(pet.birth_date as string, true, NOW)).toBe('약 0개월')
  })

  it('problemsOf 를 건너뛰고 부르면 던진다', () => {
    expect(() => toNewPet(approximate('열셋'), NOW, KST)).toThrow()
    expect(() => toNewPet(filled({ birthDate: '2013-4-20' }), NOW, KST)).toThrow()
  })
})

// ── 막는 이유 ───────────────────────────────────────────────────────────

describe('problemsOf', () => {
  it('제대로 채우면 막지 않는다', () => {
    expect(problemsOf(filled(), NOW, KST)).toEqual([])
    expect(problemsOf(approximate('13'), NOW, KST)).toEqual([])
  })

  it('이름이 없으면 막는다. 공백만 적어도 막는다', () => {
    expect(problemsOf(filled({ name: '' }), NOW, KST)).toContain('name_required')
    expect(problemsOf(filled({ name: '   ' }), NOW, KST)).toContain('name_required')
  })

  it('다른 아이를 골랐으면 무엇인지 적어야 한다', () => {
    expect(problemsOf(filled({ species: 'other' }), NOW, KST)).toContain(
      'species_label_required',
    )
    expect(
      problemsOf(filled({ species: 'other', speciesOtherLabel: '토끼' }), NOW, KST),
    ).toEqual([])
  })

  it('강아지·고양이에는 라벨을 요구하지 않는다', () => {
    expect(problemsOf(filled({ species: 'dog' }), NOW, KST)).toEqual([])
    expect(problemsOf(filled({ species: 'cat' }), NOW, KST)).toEqual([])
  })

  it('생일 모드에서 생일이 없거나 미래면 막는다', () => {
    expect(problemsOf(filled({ birthDate: '' }), NOW, KST)).toContain('birth_date_required')
    expect(problemsOf(filled({ birthDate: '2026-09-10' }), NOW, KST)).toContain(
      'birth_date_future',
    )
    // 오늘은 막지 않습니다. 오늘 태어난 아이가 있을 수 있습니다.
    expect(problemsOf(filled({ birthDate: '2026-09-09' }), NOW, KST)).toEqual([])
  })

  it('대략 나이는 0~30 의 정수만 받는다', () => {
    for (const bad of ['', ' ', '열셋', '13.5', '-1', '31', '999', '1e2']) {
      expect(problemsOf(approximate(bad), NOW, KST)).toContain('approximate_years_required')
    }
    for (const good of ['0', '13', String(MAX_APPROXIMATE_YEARS)]) {
      expect(problemsOf(approximate(good), NOW, KST)).toEqual([])
    }
  })

  it('모드를 바꿔도 반대쪽 칸의 빈 값이 막지 않는다', () => {
    // 대략 나이 모드에서는 생일이 비어 있어도 됩니다.
    expect(problemsOf(approximate('13', { birthDate: '' }), NOW, KST)).toEqual([])
    // 생일 모드에서는 대략 나이가 비어 있어도 됩니다.
    expect(problemsOf(filled({ approximateYears: '' }), NOW, KST)).toEqual([])
  })

  /** 사진은 유일하게 건너뛸 수 있는 항목입니다 (PRD FR-1 표 · 완료 판정 1). */
  it('사진을 막는 이유는 없다', () => {
    expect(problemsOf(filled(), NOW, KST)).toEqual([])
    const keys: FormProblem[] = [
      'name_required',
      'species_label_required',
      'birth_date_required',
      'birth_date_future',
      'approximate_years_required',
      'adopted_at_future',
      'clinic_incomplete',
    ]
    expect(keys.some((key) => key.includes('photo'))).toBe(false)
  })

  it('막는 이유마다 문구가 있다', () => {
    const keys: FormProblem[] = [
      'name_required',
      'species_label_required',
      'birth_date_required',
      'birth_date_future',
      'approximate_years_required',
      'adopted_at_future',
      'clinic_incomplete',
    ]
    for (const key of keys) {
      expect(copy.petCreate.problems[key]).toBeTypeOf('string')
      expect(copy.petCreate.problems[key].length).toBeGreaterThan(0)
    }
    // 문구가 더 있으면 쓰이지 않는 문구입니다.
    expect(Object.keys(copy.petCreate.problems).sort()).toEqual([...keys].sort())
  })
})

// ── 입양일 (U04 ⚠️ T3 에서 넘어온 선택 항목) ────────────────────────────

describe('입양일', () => {
  it('비어 있으면 null 이다. 건너뛸 수 있어야 합니다', () => {
    expect(toNewPet(filled(), NOW, KST).adopted_at).toBeNull()
    expect(problemsOf(filled({ adoptedAt: '' }), NOW, KST)).toEqual([])
  })

  it('적으면 그대로 담긴다', () => {
    expect(toNewPet(filled({ adoptedAt: '2013-06-15' }), NOW, KST).adopted_at).toBe('2013-06-15')
  })

  it('미래면 막는다', () => {
    expect(problemsOf(filled({ adoptedAt: '2026-09-10' }), NOW, KST)).toContain(
      'adopted_at_future',
    )
  })
})

// ── 자주 가는 병원 (PRD FR-2-3 의 안전 경로) ───────────────────────────

/**
 * **이 두 칸이 라이트에서 병원이 생기는 유일한 경로입니다.**
 *
 * 2026-09-13 이전에는 이 칸이 없었고, 그래서 `repo.clinics.primary()` 가
 * 언제나 `undefined` 였습니다 — 위험 태그를 골라도 `RiskContact` 가 뜰 수
 * 없었다는 뜻입니다. 각각의 결정(병원 화면 없음 · 홈의 「밤중에 급하면」
 * 카드 삭제)은 문서에 있었지만 **그 합이 0 이 된다는 것은 아무 데도
 * 없었습니다.** 그 구멍이 다시 열리면 여기서 걸립니다.
 */
describe('자주 가는 병원', () => {
  it('비어 있으면 만들지 않는다. 건너뛸 수 있어야 합니다', () => {
    expect(problemsOf(filled(), NOW, KST)).toEqual([])
    expect(toNewClinic(filled(), 'pet-1')).toBeNull()
  })

  it('둘 다 적으면 대표 병원 한 곳이 된다', () => {
    const form = filled({ clinicName: ' 행복동물병원 ', clinicPhone: ' 02-000-0000 ' })
    expect(problemsOf(form, NOW, KST)).toEqual([])
    expect(toNewClinic(form, 'pet-1')).toEqual({
      pet_id: 'pet-1',
      // 앞뒤 공백은 지웁니다. tel: 스킴에 공백이 그대로 가면 안 됩니다.
      name: '행복동물병원',
      phone: '02-000-0000',
      address: null,
      lat: null,
      lng: null,
      // `repo.clinics.primary()` 가 이 깃발을 보고 고릅니다.
      is_primary: true,
    })
  })

  it('한쪽만 적으면 막는다 — 반쪽짜리 연락처가 가장 나쁩니다', () => {
    expect(problemsOf(filled({ clinicName: '행복동물병원' }), NOW, KST)).toEqual([
      'clinic_incomplete',
    ])
    expect(problemsOf(filled({ clinicPhone: '02-000-0000' }), NOW, KST)).toEqual([
      'clinic_incomplete',
    ])
  })

  it('problemsOf 를 건너뛰고 부르면 던진다', () => {
    expect(() => toNewClinic(filled({ clinicName: '행복동물병원' }), 'pet-1')).toThrow()
    expect(() => toNewClinic(filled({ clinicPhone: '02-000-0000' }), 'pet-1')).toThrow()
  })

  it('공백만 적은 것은 적지 않은 것이다', () => {
    const form = filled({ clinicName: '   ', clinicPhone: '  ' })
    expect(problemsOf(form, NOW, KST)).toEqual([])
    expect(toNewClinic(form, 'pet-1')).toBeNull()
  })
})

// ── NewPet 의 모양 ──────────────────────────────────────────────────────

describe('toNewPet', () => {
  it('이름의 앞뒤 공백을 지운다', () => {
    expect(toNewPet(filled({ name: '  보리  ' }), NOW, KST).name).toBe('보리')
  })

  it('사진은 나중에 담으므로 photo_id 가 null 이다', () => {
    expect(toNewPet(filled(), NOW, KST).photo_id).toBeNull()
  })

  /**
   * 품종·중성화는 v1.1 이고 U10 의 "하지 않을 것"입니다. PRD FR-1 수용
   * 기준이 온보딩에서 묻지 않는 항목으로 명시합니다. **여기에 값이 들어오면
   * 화면이 그것을 물었다는 뜻입니다.**
   */
  it('품종·중성화를 채우지 않는다', () => {
    const pet = toNewPet(filled(), NOW, KST)
    expect(pet.breed).toBeNull()
    expect(pet.neutered).toBeNull()
  })

  it('다른 아이의 라벨만 species_other_label 에 담긴다', () => {
    expect(
      toNewPet(filled({ species: 'other', speciesOtherLabel: ' 토끼 ' }), NOW, KST)
        .species_other_label,
    ).toBe('토끼')
    // 강아지를 고른 뒤 라벨 칸에 남아 있던 값은 버립니다.
    expect(
      toNewPet(filled({ species: 'dog', speciesOtherLabel: '토끼' }), NOW, KST)
        .species_other_label,
    ).toBeNull()
  })

  it('성별 3종이 그대로 담긴다', () => {
    for (const sex of ['female', 'male', 'unknown'] as const) {
      expect(toNewPet(filled({ sex }), NOW, KST).sex).toBe(sex)
    }
  })

  it('기본값은 강아지·성별 모름·생일 모드다', () => {
    expect(EMPTY_FORM.species).toBe('dog')
    expect(EMPTY_FORM.sex).toBe('unknown')
    expect(EMPTY_FORM.ageMode).toBe('birthday')
    // 이름·생일은 비어 있어야 합니다. 채워 두면 그냥 눌러도 등록이 됩니다.
    expect(EMPTY_FORM.name).toBe('')
    expect(EMPTY_FORM.birthDate).toBe('')
  })
})
