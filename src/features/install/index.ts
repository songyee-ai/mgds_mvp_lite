/**
 * 홈 화면에 추가 권유 (TECH_SPEC 8-6 대응 1번).
 *
 * 8-6 의 대응책 다섯 개 중 **1번**입니다. 자동 백업(2번, `features/backup`)이
 * 기록을 잃은 뒤에 되돌리는 수단이라면, 이쪽은 잃지 않게 하는 수단입니다 —
 * 홈 화면에 추가된 웹앱은 Safari 의 7일 저장소 정책에서 제외됩니다.
 */
export { InstallPrompt } from './InstallPrompt'
export {
  dismissInstallPrompt,
  hasPromptEvent,
  installOffer,
  isIos,
  isStandalone,
  onPromptEventChange,
  showInstallPrompt,
  type DismissDeps,
  type InstallFacts,
  type InstallOffer,
} from './install'
