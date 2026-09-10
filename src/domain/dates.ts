/**
 * 날짜 계산 (TECH_SPEC 7-1). 이 제품에서 버그가 가장 잘 나는 지점입니다.
 *
 * **이 파일은 아무것도 import 하지 않습니다.** 시간을 알아내는 유일한 통로는
 * 인자로 받는 `now` 입니다. `Date.now()` 나 `new Date()` 를 부르는 순간
 * 테스트가 "지금이 몇 시냐"에 의존하게 되고, 자정 경계 버그는 자정에만
 * 재현되는 버그가 됩니다.
 *
 * 타임존은 항상 인자로 받습니다. `new Date().toISOString().slice(0, 10)` 는
 * 어디에서도 쓰지 않습니다. UTC 로 자르면 한국 시간 오전 9시 이전이
 * 전날로 기록됩니다 (TECH_SPEC 3-2).
 */

/** `YYYY-MM-DD`. 기기 로컬 날짜 (TECH_SPEC 3-2). */
export type DateStr = string

/**
 * 이 시각보다 이르면 "어젯밤"으로 봅니다.
 *
 * 새벽 2시에 기록하면 로컬 날짜상 "오늘"이 되어 사용자 체감("어젯밤")과
 * 어긋납니다. 03:59 는 전날, 04:00 은 당일입니다.
 *
 * ⚠️ 이 경계값은 TECH_SPEC 3-2 에서 "확인 필요"로 남아 있습니다.
 * 바꿀 때는 이 상수 하나만 고치면 됩니다.
 */
export const NIGHT_CUTOFF_HOUR = 4

/** 주어진 타임존에서 본 달력 부품. */
function localParts(now: Date, tz: string): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const read = (type: string): number => {
    const part = parts.find((candidate) => candidate.type === type)
    if (part === undefined) throw new Error(`날짜 부품 ${type} 를 읽지 못했습니다: tz=${tz}`)
    return Number(part.value)
  }

  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour') }
}

const pad = (value: number): string => String(value).padStart(2, '0')

const format = (year: number, month: number, day: number): DateStr =>
  `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`

/**
 * 날짜 문자열에 일수를 더합니다.
 *
 * 밀리초 산술이 아니라 달력 산술입니다. `Date.UTC` 가 월·연 넘김과
 * 윤년을 처리하고, UTC 로만 다루므로 서머타임이 낀 날에도 하루가
 * 23시간이나 25시간이 되지 않습니다.
 */
export function addDays(date: DateStr, delta: number): DateStr {
  const { year, month, day } = parse(date)
  const shifted = new Date(Date.UTC(year, month - 1, day + delta))
  return format(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

function parse(date: DateStr): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (match === null) throw new Error(`YYYY-MM-DD 형식이 아닙니다: ${date}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/** 두 날짜 사이의 일수. `to` 가 `from` 보다 이르면 음수입니다. */
export function diffDays(from: DateStr, to: DateStr): number {
  const a = parse(from)
  const b = parse(to)
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)
  return Math.round(ms / 86_400_000)
}

/** 기기 로컬 타임존에서 본 "오늘" (TECH_SPEC 3-2). */
export function today(now: Date, tz: string): DateStr {
  const { year, month, day } = localParts(now, tz)
  return format(year, month, day)
}

/**
 * 기록 화면이 기본으로 제시할 날짜.
 *
 * 로컬 시각이 `NIGHT_CUTOFF_HOUR` 이전이면 전날입니다. 사용자가 화면에서
 * 바꿀 수 있어야 하고, 어느 날짜인지 화면에 명시해야 합니다 (TECH_SPEC 3-2).
 */
export function recordingTargetDate(now: Date, tz: string): DateStr {
  const { year, month, day, hour } = localParts(now, tz)
  const local = format(year, month, day)
  return hour < NIGHT_CUTOFF_HOUR ? addDays(local, -1) : local
}

/**
 * 함께한 날의 수. 홈 최상단에 들어가는 숫자입니다 (PRD FR-5).
 *
 * 첫날이 1일입니다. 등록한 날 "함께한 0일"이 뜨면 고장 난 것처럼 보입니다.
 * 매일 하나씩 올라갑니다.
 *
 * `birthOrAdoption` 이 `null` 이면 `joinedAt`(아이 등록일)으로 셉니다.
 * **어느 날짜를 넘길지 고르는 것은 호출하는 쪽의 몫입니다.** 결정된 우선순위는
 * 입양일 → 정확한 생일 → (둘 다 없으면 null 을 넘겨 등록일). 자세한 것은
 * handoff/U04.md 의 T3 항목.
 *
 * 기준일이 미래면(잘못된 데이터) 0 을 돌려줍니다. 음수 일수를 화면에
 * 내보내지 않기 위해서입니다.
 */
export function daysTogether(
  birthOrAdoption: DateStr | null,
  joinedAt: DateStr,
  now: Date,
  tz: string,
): number {
  const base = birthOrAdoption ?? joinedAt
  const elapsed = diffDays(base, today(now, tz))
  return elapsed < 0 ? 0 : elapsed + 1
}

/**
 * 나이 표기. `"13살 4개월"` / `"약 13살"`.
 *
 * 시그니처에 타임존이 없습니다 (TECH_SPEC 7-1 그대로). 나이는 연·월 단위라
 * 하루 차이가 표기를 바꾸는 것은 생일 당일뿐이라 그대로 두었습니다.
 * `now` 는 UTC 달력으로 읽습니다.
 *
 * 생일이 미래면(잘못된 데이터) `"0개월"` 입니다.
 */
export function ageText(birth: DateStr, approximate: boolean, now: Date): string {
  const born = parse(birth)
  const nowYear = now.getUTCFullYear()
  const nowMonth = now.getUTCMonth() + 1
  const nowDay = now.getUTCDate()

  let months = (nowYear - born.year) * 12 + (nowMonth - born.month)
  // 생일이 이번 달에 아직 안 왔으면 한 달 덜 산 것입니다.
  if (nowDay < born.day) months -= 1
  if (months < 0) months = 0

  const years = Math.floor(months / 12)
  const remainder = months % 12

  if (approximate) {
    return years >= 1 ? `약 ${years}살` : `약 ${remainder}개월`
  }
  if (years === 0) return `${remainder}개월`
  if (remainder === 0) return `${years}살`
  return `${years}살 ${remainder}개월`
}
