import { useState } from 'react'
import {
  Button,
  Card,
  Dots,
  Field,
  Sheet,
  TabBar,
  TimePicker,
  Toast,
  DOT_STATES,
} from '../../ui'
import styles from './UiCatalog.module.css'

/**
 * 카탈로그 전용 예시 탭.
 *
 * 라이트 버전에는 탭바가 없어(`app/routes.ts` 주석) 셸이 쓰는 탭 목록이
 * 존재하지 않습니다. `TabBar` 컴포넌트 자체는 본 MVP 로 돌아갈 때 그대로
 * 쓰이므로 부품만 남겨 두고, 여기서 보여 줄 예시를 직접 만듭니다.
 */
const SAMPLE_TABS = [
  { id: 'today', path: '/today', label: '오늘' },
  { id: 'pet', path: '/pet/backup', label: '아이' },
] as const

/**
 * /dev/ui — 공용 UI 부품 카탈로그 (WORK_UNITS 1-5).
 *
 * 개발 중에만 존재합니다. App.tsx 가 import.meta.env.DEV 안에서만 이 모듈을
 * 동적으로 불러오므로 프로덕션 빌드에는 청크 자체가 만들어지지 않습니다.
 */
export function UiCatalog() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [time, setTime] = useState('08:30')

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>UI 카탈로그</h1>

      <section className={styles.section}>
        <h2 className={styles.heading}>Button</h2>
        <div className={styles.row}>
          <Button>기록하기</Button>
          <Button variant="secondary">나중에</Button>
          <Button disabled>비활성</Button>
          {/* 44px 자. 버튼 높이와 나란히 두고 눈으로 비교합니다. */}
          <span className={styles.measure} aria-hidden="true" />
        </div>
        <Button block>가로를 채우는 버튼</Button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Card</h2>
        <Card title="오늘 어땠나요">
          <p>제목이 있는 카드입니다.</p>
        </Card>
        <Card>
          <p>제목이 없는 카드입니다.</p>
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Dots</h2>
        {/* 채움 / 빈 / 회색 3종이 한 줄에 다 보이도록 둡니다. */}
        <Dots label="상태 3종" values={DOT_STATES} dayLabels={['좋음', '보통', '힘듦']} />
        <Dots
          label="이번 주"
          values={['good', 'good', 'okay', 'hard', 'good', 'okay', 'good']}
          dayLabels={['월', '화', '수', '목', '금', '토', '일']}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Field</h2>
        <Field label="아이 이름" placeholder="예: 보리" />
        <Field label="체중" type="number" inputMode="decimal" hint="킬로그램 단위로 적습니다." />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>TimePicker</h2>
        <TimePicker label="아침 약" value={time} onChange={setTime} hint={`지금 값: ${time}`} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Sheet</h2>
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          바텀시트 열기
        </Button>
        <Sheet open={sheetOpen} title="약 추가" onClose={() => setSheetOpen(false)}>
          <Field label="약 이름" placeholder="예: 아모디핀" />
          <p>Esc 키로도 닫힙니다.</p>
        </Sheet>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Toast</h2>
        <Button variant="secondary" onClick={() => setToastOpen((open) => !open)}>
          토스트 {toastOpen ? '숨기기' : '보이기'}
        </Button>
        <Toast open={toastOpen} message="기록했습니다." />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>TabBar</h2>
        {/* 실제 셸이 쓰는 것과 같은 컴포넌트입니다. */}
        <TabBar items={SAMPLE_TABS} label="카탈로그 예시 탭바" />
      </section>
    </div>
  )
}
