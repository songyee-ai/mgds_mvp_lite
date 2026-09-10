/**
 * 런타임에 읽는 설정 데이터.
 * risk-tags.json        병원 연락 노출 유발 태그 — U08
 * thresholds.json       추세 알림 규칙 (수의사 감수 대상) — U18
 * emergency-clinics.json  24시 병원 데이터 — U24
 *
 * JSON 으로 두는 것은 **감수받을 사람이 코드를 읽지 않아도 되게** 하기
 * 위해서입니다 (PRD FR-2-3 "외부 설정 파일로 분리"). `lint-copy` 가
 * 이 디렉토리의 JSON 문자열도 금지 표현으로 검사합니다.
 */

import riskTags from './risk-tags.json'

/**
 * 기록하면 병원 연락 버튼이 나오는 태그 (PRD FR-2-3).
 *
 * 타입을 `Tag` 로 좁히지 않고 문자열로 둡니다. JSON 은 런타임 데이터라
 * 컴파일 타임에 보장되지 않고, 오타가 나면 조용히 아무 태그도 걸리지
 * 않습니다. 9종 안에 있는지는 테스트가 확인합니다.
 */
export const RISK_TAGS: readonly string[] = riskTags.tags
