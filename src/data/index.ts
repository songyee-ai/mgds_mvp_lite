/**
 * 저장소 계층. Dexie 스키마와 Repository 구현.
 * 채우는 단위: U05 (db.ts + repo/types.ts + repo/local.ts), U07, U09(export), U28(sync)
 *
 * `features/` 는 `repo` 만 씁니다. 테이블을 직접 만지지 마세요
 * (TECH_SPEC 2-2 규칙 2). 엔티티 타입은 읽기용으로 함께 내보냅니다.
 *
 * `export.ts` 의 두 함수는 예외입니다. TECH_SPEC 10 이 `Repo` 메서드가 아니라
 * 독립 함수 `exportAll()`·`importAll(blob)` 로 정의하고, 백업은 기기 로컬
 * 도구라 6단계의 `SyncedRepo` 가 다시 구현할 대상이 아닙니다. 자세한 것은
 * `export.ts` 머리말과 handoff/U09.md.
 */
export * from './db'
export * from './repo/types'
export * from './export'
export { createLocalRepo } from './repo/local'
export type { Clock } from './repo/local'

import { db } from './db'
import { createLocalRepo } from './repo/local'

/** 앱이 쓰는 단일 Repo. 1~5단계에서는 로컬 구현 하나뿐입니다. */
export const repo = createLocalRepo(db)
