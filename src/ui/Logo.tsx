import { copy } from '../copy'
import logo from './assets/logo.webp'
import styles from './ui.module.css'

/**
 * 앱 로고. 셸의 머리줄 가운데에 들어갑니다 (`app/AppShell`).
 *
 * ## 크기는 토큰이 정합니다
 *
 * `--logo-w`(96px)와 그로부터 계산되는 `--shell-header` 가
 * `ui/tokens.css` 에 있습니다. **여기서 크기를 정하지 않는 이유는 인트로가
 * 화면 높이를 계산할 때 머리줄 높이를 빼기 때문입니다** — 한 곳만 고치면
 * 레이아웃이 따라오게 두었습니다.
 *
 * ## 대체 텍스트가 앱 이름입니다
 *
 * 장식이 아니라 **어느 앱인지 알려 주는 표지**라서 `alt` 를 비우지
 * 않습니다. 문구는 `copy/ko.ts` 에서 옵니다 — 화면에 나가는 글자는 전부
 * 그 파일 하나에 모으는 것이 이 저장소의 규칙입니다 (TECH_SPEC 13).
 *
 * 원본은 1342×719 라 비율이 1.866 입니다. 파일은 가로 720 으로 줄여
 * 두었고(60KB), 96px 로 그리면 화소밀도 3 배 화면에서도 넉넉합니다.
 */
export function Logo() {
  return <img className={styles.logo} src={logo} alt={copy.common.appName} draggable={false} />
}
