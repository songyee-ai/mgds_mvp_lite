/**
 * 순수 함수 계층. React·Dexie·Supabase·Date.now() 에 의존하지 않습니다
 * (TECH_SPEC 2-2 모듈 경계 규칙).
 *
 * 각 모듈은 `import` 문이 하나도 없습니다. 이 파일만 재수출(`export … from`)을
 * 합니다. 값을 끌어오는 것이 아니라 밖으로 내보내는 통로입니다.
 *
 * 채운 단위: U04(dates, goodDays), U06(medSchedule), U11(pending)
 * 남은 단위: U18(trends), U20(summary),
 *            U23(questions), U30(careManual), U32(triggers)
 *
 * 모듈마다 `DateStr` 같은 타입 별칭을 따로 정의합니다(import 금지 규칙).
 * 배럴에서는 한 번만 내보냅니다 — `dates` 쪽을 대표로 씁니다.
 */
export {
  today,
  recordingTargetDate,
  daysTogether,
  ageText,
  addDays,
  diffDays,
  NIGHT_CUTOFF_HOUR,
  type DateStr,
} from './dates'

export {
  countGood,
  weekDots,
  monthComparison,
  type Dot,
  type DailyLog,
  type Overall,
} from './goodDays'

export {
  expectedOccurrences,
  nextOccurrence,
  compliance,
  LOOKAHEAD_DAYS,
  type Occurrence,
  type Compliance,
  type Medication,
  type MedicationLog,
  type MedStatus,
  type TimeStr,
  type Instant,
} from './medSchedule'

/**
 * `pending` 은 `Occurrence`·`Instant`·`TimeStr`·`DailyLog` 를 자기 파일에
 * 다시 정의합니다(import 금지 규칙). 배럴에서는 `medSchedule`·`goodDays`
 * 쪽을 대표로 내보내므로 여기서는 겹치지 않는 것만 냅니다.
 */
export {
  pendingItems,
  WEIGHT_INTERVAL_DAYS,
  type Pending,
  type PendingInput,
} from './pending'
