/*
 * `scripts/stamp-sw.mjs` 의 타입.
 *
 * 스크립트는 JS 로 둡니다 — `npm run build` 가 컴파일 없이 바로 실행하고,
 * 다른 린트 스크립트들도 전부 `.mjs` 입니다. 그런데 `tests/sw.test.ts` 가
 * **진짜 그 함수들을** 가져다 써야 합니다. 테스트가 자리표시자를 따로
 * 흉내 내면 둘이 어긋나는 날 테스트만 초록이 됩니다.
 *
 * **손으로 적은 선언이라 구현과 어긋날 수 있습니다.** 함수를 고치면
 * 여기도 고치세요. 개수가 적어 이 편이 tsconfig 에 `allowJs` 를 켜는 것보다
 * 쌉니다.
 */

export declare const VERSION_TOKEN: string
export declare const PRECACHE_TOKEN: string
export declare const SKIP_EXTENSIONS: string[]
export declare const SKIP_FILES: string[]

export declare function precacheList(paths: string[]): string[]
export declare function buildId(dist: string, urls: string[]): string
export declare function stamp(
  source: string,
  values: { version: string; precache: string[] },
): string
