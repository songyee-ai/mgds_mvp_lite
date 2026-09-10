import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 5173 은 이 머신의 다른 프로젝트가 쓰고 있어 5174 로 고정합니다.
  server: { port: 5174, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    /*
     * 기본값 5초로는 `tests/data-seed.test.ts` 가 커버리지 계측 아래에서
     * 시간을 넘깁니다 — 3년치 시드를 fake-indexeddb 에 쓰는 테스트라
     * v8 계측이 붙으면 느려집니다. `npm test` 만 돌릴 때는 통과하므로
     * 느린 것이지 멈춘 것이 아닙니다.
     *
     * **테스트를 고치는 대신 한도를 올린 이유**는 그 테스트가 보는 것이
     * "같은 인자로 두 번 돌리면 같은 건수가 나온다" 이고, 건수를 줄이면
     * 그 단언의 의미가 줄기 때문입니다.
     */
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      // 도메인만 봅니다. 순수 함수라 100% 가 싸고, 여기가 제품의 정확도
      // 전부입니다 (TECH_SPEC 15). UI 커버리지를 섞으면 이 숫자가 의미를 잃습니다.
      include: ['src/domain/**/*.ts'],
      // 배럴은 재수출만 합니다. 실행할 코드가 없어 분모를 흐립니다.
      exclude: ['src/domain/index.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
})
