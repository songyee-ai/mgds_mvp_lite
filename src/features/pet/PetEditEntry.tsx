import { Link } from 'react-router-dom'
import { copy } from '../../copy'
import { PET_EDIT_PATH } from '../../app/routes'
import styles from './pet.module.css'

/**
 * 홈 맨 아래의 수정 화면 진입점 한 줄 (`BackupEntry` 와 같은 모양).
 *
 * **백업 줄 위에 섭니다.** 아이에 관한 것이 데이터에 관한 것보다 앞이고,
 * 둘 다 홈의 내용이 아니라 나가는 문이라 footer 에 함께 둡니다.
 *
 * 44px 하한과 포커스 링은 `.entry` 가 맡습니다 (NFR-A A-2).
 */
export function PetEditEntry() {
  return (
    <Link className={styles.entry} to={PET_EDIT_PATH}>
      {copy.petEdit.entry}
    </Link>
  )
}
