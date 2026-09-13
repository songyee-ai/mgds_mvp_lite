/**
 * 아이 등록 입력을 `NewPet` 으로 옮기는 순수 함수 (U10).
 *
 * 화면이 아니라 데이터로 둡니다. U10 의 T-unit 이 **"대략 나이 입력 시
 * `birth_is_approximate = true`"** 를 요구하는데, 그것을 브라우저 없이
 * 확인할 수 있어야 합니다. `daily-log/cards.ts` 와 같은 이유입니다.
 *
 * 여기에는 React 도 Repo 도 없습니다. `now`·`tz` 는 인자로 받습니다 —
 * `domain/` 의 규칙을 그대로 따르는 것이고, "오늘이 며칠이냐"에 따라
 * 결과가 달라지는 함수를 테스트가 고정할 수 있어야 합니다.
 */

import { addDays, today } from '../../domain'
import type { NewPet, Sex, Species } from '../../data'

/**
 * 나이를 어떻게 아는가 (PRD FR-1 ① · 수용 기준 "나이 입력에 '대략' 옵션").
 *
 * 유기 입양·노령 입양이 많아 정확한 생일을 모르는 경우가 흔합니다.
 * 둘 중 하나는 반드시 골라야 합니다 — 나이를 아예 모르면 `ageText` 도
 * 추세도 성립하지 않습니다.
 */
export type AgeMode = 'birthday' | 'approximate'

export type PetForm = {
  name: string
  species: Species
  /** `species === 'other'` 일 때만 씁니다. */
  speciesOtherLabel: string
  sex: Sex
  ageMode: AgeMode
  /** `ageMode === 'birthday'`. `YYYY-MM-DD`. */
  birthDate: string
  /** `ageMode === 'approximate'`. 살 단위 정수 문자열. */
  approximateYears: string
  /**
   * 입양일. 선택 항목이라 비어 있을 수 있습니다.
   *
   * U04 의 ⚠️ T3 결정(2026-09-09, 사용자 확인)에서 넘어온 항목입니다.
   * "함께한 N일"의 기준일 우선순위가 `입양일 → 정확한 생일 → 등록일` 이고,
   * 이 칸이 우선순위 1번의 유일한 입력 경로입니다. 값을 고르는 것은
   * 홈(U11)의 몫입니다. 자세한 것은 handoff/U04.md.
   */
  adoptedAt: string
  /**
   * 자주 가는 병원. 선택 항목이고, 둘은 **한 덩어리입니다** (PRD FR-2-3).
   *
   * **이 두 칸이 라이트에서 병원이 생기는 유일한 경로입니다.** 없으면
   * `repo.clinics.primary()` 가 언제나 `undefined` 가 되고, 위험 태그를
   * 골라도 `RiskContact` 가 뜰 수 없습니다 — 위험 신호에서 연락으로 가는
   * 길이 통째로 사라집니다. 2026-09-13 까지 실제로 그 상태였습니다.
   *
   * 한쪽만 채우면 막습니다(`clinic_incomplete`). 이름만 있으면 걸 수 없고,
   * 번호만 있으면 누구에게 거는지 모릅니다. 밤중에 급한 사람에게 반쪽짜리
   * 연락처를 내미는 것이 가장 나쁩니다.
   */
  clinicName: string
  clinicPhone: string
}

export const EMPTY_FORM: PetForm = {
  name: '',
  species: 'dog',
  speciesOtherLabel: '',
  sex: 'unknown',
  ageMode: 'birthday',
  birthDate: '',
  approximateYears: '',
  adoptedAt: '',
  clinicName: '',
  clinicPhone: '',
}

/** 등록을 막는 이유. 화면이 문구를 고르는 근거입니다 (TECH_SPEC 13). */
export type FormProblem =
  | 'name_required'
  | 'species_label_required'
  | 'birth_date_required'
  | 'birth_date_future'
  | 'approximate_years_required'
  | 'adopted_at_future'
  | 'clinic_incomplete'

/** 대략 나이로 받는 범위. 30살을 넘는 개·고양이는 사실상 없습니다. */
export const MAX_APPROXIMATE_YEARS = 30

/** `"13"` → `13`. 정수가 아니거나 범위를 벗어나면 `null`. */
function approximateYearsOf(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^\d{1,2}$/.test(trimmed)) return null
  const years = Number(trimmed)
  return years >= 0 && years <= MAX_APPROXIMATE_YEARS ? years : null
}

const isDateStr = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)

/**
 * 등록을 막는 이유 전부. 비어 있으면 `toNewPet` 을 부를 수 있습니다.
 *
 * **사진은 여기 없습니다.** 사진 없이도 등록이 끝나야 합니다
 * (PRD FR-1 표 "사진만 가능" · U10 완료 판정 1).
 */
export function problemsOf(form: PetForm, now: Date, tz: string): FormProblem[] {
  const problems: FormProblem[] = []
  const localToday = today(now, tz)

  if (form.name.trim() === '') problems.push('name_required')
  if (form.species === 'other' && form.speciesOtherLabel.trim() === '') {
    problems.push('species_label_required')
  }

  if (form.ageMode === 'birthday') {
    if (!isDateStr(form.birthDate)) problems.push('birth_date_required')
    else if (form.birthDate > localToday) problems.push('birth_date_future')
  } else if (approximateYearsOf(form.approximateYears) === null) {
    problems.push('approximate_years_required')
  }

  // 선택 항목이지만, 채웠다면 미래일 수는 없습니다.
  if (form.adoptedAt !== '' && form.adoptedAt > localToday) problems.push('adopted_at_future')

  // 병원은 둘 다 비우거나 둘 다 채우거나입니다. 반쪽은 걸 수 없습니다.
  const hasClinicName = form.clinicName.trim() !== ''
  const hasClinicPhone = form.clinicPhone.trim() !== ''
  if (hasClinicName !== hasClinicPhone) problems.push('clinic_incomplete')

  return problems
}

/** 병원을 적었는가. `toNewClinic` 과 `problemsOf` 가 같은 판정을 쓰게 둡니다. */
function clinicFilled(form: PetForm): boolean {
  return form.clinicName.trim() !== '' && form.clinicPhone.trim() !== ''
}

/**
 * `PetForm` → 병원 한 곳. 적지 않았으면 `null` 이고, 그러면 만들지 않습니다.
 *
 * `problemsOf` 가 빈 배열일 때만 부르세요 — 한쪽만 채운 폼은 여기서 던집니다.
 * `toNewPet` 과 같은 계약입니다.
 *
 * `is_primary` 가 `true` 인 이유는 `repo.clinics.primary()` 가 그 깃발을 보고
 * 고르기 때문입니다. 라이트에는 병원이 한 곳뿐이라 언제나 그 한 곳이
 * 대표입니다. `address`·`lat`·`lng` 는 U24(24시 병원 지도)의 칸이고 여기서
 * 묻지 않습니다 — 밤중에 급할 때 필요한 것은 주소가 아니라 번호입니다.
 */
export function toNewClinic(
  form: PetForm,
  petId: string,
): { pet_id: string; name: string; phone: string; address: null; lat: null; lng: null; is_primary: true } | null {
  const hasAny = form.clinicName.trim() !== '' || form.clinicPhone.trim() !== ''
  if (!hasAny) return null
  if (!clinicFilled(form)) {
    throw new Error('병원 이름과 전화번호 중 하나가 비었습니다. problemsOf 를 먼저 확인하세요')
  }

  return {
    pet_id: petId,
    name: form.clinicName.trim(),
    phone: form.clinicPhone.trim(),
    address: null,
    lat: null,
    lng: null,
    is_primary: true,
  }
}

/**
 * 대략 나이 `N살` 을 `birth_date` 로 옮깁니다.
 *
 * **`N년 전 오늘의 하루 전`** 입니다. 두 가지를 동시에 지키려는 값입니다.
 *
 * 1. **등록한 날 `ageText` 가 사용자가 적은 숫자를 그대로 돌려줘야 합니다.**
 *    1월 1일 같은 고정 날짜로 만들면 12월에 "약 13살"로 등록한 아이가
 *    한 달 뒤 "약 14살"이 됩니다.
 * 2. **하루를 더 빼는 이유**: `ageText` 는 `now` 를 **UTC 달력**으로 읽고
 *    (TECH_SPEC 7-1 이 시그니처에 타임존을 두지 않았습니다) 이 함수는
 *    **기기 로컬 날짜**로 셉니다. 한국 시간 오전 9시 이전에는 두 날짜가
 *    하루 다릅니다. 정확히 `N년 전 오늘` 로 만들면 그 시간대에 등록한
 *    사람에게 `약 12살` 이 뜹니다. 하루를 빼 두면 `nowDay < bornDay` 가
 *    양쪽 날짜에서 모두 거짓이 되어 표기가 흔들리지 않습니다.
 *
 * 2월 29일은 그 해에 없을 수 있어 그 달의 말일로 당깁니다.
 */
export function approximateBirthDate(years: number, now: Date, tz: string): string {
  const localToday = today(now, tz)
  const year = Number(localToday.slice(0, 4)) - years
  const month = Number(localToday.slice(5, 7))
  const day = Number(localToday.slice(8, 10))

  // 그 해 그 달의 말일. `Date.UTC(y, m, 0)` 이 전달의 마지막 날입니다.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const clamped = Math.min(day, lastDay)
  const anniversary = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`

  return addDays(anniversary, -1)
}

/**
 * `PetForm` → `NewPet`. `problemsOf` 가 빈 배열일 때만 부르세요.
 *
 * `photo_id` 는 항상 `null` 입니다. `repo.photos.put` 이 `pet_id` 를
 * 요구하므로 사진은 아이를 만든 **뒤에** 담고, 그 다음 `pets.update` 로
 * 이어 붙입니다. `PetCreate` 가 그 순서를 밟습니다.
 *
 * `breed`·`neutered` 는 `null` 입니다 — **v1.1 이고 U10 의 "하지 않을 것"
 * 입니다.** PRD FR-1 수용 기준이 온보딩에서 품종·중성화를 묻지 않는 것을
 * 명시적으로 요구합니다. `breed` 는 "사용 중 수집"(TECH_SPEC 4-1)입니다.
 */
export function toNewPet(form: PetForm, now: Date, tz: string): NewPet {
  const approximate = form.ageMode === 'approximate'
  const years = approximateYearsOf(form.approximateYears)

  if (approximate && years === null) {
    throw new Error('대략 나이가 정수가 아닙니다. problemsOf 를 먼저 확인하세요')
  }
  if (!approximate && !isDateStr(form.birthDate)) {
    throw new Error('생일이 YYYY-MM-DD 가 아닙니다. problemsOf 를 먼저 확인하세요')
  }

  return {
    name: form.name.trim(),
    photo_id: null,
    species: form.species,
    species_other_label:
      form.species === 'other' && form.speciesOtherLabel.trim() !== ''
        ? form.speciesOtherLabel.trim()
        : null,
    breed: null,
    sex: form.sex,
    neutered: null,
    birth_date: approximate
      ? approximateBirthDate(years as number, now, tz)
      : form.birthDate,
    birth_is_approximate: approximate,
    adopted_at: form.adoptedAt === '' ? null : form.adoptedAt,
  }
}
