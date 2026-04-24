import Link from 'next/link';

export const metadata = {
  title: '개인정보처리방침 · 차림',
  description: '차림(jujeom) 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        <Link href="/" style={s.back}>← 홈으로</Link>

        <div style={s.header}>
          <div style={s.logo}>
            <span style={s.mk}>酒</span>
            <span style={s.wm}>차림</span>
          </div>
          <h1 style={s.title}>개인정보처리방침</h1>
          <p style={s.meta}>최종 수정일: 2026년 4월 24일 · 시행일: 2026년 4월 24일</p>
        </div>

        <div style={s.body}>
          <section style={s.section}>
            <h2 style={s.h2}>제1조 개인정보의 처리 목적</h2>
            <p style={s.p}>
              차림(jujeom)은 대학 축제 주점 운영 지원 서비스 제공을 목적으로 최소한의 개인정보를 수집·처리합니다.
              수집된 개인정보는 서비스 제공 목적 외에 사용하지 않습니다.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제2조 수집하는 개인정보 항목</h2>

            <div style={s.infoBox}>
              <div style={s.infoBoxHeader}>
                <span style={s.infoBoxBadge}>관리자 계정</span>
              </div>
              <ul style={s.ul}>
                <li style={s.li}><b>이메일 주소</b> — Supabase Auth를 통한 회원 가입 및 로그인 인증에 사용</li>
                <li style={s.li}><b>비밀번호</b> — Supabase Auth에 암호화되어 저장, 차림은 원문에 접근하지 않습니다</li>
              </ul>
            </div>

            <div style={{ ...s.infoBox, marginTop: 12 }}>
              <div style={s.infoBoxHeader}>
                <span style={s.infoBoxBadge}>주문 데이터</span>
              </div>
              <ul style={s.ul}>
                <li style={s.li}><b>주문 시 입력 정보</b> — 손님이 직접 입력한 이름, 주문 메모(선택 항목)</li>
                <li style={s.li}><b>주문 내역</b> — 메뉴 항목, 수량, 주문 시각, 테이블 번호</li>
              </ul>
            </div>

            <p style={{ ...s.p, marginTop: 16 }}>
              차림은 주민등록번호, 전화번호, 위치 정보 등 민감한 개인정보를 수집하지 않습니다.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제3조 개인정보의 보유 및 이용 기간</h2>
            <ul style={s.ul}>
              <li style={s.li}>
                <b>관리자 계정 정보:</b> 회원 탈퇴 시 즉시 삭제됩니다.
                탈퇴 처리는 서비스 내 계정 설정 또는 이메일 요청을 통해 진행할 수 있습니다.
              </li>
              <li style={s.li}>
                <b>주문 데이터:</b> 운영자(관리자)가 직접 초기화하거나 삭제할 수 있습니다.
                계정 탈퇴 시 해당 계정에 연결된 모든 데이터가 함께 삭제됩니다.
              </li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제4조 개인정보의 제3자 제공</h2>
            <p style={s.p}>
              차림은 수집된 개인정보를 제3자에게 제공하지 않습니다.
              단, 법령에 의거한 수사기관의 요청 등 법적 의무가 있는 경우에는 예외로 합니다.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제5조 개인정보 처리 위탁</h2>
            <p style={s.p}>
              차림은 서비스 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있습니다.
            </p>
            <div style={s.table}>
              <div style={s.tableRow}>
                <div style={s.tableCell}>
                  <span style={s.tableCellLabel}>수탁자</span>
                  <span style={s.tableCellValue}>Supabase, Inc.</span>
                </div>
                <div style={s.tableCell}>
                  <span style={s.tableCellLabel}>위탁 내용</span>
                  <span style={s.tableCellValue}>회원 인증 및 데이터베이스 호스팅</span>
                </div>
                <div style={s.tableCell}>
                  <span style={s.tableCellLabel}>국가</span>
                  <span style={s.tableCellValue}>미국 (AWS 인프라)</span>
                </div>
              </div>
            </div>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제6조 이용자의 권리</h2>
            <p style={s.p}>이용자는 다음 권리를 행사할 수 있습니다.</p>
            <ul style={s.ul}>
              <li style={s.li}>개인정보 열람, 정정, 삭제 요청</li>
              <li style={s.li}>개인정보 처리 정지 요청</li>
              <li style={s.li}>주문 데이터 CSV 다운로드 (서비스 내 기능 제공)</li>
            </ul>
            <p style={{ ...s.p, marginTop: 14 }}>
              위 권리 행사는 아래 연락처로 요청하시거나, 서비스 내 기능을 직접 이용하실 수 있습니다.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제7조 개인정보 보호 책임자</h2>
            <p style={s.p}>
              차림의 개인정보 처리에 관한 문의, 불만 처리, 피해 구제 등에 관한 사항은 아래 담당자에게 문의해 주십시오.
            </p>
            <div style={s.contactBox}>
              <span style={s.contactLabel}>이메일</span>
              <a href="mailto:kucseai@gmail.com" style={s.contactLink}>kucseai@gmail.com</a>
            </div>
          </section>

          <section style={{ ...s.section, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            <h2 style={s.h2}>제8조 방침의 변경</h2>
            <p style={s.p}>
              본 개인정보처리방침은 법령 또는 서비스 변경에 따라 내용이 수정될 수 있습니다.
              변경 사항은 서비스 공지 또는 이메일을 통해 안내드립니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100dvh',
    background: 'var(--paper)',
    padding: '48px 24px 96px',
  },
  inner: {
    maxWidth: 720,
    marginInline: 'auto',
  },
  back: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-2)',
    textDecoration: 'none',
    marginBottom: 40,
  },
  header: {
    paddingBottom: 32,
    borderBottom: '1px solid var(--border)',
    marginBottom: 40,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  mk: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: 'var(--ink-900)',
    color: 'var(--neon)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    fontSize: 15,
    flexShrink: 0,
  } as React.CSSProperties,
  wm: {
    fontWeight: 800,
    fontSize: 17,
    letterSpacing: '-0.02em',
    color: 'var(--ink-900)',
  },
  title: {
    fontSize: 'clamp(28px, 4vw, 42px)',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    color: 'var(--ink-900)',
    margin: '0 0 10px',
    lineHeight: 1.1,
  },
  meta: {
    fontSize: 13,
    color: 'var(--text-3)',
    margin: 0,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  section: {
    paddingBottom: 32,
    marginBottom: 32,
    borderBottom: '1px solid var(--border)',
  },
  h2: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--ink-900)',
    margin: '0 0 14px',
  },
  p: {
    fontSize: 15,
    color: 'var(--text-2)',
    lineHeight: 1.7,
    margin: '0 0 10px',
  },
  ul: {
    margin: '10px 0 0',
    paddingLeft: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  li: {
    fontSize: 15,
    color: 'var(--text-2)',
    lineHeight: 1.65,
  },
  infoBox: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    padding: '16px 18px',
  },
  infoBoxHeader: {
    marginBottom: 12,
  },
  infoBoxBadge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--ink-700)',
    background: 'var(--ink-100)',
    padding: '3px 10px',
    borderRadius: 'var(--r-pill)',
    letterSpacing: '.04em',
  },
  table: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    overflow: 'hidden',
    marginTop: 14,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 1fr',
    borderBottom: '1px solid var(--border)',
  },
  tableCell: {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderRight: '1px solid var(--border)',
  },
  tableCellLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-3)',
    textTransform: 'uppercase' as const,
    letterSpacing: '.08em',
  },
  tableCellValue: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ink-900)',
  },
  contactBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    marginTop: 12,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-3)',
    textTransform: 'uppercase' as const,
    letterSpacing: '.08em',
  },
  contactLink: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--ink-900)',
    textDecoration: 'none',
  },
};
