/**
 * 약 스케줄과 컴플라이언스 (TECH_SPEC 7-3). 도메인에서 가장 까다로운 곳입니다.
 *
 * **예정 급여를 미리 만들어 두지 않습니다.** `Medication` 정의에서 매번
 * 역산하고, `MedicationLog` 에는 실제로 일어난 일만 담습니다. 그래서
 * (a) 스케줄이 바뀌어도 유령 레코드가 남지 않고 (b) 3년치 예정 레코드를
 * 저장하지 않습니다.
 *
 * **이 파일은 아무것도 import 하지 않습니다.** `dates.ts` 의 `addDays`·
 * `diffDays` 와 겹치는 계산이 여기 다시 있는 것은 그 규칙 때문입니다
 * (TECH_SPEC 2-2 규칙 1). 시간을 알아내는 유일한 통로는 인자로 받는 `now`
 * 이고, 타임존은 항상 인자로 받습니다.
 */

/** `YYYY-MM-DD`. 기기 로컬 날짜 (TECH_SPEC 3-2). */
export type DateStr = string

/** `HH:mm` 24시간. 기기 로컬 시각 (TECH_SPEC 3-2). */
export type TimeStr = string

/** ISO 8601 UTC (TECH_SPEC 3-2). */
export type Instant = string

/** TECH_SPEC 3-4. 값 변경 금지. */
export type MedStatus = 'given' | 'skipped' | 'spat_out' | 'regiven'

/**
 * 이 파일이 실제로 쓰는 `Medication` 의 최소 모양입니다.
 *
 * `data/` 의 전체 엔티티가 구조적으로 대입됩니다. `name`·`dose_text` 는
 * 여기서 쓰지 않으므로 두지 않았습니다 — 대신 함수들이 제네릭이라
 * 부르는 쪽의 타입이 그대로 돌아 나옵니다.
 */
export type Medication = {
  id: string
  /** `["08:00","20:00"]`. 길이가 곧 하루 횟수입니다. */
  schedule_times: TimeStr[]
  started_at: DateStr
  ended_at: DateStr | null
  is_active: boolean
}

/** 이 파일이 실제로 쓰는 `MedicationLog` 의 최소 모양입니다. */
export type MedicationLog = {
  medication_id: string
  scheduled_at: Instant
  status: MedStatus
  note: string | null
}

/**
 * 예정 급여 1회 (TECH_SPEC 7-3 그대로).
 *
 * `scheduledAt` 은 순간, `localTime` 은 화면에 그대로 쓸 기기 로컬 시각입니다.
 * 둘을 같이 주는 이유는 화면이 순간을 다시 로컬로 되돌리지 않게 하려는
 * 것입니다. 되돌리는 코드가 화면마다 생기면 타임존 버그도 화면마다 생깁니다.
 */
export type Occurrence = { medicationId: string; scheduledAt: Instant; localTime: TimeStr }

/**
 * 기간 컴플라이언스 (TECH_SPEC 7-3 그대로).
 *
 * **`unrecorded` 와 `notGiven` 을 절대 합치지 마세요.** "안 먹였다고 기록함"과
 * "기록이 없음"은 임상적으로 다른 정보입니다. 둘을 합쳐 "미급여 2회"로
 * 적으면 수의사가 컴플라이언스를 오판합니다.
 */
export type Compliance<M extends Medication = Medication> = {
  byMedication: Array<{
    medication: M
    expected: number
    /** status `given` + `regiven`. */
    given: number
    /** status `skipped` + `spat_out`. 명시적으로 기록된 미급여입니다. */
    notGiven: number
    /** `expected - (given + notGiven)`. 기록 자체가 없는 건. */
    unrecorded: number
    regiven: Array<{ date: DateStr; note: string | null }>
  }>
}

/**
 * `nextOccurrence` 가 앞을 내다보는 한계.
 *
 * 홈의 "다음 약" 카드는 가까운 미래만 봅니다. 스케줄은 매일 반복되므로
 * 30일 안에 기록 없는 예정이 하나도 없다면 사실상 없는 것입니다. 무한
 * 탐색을 막는 자리이기도 합니다. 바꿀 때는 이 상수 하나만 고치면 됩니다.
 */
export const LOOKAHEAD_DAYS = 30

// ── 달력·타임존 (import 금지 규칙 때문에 여기 다시 있습니다) ─────────────

const pad = (value: number): string => String(value).padStart(2, '0')

const formatDate = (year: number, month: number, day: number): DateStr =>
  `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`

function parseDate(date: DateStr): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (match === null) throw new Error(`YYYY-MM-DD 형식이 아닙니다: ${date}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function parseTime(time: TimeStr): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (match === null) throw new Error(`HH:mm 형식이 아닙니다: ${time}`)
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

/** 달력 산술입니다. 밀리초를 더하면 서머타임이 낀 날 하루가 23시간이 됩니다. */
function addDays(date: DateStr, delta: number): DateStr {
  const { year, month, day } = parseDate(date)
  const shifted = new Date(Date.UTC(year, month - 1, day + delta))
  return formatDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

/** 두 날짜 사이의 일수. `to` 가 `from` 보다 이르면 음수입니다. */
function diffDays(from: DateStr, to: DateStr): number {
  const a = parseDate(from)
  const b = parseDate(to)
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)
  return Math.round(ms / 86_400_000)
}

/**
 * 타임존별 포매터를 재사용합니다.
 *
 * 3년치 요약서는 한 약당 2,200번 이 계산을 부릅니다(TECH_SPEC 18). 매번
 * `Intl.DateTimeFormat` 을 새로 만들면 그 생성 비용이 전부입니다. 캐시는
 * 같은 인자에 같은 답을 주는 메모이제이션이라 함수의 순수성을 해치지 않습니다.
 */
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(tz: string): Intl.DateTimeFormat {
  const cached = formatters.get(tz)
  if (cached !== undefined) return cached
  const made = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  formatters.set(tz, made)
  return made
}

type Wall = { year: number; month: number; day: number; hour: number; minute: number; second: number }

/** 주어진 순간을 그 타임존의 벽시계로 읽습니다. */
function wallOf(instantMs: number, tz: string): Wall {
  const parts = formatterFor(tz).formatToParts(new Date(instantMs))
  const read = (type: string): number => {
    const part = parts.find((candidate) => candidate.type === type)
    if (part === undefined) throw new Error(`날짜 부품 ${type} 를 읽지 못했습니다: tz=${tz}`)
    return Number(part.value)
  }
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  }
}

/** 그 순간에 이 타임존이 UTC 보다 얼마나 앞서 있는지 (밀리초). */
function offsetAt(instantMs: number, tz: string): number {
  const wall = wallOf(instantMs, tz)
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  return asUtc - instantMs
}

/**
 * 기기 로컬 날짜·시각을 순간으로 바꿉니다.
 *
 * 벽시계를 UTC 인 척 읽어 한 번 추측하고, 그 결과의 실제 오프셋으로 한 번
 * 고칩니다. 서머타임 경계에서 오프셋이 바뀌기 때문입니다.
 *
 * 서머타임 때문에 **존재하지 않는 시각**(봄에 건너뛴 한 시간)을 넘기면
 * 건너뛰기 직전 시각으로 접힙니다. 예외를 던지지 않습니다 — 약 시각 하나
 * 때문에 요약서 전체가 실패하는 것이 더 나쁩니다.
 */
function instantOf(date: DateStr, time: TimeStr, tz: string): number {
  const { year, month, day } = parseDate(date)
  const { hour, minute } = parseTime(time)
  const wallMs = Date.UTC(year, month - 1, day, hour, minute)
  const guessed = offsetAt(wallMs, tz)
  const candidate = wallMs - guessed
  const actual = offsetAt(candidate, tz)
  return actual === guessed ? candidate : wallMs - actual
}

/** 그 순간이 이 타임존에서 어느 날인지. */
function localDateOf(instantMs: number, tz: string): DateStr {
  const wall = wallOf(instantMs, tz)
  return formatDate(wall.year, wall.month, wall.day)
}

const laterDate = (a: DateStr, b: DateStr): DateStr => (diffDays(a, b) > 0 ? b : a)
const earlierDate = (a: DateStr, b: DateStr): DateStr => (diffDays(a, b) < 0 ? b : a)

/**
 * 같은 시각이 두 번 적힌 스케줄은 한 번으로 봅니다.
 *
 * `&[medication_id+scheduled_at]` 이 유니크라(TECH_SPEC 4) 같은 순간의
 * 예정 급여 두 개는 기록될 수 없습니다. `expected` 만 늘면 그 약은 영원히
 * `unrecorded` 를 답니다. 정렬해서 하루 안의 순서도 고정합니다.
 */
const scheduleOf = (med: Medication): TimeStr[] => [...new Set(med.schedule_times)].sort()

/**
 * 이 약이 `from`~`to` 안에서 실제로 처방되어 있던 구간.
 *
 * **`is_active` 를 보지 않습니다.** 그 값은 "지금 주고 있는가"이고, 여기서
 * 답하는 것은 "그때 무엇이 처방되어 있었는가"입니다. 지금 값으로 과거
 * 횟수를 바꾸는 것이 TECH_SPEC 4-3 이 append-only 로 막으려는 바로 그
 * 일입니다 — 정의를 소급 수정하면 과거 컴플라이언스가 조용히 바뀝니다.
 * 약을 끊으면 `ended_at` 이 채워지고, 그 뒤 기간은 이 구간이 비어
 * 자연히 빠집니다.
 */
function windowOf(med: Medication, from: DateStr, to: DateStr): { start: DateStr; end: DateStr } | null {
  const start = laterDate(med.started_at, from)
  const end = med.ended_at === null ? to : earlierDate(med.ended_at, to)
  return diffDays(start, end) < 0 ? null : { start, end }
}

const byInstantThenId = (a: Occurrence, b: Occurrence): number =>
  a.scheduledAt === b.scheduledAt
    ? a.medicationId.localeCompare(b.medicationId)
    : a.scheduledAt < b.scheduledAt
      ? -1
      : 1

// ── 공개 함수 ───────────────────────────────────────────────────────────

/**
 * 기간 안의 예정 급여 전부. 순간 오름차순입니다.
 *
 * 경계 양끝을 포함합니다. `to` 가 `from` 보다 이르면 빈 배열입니다.
 */
export function expectedOccurrences(
  meds: Medication[],
  from: DateStr,
  to: DateStr,
  tz: string,
): Occurrence[] {
  const out: Occurrence[] = []
  if (diffDays(from, to) < 0) return out

  for (const med of meds) {
    const span = windowOf(med, from, to)
    if (span === null) continue
    const times = scheduleOf(med)
    if (times.length === 0) continue

    // 한 약이 같은 순간에 두 번 예정될 수 없습니다. 서머타임으로 건너뛴
    // 시각이 앞 시각으로 접히면 실제로 부딪칩니다 (뉴욕 3월의 01:30·02:30).
    // 유니크 제약 때문에 둘 중 하나는 영영 기록될 수 없고, 남는 쪽은
    // 매일 unrecorded 로 쌓입니다.
    const taken = new Set<Instant>()
    const days = diffDays(span.start, span.end)
    for (let offset = 0; offset <= days; offset += 1) {
      const date = addDays(span.start, offset)
      for (const localTime of times) {
        const scheduledAt = new Date(instantOf(date, localTime, tz)).toISOString()
        if (taken.has(scheduledAt)) continue
        taken.add(scheduledAt)
        out.push({ medicationId: med.id, scheduledAt, localTime })
      }
    }
  }

  return out.sort(byInstantThenId)
}

/**
 * `now` 이후 가장 가까운 예정 중 **아직 기록이 없는 것** (TECH_SPEC 7-3).
 * 홈의 "다음 약" 카드가 이 함수 하나로 그려집니다 (PRD FR-5).
 *
 * `now` 와 정확히 같은 순간의 예정은 아직 지나지 않은 것으로 봅니다.
 *
 * **`is_active` 가 거짓인 약은 제안하지 않습니다.** 여기서 답하는 것은
 * "다음에 무엇을 줘야 하는가"라 지금 값이 맞습니다. `expectedOccurrences`
 * 와 반대인 이유가 이것입니다.
 *
 * 이미 지나간 예정은 기록이 없어도 돌려주지 않습니다. 명세서가 "now 이후"로
 * 정한 계약입니다. 놓친 약을 화면에 띄우는 것은 홈(U11)이 따로 정할 문제입니다.
 */
export function nextOccurrence(
  meds: Medication[],
  logs: MedicationLog[],
  now: Date,
  tz: string,
): Occurrence | null {
  const nowMs = now.getTime()
  const from = localDateOf(nowMs, tz)
  const to = addDays(from, LOOKAHEAD_DAYS)
  const active = meds.filter((med) => med.is_active)

  const recorded = new Set(logs.map((log) => `${log.medication_id} ${log.scheduled_at}`))

  for (const occurrence of expectedOccurrences(active, from, to, tz)) {
    if (new Date(occurrence.scheduledAt).getTime() < nowMs) continue
    if (recorded.has(`${occurrence.medicationId} ${occurrence.scheduledAt}`)) continue
    return occurrence
  }
  return null
}

/**
 * 기간 컴플라이언스 (TECH_SPEC 7-3). 요약서 3번 블록의 재료입니다 (PRD FR-8-3).
 *
 * 기간 안에 예정이 하나도 없는 약은 `byMedication` 에 들어가지 않습니다.
 * "투약 (기간 내)" 블록에 0 만 적힌 줄이 생기지 않게 하려는 것입니다.
 * 남은 약의 순서는 넘겨준 순서 그대로입니다.
 *
 * 기록은 **예정에 정확히 맞는 것만** 셉니다. 어느 예정에도 닿지 않는
 * 기록(스케줄이 바뀌기 전 지워졌어야 할 것 등)을 세면 `unrecorded` 가
 * 음수가 됩니다.
 *
 * **삭제된 기록(`deleted_at`)을 거르는 것은 넘기는 쪽의 몫입니다.**
 * 도메인은 받은 것을 셉니다 (U04 와 같은 규칙).
 */
export function compliance<M extends Medication>(
  meds: M[],
  logs: MedicationLog[],
  from: DateStr,
  to: DateStr,
  tz: string,
): Compliance<M> {
  const byMedication: Compliance<M>['byMedication'] = []

  for (const medication of meds) {
    const occurrences = expectedOccurrences([medication], from, to, tz)
    if (occurrences.length === 0) continue

    const scheduled = new Set(occurrences.map((occurrence) => occurrence.scheduledAt))
    let given = 0
    let notGiven = 0
    const regiven: Array<{ date: DateStr; note: string | null }> = []

    for (const log of logs) {
      if (log.medication_id !== medication.id) continue
      if (!scheduled.has(log.scheduled_at)) continue

      if (log.status === 'given') given += 1
      else if (log.status === 'regiven') {
        // 재급여도 결국 먹인 것입니다. 합계에 넣고 목록에도 남깁니다.
        given += 1
        regiven.push({ date: localDateOf(new Date(log.scheduled_at).getTime(), tz), note: log.note })
      } else notGiven += 1
    }

    byMedication.push({
      medication,
      expected: occurrences.length,
      given,
      notGiven,
      unrecorded: occurrences.length - (given + notGiven),
      regiven,
    })
  }

  return { byMedication }
}
