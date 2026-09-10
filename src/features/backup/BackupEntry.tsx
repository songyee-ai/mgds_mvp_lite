import { Link } from 'react-router-dom'
import { copy } from '../../copy'
import styles from './backup.module.css'

/**
 * 백업 화면 진입점 1줄 (WORK_UNITS U09 산출물).
 *
 * **본 MVP 는 이 줄을 아이 탭에 두었고, 라이트는 홈 맨 아래에 둡니다.**
 * 탭바를 지우면서 아이 탭이 없어졌고(`app/routes.ts`), 남은 자리 중
 * 사용자가 늘 지나는 곳은 홈뿐입니다.
 *
 * 컴포넌트를 따로 둔 채로 남긴 이유는 이 줄이 **홈의 일부가 아니기**
 * 때문입니다. PRD FR-13 의 정식 내보내기·가져오기 화면이 생기면 이 한 줄이
 * 그 자리로 옮겨 가고, 홈은 건드릴 것이 없어야 합니다.
 *
 * 44px 하한과 포커스 링은 `.entry` 가 맡습니다 (NFR-A A-2).
 */
export function BackupEntry() {
  return (
    <Link className={styles.entry} to="/pet/backup">
      {copy.backup.entry}
    </Link>
  )
}
