/**
 * 화면 단위 기능 모듈.
 *
 * 라이트 버전이 가진 것 전부입니다 — 인트로, 아이 등록, 온보딩 마무리,
 * 홈, 일일 기록, 데이터 백업, 설치 권유. 본 MVP 의 flow·clinic·summary·
 * invite·medication 은 라이트 범위 밖입니다.
 *
 * `install` 만 화면이 아닙니다 — 홈에 얹히는 한 장이고, 자기 라우트가
 * 없습니다 (TECH_SPEC 8-6 대응 1번).
 */
export * from './intro'
export * from './pet'
export * from './welcome'
export * from './home'
export * from './daily-log'
export * from './backup'
export * from './install'
