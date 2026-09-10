/**
 * 앱 내 미완료 표시 — 알림 3단 (TECH_SPEC 8-1). 홈 진입 시 계산합니다.
 *
 * **이 파일은 아무것도 import 하지 않습니다.** 아래 타입들은 다른 파일에도
 * 같은 정의가 있지만(`dates.ts` 의 `DateStr`, `medSchedule.ts` 의
 * `Occurrence`), 도메인이 다른 계층을 끌어오지 않는 것이 이 계층의 존재
 * 이유라 일부러 다시 적었습니다 (U04 완료 판정).
 *
 * ## 표현 규칙 — 이 파일이 지키는 것이 아니라 화면이 지켜야 하는 것
 *
 * **행동 버튼으로만 표시합니다.** `오늘 기록 · [10초면 돼요]`.
 * "놓쳤어요", "비어있어요"류 지적 문구를 만들지 않습니다 (원칙 P6).
 * 지난 약 시각은 시간 경과를 강조하지 않고 `오후 8시 · 아모디핀 ·
 * [먹였어요]` 로 담백하게 둡니다. **이 함수가 "며칠 밀렸는지"를 돌려주지
 * 않는 것이 그 규칙의 구현입니다** — 세지 않으면 화면이 강조할 수 없습니다.
 *
 * ## 왜 `now` 만 받지 않고 여러 값을 받는가
 *
 * TECH_SPEC 8-1 이 적어 둔 모양은 `pendingItems(now, tz, logs, meds,
 * medLogs)` 입니다. 실제로는 두 가지를 더 받습니다. 이유는
 * **`domain/` 이 import 를 할 수 없다**는 제약 하나입니다.
 *
 * - `targetDate` — 04:00 규칙이 정한 기록 대상 날짜. 여기서 다시 계산하면
 *   `dates.ts` 의 `NIGHT_CUTOFF_HOUR` 가 두 곳에 생깁니다. 그 상수는
 *   아직 ⚠️ 미확정(TECH_SPEC 3-2 T2)이라 **한 곳에만 있어야 합니다.**
 * - `occurrences` — 예정 급여 역산은 서머타임까지 다루는
 *   `medSchedule.expectedOccurrences` 의 일입니다. import 할 수 없으니
 *   여기서 다시 쓸 수는 없고, 다시 쓰면 DST 로직이 두 벌이 됩니다.
 *
 * `weekDots(logs, weekStart)` 가 주 시작일을 `now` 에서 유도하지 않고
 * 인자로 받는 것과 같은 형태입니다 — 이 계층은 파생값을 받습니다.
 */

/** `YYYY-MM-DD`. `dates.ts` 와 같은 정의입니다. */
export type DateStr = string

/** ISO 8601 UTC. `medSchedule.ts` 와 같은 정의입니다. */
export type Instant = string

/** `HH:mm` 24시간. `medSchedule.ts` 와 같은 정의입니다. */
export type TimeStr = string

/** `medSchedule.ts` 의 `Occurrence` 와 같은 정의입니다 (TECH_SPEC 7-3). */
export type Occurrence = {
  medicationId: string
  scheduledAt: Instant
  localTime: TimeStr
}

/** 이 파일이 실제로 쓰는 `DailyLog` 의 최소 모양입니다. */
export interface DailyLog {
  readonly date: DateStr
}

/** 이 파일이 실제로 쓰는 `MedicationLog` 의 최소 모양입니다. */
export interface MedicationLog {
  readonly medication_id: string
  readonly scheduled_at: Instant
}

/**
 * 체중을 다시 잴 때가 되었다고 보는 간격.
 *
 * **명세서에 "체중 주기"의 길이가 없습니다.** U11 산출물이 `weight_due` 를
 * 요구하는데 며칠인지는 정해 두지 않았습니다. 7일로 둔 근거는 둘입니다 —
 * U05 의 시드가 주 1회로 3년치를 만들고 있고(`WEIGHT_EVERY = 7`),
 * 노령기 치료 중 체중은 주 단위로 보는 것이 임상 관례입니다.
 *
 * **바꿀 때는 이 상수 하나만 고치면 됩니다.** 값이 틀려도 데이터가 상하지
 * 않습니다 — 잔소리 빈도만 바뀝니다.
 */
export const WEIGHT_INTERVAL_DAYS = 7

/**
 * 홈이 행동 버튼으로 그릴 미완료 항목 하나.
 *
 * TECH_SPEC 8-1 은 `'today_log_missing' | { kind: 'med_due', occurrence } |
 * 'weight_due'` 로 적었습니다 — 한 갈래만 객체입니다. **세 갈래 모두
 * `kind` 를 갖게 했습니다.** 맨 문자열과 객체가 섞인 유니온은 부르는 쪽이
 * `typeof item === 'string'` 을 먼저 물어야 하고, 갈래가 늘 때마다 그
 * 분기가 화면마다 생깁니다.
 *
 * `today_log_missing` 이 `date` 를 함께 주는 이유는 화면이 `/today/:date`
 * 로 곧바로 보내야 하기 때문입니다. 04:00 이전이면 그 날짜는 어제입니다.
 */
export type Pending =
  | { kind: 'today_log_missing'; date: DateStr }
  | { kind: 'med_due'; occurrence: Occurrence }
  | { kind: 'weight_due' }

export type PendingInput = {
  /**
   * 기록 대상 날짜. `dates.recordingTargetDate(now, tz)` 를 넘기세요.
   * 04:00 이전이면 어제입니다 (TECH_SPEC 3-2).
   */
  targetDate: DateStr
  /** 지금. **약 시각이 지났는지 판단하는 데만** 씁니다. */
  now: Date
  /**
   * 하루 기록. `targetDate` 가 들어 있는지만 봅니다.
   * **삭제된 기록(`deleted_at`)을 거르는 것은 넘기는 쪽의 몫입니다** —
   * 도메인은 받은 것을 셉니다 (U04 와 같은 규칙).
   */
  logs: readonly DailyLog[]
  /**
   * 예정 급여. `medSchedule.expectedOccurrences(meds, from, to, tz)` 의 결과를
   * 넘기세요. **구간을 정하는 것은 넘기는 쪽입니다** — 이 함수는 받은 것
   * 안에서만 찾으므로, 너무 좁게 주면 밀린 약을 놓치고 너무 넓게 주면
   * 목록이 길어집니다.
   */
  occurrences: readonly Occurrence[]
  /** 위 예정들에 대한 급여 기록. */
  medLogs: readonly MedicationLog[]
  /** 가장 최근 체중 기록의 날짜. 한 번도 없으면 `null`. */
  latestWeightDate: DateStr | null
}

/** 예정과 기록을 맞추는 열쇠. `medSchedule` 이 쓰는 것과 같은 모양입니다. */
const keyOf = (medicationId: string, scheduledAt: Instant): string =>
  `${medicationId} ${scheduledAt}`

function parse(date: DateStr): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (match === null) throw new Error(`YYYY-MM-DD 형식이 아닙니다: ${date}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/** 두 날짜 사이의 일수. 달력 산술은 UTC 로만 합니다 (`dates.ts` 와 같음). */
function diffDays(from: DateStr, to: DateStr): number {
  const a = parse(from)
  const b = parse(to)
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)
  return Math.round(ms / 86_400_000)
}

/**
 * 지금 홈이 행동 버튼으로 내밀 것들.
 *
 * 순서는 TECH_SPEC 8-1 이 적어 둔 순서 그대로입니다 —
 * 오늘 기록 → 지난 약 → 체중. 비어 있으면 빈 배열입니다.
 *
 * **밀린 약은 이른 것부터 전부 돌려줍니다.** 화면이 하나만 쓰더라도
 * 여기서 자르지 않는 이유는, 자르는 규칙이 화면마다 달라질 수 있고
 * (홈은 1개, 알림은 전부) 그 판단이 도메인의 몫이 아니기 때문입니다.
 */
export function pendingItems(input: PendingInput): Pending[] {
  const out: Pending[] = []

  // 1. 오늘 기록 — 그 날짜의 기록이 하나라도 있으면 할 일이 아닙니다.
  if (!input.logs.some((log) => log.date === input.targetDate)) {
    out.push({ kind: 'today_log_missing', date: input.targetDate })
  }

  // 2. 지난 약 시각 — 이미 지났는데 기록이 없는 예정.
  //    `now` 와 정확히 같은 순간은 아직 지나지 않은 것으로 봅니다
  //    (`nextOccurrence` 가 그 순간을 "다음"으로 보는 것과 짝을 맞춥니다).
  const nowMs = input.now.getTime()
  const recorded = new Set(input.medLogs.map((log) => keyOf(log.medication_id, log.scheduled_at)))

  const due = input.occurrences
    .filter((occurrence) => new Date(occurrence.scheduledAt).getTime() < nowMs)
    .filter((occurrence) => !recorded.has(keyOf(occurrence.medicationId, occurrence.scheduledAt)))
    .slice()
    .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : a.scheduledAt > b.scheduledAt ? 1 : 0))

  for (const occurrence of due) out.push({ kind: 'med_due', occurrence })

  // 3. 체중 — 한 번도 없거나 간격이 지났으면.
  //    미래 날짜가 들어오면(잘못된 데이터) 할 일이 아닙니다.
  if (
    input.latestWeightDate === null ||
    diffDays(input.latestWeightDate, input.targetDate) >= WEIGHT_INTERVAL_DAYS
  ) {
    out.push({ kind: 'weight_due' })
  }

  return out
}
