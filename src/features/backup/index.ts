/**
 * 데이터 백업 — 내보내기·가져오기 (U09, PRD FR-13-1).
 *
 * 함수 본체는 `data/export.ts` 에 있고, 여기는 그것을 화면과 기록 흐름에
 * 붙이는 얇은 층입니다. 정식 화면은 U30 입니다.
 *
 * **파일은 사용자가 누를 때만 만들어집니다.** 조작 없이 내려받게 하던
 * `autoBackupOnce` 는 2026-09-13 에 지웠습니다 — 한 번만 부르려던 함수가
 * 태그를 누를 때마다 다시 불려 팝업이 여러 번 떴고, 같은 날 들어간 설치
 * 권유(`features/install`)가 그보다 나은 대응이기 때문입니다.
 * 자세한 것은 `daily-log/DailyLogScreen.tsx` 의 `persist` 주석.
 */
export { BackupScreen } from './BackupScreen'
export { BackupEntry } from './BackupEntry'
export { BackupSafetyNet } from './BackupSafetyNet'
export {
  markBackupSaved,
  prepareBackup,
  type PreparedBackup,
  type SafetyNetDeps,
} from './safetyNet'
export { downloadBlob } from './download'
