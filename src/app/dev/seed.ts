/**
 * 3년치 시드 (WORK_UNITS 1-4, TECH_SPEC 18).
 *
 * "나중에 느려지는 것을 발견하면 늦습니다." 개발 초기부터 실제 규모로
 * 테스트하기 위한 데이터입니다. 목표 규모는 TECH_SPEC 18 이 정한
 * DailyLog 약 1,100건 · MedicationLog 약 2,200건입니다.
 *
 * **Repo 를 거치지 않고 Dexie 에 직접 씁니다.** U05 에서는 Repo 가 약·체중을
 * 구현하지 않아서였고, U07 이 전부 채운 지금은 이유가 성능뿐입니다 —
 * 3,000건이 넘는 행을 한 줄씩 `create` 하면 5초 예산을 못 지킵니다.
 * `bulkAdd` 를 트랜잭션 하나로 묶습니다. 개발용 코드이고 프로덕션 번들에
 * 들어가지 않으므로 예외로 둡니다.
 *
 * 난수는 고정 시드로 돌립니다. 같은 인자로 두 번 돌리면 같은 데이터가
 * 나오고, 테스트가 건수를 기대값으로 고정할 수 있습니다.
 */

import { addDays, today } from '../../domain'
import { ALL_TAGS } from '../../data'
import type {
  CareManualItem,
  Clinic,
  DailyLog,
  DailyLogTag,
  Instant,
  MedStatus,
  Medication,
  MedicationLog,
  Meta,
  Overall,
  Pet,
  Tables,
  Tag,
  TimeStr,
  WeightRecord,
} from '../../data'
import type Dexie from 'dexie'

/** 3년치. TECH_SPEC 18 의 "DailyLog 약 1,100건". */
export const SEED_DAYS = 1100

/** 하루 2회. 1,100일 × 2 = 2,200건 (TECH_SPEC 18). */
const SCHEDULE_TIMES: TimeStr[] = ['08:00', '20:00']

/**
 * 두 번째 약 (U07 "약 2종"). 하루 1회, 최근 180일만.
 *
 * 3년 내내 주는 약을 하나 더 두면 MedicationLog 가 4,400건이 되어
 * TECH_SPEC 18 의 "약 2,200건"에서 멀어집니다. 노령기에 나중부터
 * 더해지는 약이 실제로도 흔한 모양입니다.
 */
const SECOND_MED_DAYS = 180
const SECOND_MED_TIMES: TimeStr[] = ['09:00']

/** 체중은 주 1회입니다 (U05 산출물). */
const WEIGHT_EVERY = 7

export type SeedCounts = {
  pets: number
  dailyLogs: number
  dailyLogTags: number
  weights: number
  medications: number
  medicationLogs: number
  clinics: number
  careManual: number
}

/** 기대 건수. 시드를 돌리기 전에도 알 수 있어야 테스트가 검산이 됩니다. */
export const EXPECTED: Omit<SeedCounts, 'dailyLogTags'> = {
  pets: 1,
  dailyLogs: SEED_DAYS,
  weights: Math.ceil(SEED_DAYS / WEIGHT_EVERY),
  medications: 2,
  medicationLogs: SEED_DAYS * SCHEDULE_TIMES.length + SECOND_MED_DAYS * SECOND_MED_TIMES.length,
  clinics: 1,
  careManual: 3,
}

/**
 * mulberry32. 32비트 상태의 결정적 난수입니다.
 *
 * `Math.random()` 을 쓰면 시드를 돌릴 때마다 태그 산포가 달라져
 * "건수가 기대값과 일치하는가"를 고정할 수 없습니다.
 */
function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(random: () => number, from: readonly T[]): T => {
  const item = from[Math.floor(random() * from.length)]
  // noUncheckedIndexedAccess 때문에 undefined 가능성이 남습니다.
  // 빈 배열을 넘기는 것은 호출 쪽 버그입니다.
  if (item === undefined) throw new Error('빈 목록에서 고를 수 없습니다')
  return item
}

/**
 * 좋은 날이 많고 힘든 날이 드문 분포입니다.
 *
 * 이 비율은 화면을 눈으로 볼 때 "대체로 괜찮았던 3년"처럼 보이게 하려는
 * 것이지 의학적 근거가 있는 값이 아닙니다.
 */
const OVERALL_WEIGHTS: readonly { value: Overall; upTo: number }[] = [
  { value: 'good', upTo: 0.55 },
  { value: 'okay', upTo: 0.85 },
  { value: 'hard', upTo: 1 },
]

function overallOf(random: () => number): Overall {
  const roll = random()
  for (const band of OVERALL_WEIGHTS) if (roll < band.upTo) return band.value
  return 'okay'
}

const meta = (at: Instant): Meta => ({
  created_at: at,
  updated_at: at,
  deleted_at: null,
  recorded_by: null,
})

/**
 * 기기 로컬 날짜·시각을 순간으로 바꿉니다.
 *
 * 오프셋 없는 `YYYY-MM-DDTHH:mm:ss` 는 **실행 환경의 로컬 시각**으로
 * 해석됩니다 (TECH_SPEC 3-2 의 "기기 로컬"과 같은 뜻).
 */
const instantAt = (date: string, time: TimeStr): Instant =>
  new Date(`${date}T${time}:00`).toISOString()

/** 시드가 만든 것을 포함해 모든 테이블을 비웁니다. */
export async function clearAll(db: Dexie & Tables): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()))
}

/** 시드가 쓰는 아이. 3년치와 아이만 만들기가 같은 값을 씁니다. */
function makePet(at: Instant): Pet {
  return {
    ...meta(at),
    id: crypto.randomUUID(),
    owner_account_id: null,
    name: '보리',
    photo_id: null,
    species: 'dog',
    species_other_label: null,
    breed: '믹스',
    sex: 'female',
    neutered: true,
    birth_date: '2013-04-20',
    birth_is_approximate: false,
    // U04 의 T3 결정. 생일보다 입양일이 우선입니다 (handoff/U04.md).
    adopted_at: '2013-06-15',
  }
}

/** 시드가 쓰는 병원. 위험 태그 노출(PRD FR-2-3)이 뜨려면 이게 있어야 합니다. */
function makeClinic(at: Instant, petId: string): Clinic {
  return {
    ...meta(at),
    id: crypto.randomUUID(),
    pet_id: petId,
    name: '행복동물병원',
    phone: '02-000-0000',
    address: '서울시 어딘가 1길 2',
    lat: null,
    lng: null,
    is_primary: true,
  }
}

/**
 * 아이와 병원만 만듭니다. 기록은 하나도 없습니다.
 *
 * E2E(U08)가 "기록이 없는 날"에서 카드 5장을 완주해야 하는데, 3년치 시드는
 * 모든 날이 채워져 있어 그 상태를 만들 수 없습니다. 테스트마다 1,100일을
 * 만드는 것도 낭비입니다. 아이 등록 화면은 U10 이라 그때까지 이 자리가
 * 유일한 아이 공급원입니다.
 */
export async function seedPetOnly(db: Dexie & Tables, now: Date): Promise<{ petId: string }> {
  const at = now.toISOString()
  const pet = makePet(at)

  await clearAll(db)
  await db.transaction('rw', [db.pets, db.clinics, db.settings], async () => {
    await db.pets.add(pet)
    await db.clinics.add(makeClinic(at, pet.id))
    await db.settings.put({ key: 'active_pet_id', value: pet.id })
  })

  return { petId: pet.id }
}

/**
 * 3년치를 만듭니다. 기존 데이터는 지웁니다.
 *
 * `now`·`tz` 를 받는 이유는 도메인과 같습니다 — 시드가 만든 마지막 날이
 * "오늘"이어야 화면을 열었을 때 오늘 기록이 보입니다.
 */
export async function seed(db: Dexie & Tables, now: Date, tz: string): Promise<SeedCounts> {
  const random = rng(20260909)
  const lastDay = today(now, tz)
  const firstDay = addDays(lastDay, -(SEED_DAYS - 1))
  const at = now.toISOString()

  const pet = makePet(at)

  const medication: Medication = {
    ...meta(at),
    id: crypto.randomUUID(),
    pet_id: pet.id,
    name: '심장약',
    dose_text: '1/2정',
    schedule_times: SCHEDULE_TIMES,
    with_food: 'after',
    started_at: firstDay,
    ended_at: null,
    is_active: true,
  }

  /** 나중에 더해진 약. 노령기에 약이 하나씩 붙는 모양입니다. */
  const secondMedFirstDay = addDays(lastDay, -(SECOND_MED_DAYS - 1))
  const secondMedication: Medication = {
    ...meta(instantAt(secondMedFirstDay, '10:00')),
    id: crypto.randomUUID(),
    pet_id: pet.id,
    name: '관절 영양제',
    dose_text: '1포',
    schedule_times: SECOND_MED_TIMES,
    with_food: 'after',
    started_at: secondMedFirstDay,
    ended_at: null,
    is_active: true,
  }

  const clinic = makeClinic(at, pet.id)

  // 케어 매뉴얼은 "일부"만 채웁니다 (U07 산출물). 비어 있는 항목이 있어야
  // 완성도 계산(U30)과 "빈 블록은 숨긴다"(PRD FR-8-4)를 눈으로 볼 수 있습니다.
  const careManual: CareManualItem[] = (
    [
      ['med_method', '츄르에 싸서 주면 잘 먹습니다.'],
      ['fears', '천둥, 청소기 소리'],
      ['cannot_eat', '포도, 양파'],
    ] as const
  ).map(([key, value]) => ({
    ...meta(at),
    id: crypto.randomUUID(),
    pet_id: pet.id,
    key,
    value_text: value,
  }))

  const dailyLogs: DailyLog[] = []
  const dailyLogTags: DailyLogTag[] = []
  const weights: WeightRecord[] = []
  const medicationLogs: MedicationLog[] = []

  for (let offset = 0; offset < SEED_DAYS; offset += 1) {
    const date = addDays(firstDay, offset)
    const overall = overallOf(random)
    const logId = crypto.randomUUID()
    const recordedAt = instantAt(date, '21:00')

    dailyLogs.push({
      ...meta(recordedAt),
      id: logId,
      pet_id: pet.id,
      date,
      meal: overall === 'hard' ? pick(random, ['barely_ate', 'refused'] as const) : pick(random, ['ate_all', 'left_some'] as const),
      water: overall === 'hard' ? pick(random, ['low', 'excessive'] as const) : 'normal',
      energy: overall === 'hard' ? 'barely_moving' : overall === 'okay' ? 'sluggish' : 'normal',
      toilet: overall === 'good' ? 'normal' : pick(random, ['normal', 'loose', 'constipated', 'accident'] as const),
      overall,
      memo: overall === 'hard' && random() < 0.3 ? '오늘은 하루 종일 누워 있었다.' : null,
    })

    // 힘든 날일수록 태그가 잘 붙습니다. 태그 없는 날이 대부분입니다.
    const tagChance = overall === 'hard' ? 0.8 : overall === 'okay' ? 0.35 : 0.08
    if (random() < tagChance) {
      const wanted = 1 + Math.floor(random() * 2)
      const chosen = new Set<Tag>()
      while (chosen.size < wanted) chosen.add(pick(random, ALL_TAGS))
      for (const tag of chosen) dailyLogTags.push({ daily_log_id: logId, tag })
    }

    if (offset % WEIGHT_EVERY === 0) {
      // 3년에 걸쳐 6.2kg 에서 서서히 빠지고, 재는 날마다 조금씩 흔들립니다.
      const drift = 6200 - Math.round((offset / SEED_DAYS) * 700)
      weights.push({
        ...meta(recordedAt),
        id: crypto.randomUUID(),
        pet_id: pet.id,
        date,
        weight_g: drift + Math.round((random() - 0.5) * 80),
      })
    }

    // 두 번째 약은 마지막 SECOND_MED_DAYS 일에만 붙습니다.
    const started = offset >= SEED_DAYS - SECOND_MED_DAYS
    const schedule: Array<[Medication, TimeStr]> = [
      ...SCHEDULE_TIMES.map((time): [Medication, TimeStr] => [medication, time]),
      ...(started
        ? SECOND_MED_TIMES.map((time): [Medication, TimeStr] => [secondMedication, time])
        : []),
    ]

    for (const [med, time] of schedule) {
      const scheduledAt = instantAt(date, time)
      const status: MedStatus =
        random() < 0.92 ? 'given' : pick(random, ['skipped', 'spat_out'] as const)
      medicationLogs.push({
        ...meta(scheduledAt),
        id: crypto.randomUUID(),
        medication_id: med.id,
        pet_id: pet.id,
        scheduled_at: scheduledAt,
        given_at:
          status === 'given'
            ? new Date(new Date(scheduledAt).getTime() + Math.floor(random() * 40) * 60_000).toISOString()
            : null,
        status,
        note: null,
      })
    }
  }

  await clearAll(db)
  await db.transaction(
    'rw',
    [
      db.pets,
      db.daily_logs,
      db.daily_log_tags,
      db.weights,
      db.medications,
      db.medication_logs,
      db.clinics,
      db.care_manual,
      db.settings,
    ],
    async () => {
      await db.pets.add(pet)
      await db.medications.bulkAdd([medication, secondMedication])
      await db.daily_logs.bulkAdd(dailyLogs)
      await db.daily_log_tags.bulkAdd(dailyLogTags)
      await db.weights.bulkAdd(weights)
      await db.medication_logs.bulkAdd(medicationLogs)
      await db.clinics.add(clinic)
      await db.care_manual.bulkAdd(careManual)
      await db.settings.put({ key: 'active_pet_id', value: pet.id })
    },
  )

  return {
    pets: 1,
    dailyLogs: dailyLogs.length,
    dailyLogTags: dailyLogTags.length,
    weights: weights.length,
    medications: 2,
    medicationLogs: medicationLogs.length,
    clinics: 1,
    careManual: careManual.length,
  }
}
