import Link from 'next/link';

export const metadata = {
  title: '이용약관 · 차림',
  description: '차림(jujeom) 서비스 이용약관',
};

export default function TermsPage() {
  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        <Link href="/" style={s.back}>← 홈으로</Link>

        <div style={s.header}>
          <div style={s.logo}>
            <span style={s.mk}>酒</span>
            <span style={s.wm}>차림</span>
          </div>
          <h1 style={s.title}>이용약관</h1>
          <p style={s.meta}>최종 수정일: 2026년 4월 24일 · 시행일: 2026년 4월 24일</p>
        </div>

        <div style={s.body}>
          <section style={s.section}>
            <h2 style={s.h2}>제1조 목적</h2>
            <p style={s.p}>
              본 약관은 jujeom(이하 "차림")이 제공하는 대학 축제 주점 운영 지원 서비스(이하 "서비스")의
              이용 조건 및 절차, 이용자와 차림 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제2조 서비스 목적 및 내용</h2>
            <p style={s.p}>
              차림은 대학교 축제 기간 중 학생회·동아리가 운영하는 주점의 주문·결제 관리를 지원하는
              웹 기반 서비스입니다. 서비스의 주요 기능은 다음과 같습니다.
            </p>
            <ul style={s.ul}>
              <li style={s.li}>테이블별 QR코드를 통한 손님 주문 접수</li>
              <li style={s.li}>토스(Toss) 계좌 이체 기반 결제 관리</li>
              <li style={s.li}>주방 디스플레이 시스템(KDS)을 통한 실시간 주문 관리</li>
              <li style={s.li}>관리자 대시보드를 통한 영업 현황 확인</li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제3조 이용 자격</h2>
            <p style={s.p}>
              본 서비스는 대학교 학생회·동아리 등 비영리 목적의 축제 행사를 주관하는 단체 및 그 구성원이
              이용할 수 있습니다. 상업적 영리 목적의 이용은 허용되지 않습니다.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제4조 계정 및 보안</h2>
            <ul style={s.ul}>
              <li style={s.li}>이용자는 이메일 주소와 비밀번호로 계정을 생성합니다.</li>
              <li style={s.li}>계정 정보의 관리 책임은 이용자에게 있으며, 타인에게 양도할 수 없습니다.</li>
              <li style={s.li}>계정 정보가 도용되었음을 발견한 경우 즉시 차림에 통보해야 합니다.</li>
              <li style={s.li}>1인당 최대 5개의 주점(부스)을 동시에 운영할 수 있습니다.</li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제5조 금지 행위</h2>
            <p style={s.p}>이용자는 다음 행위를 해서는 안 됩니다.</p>
            <ul style={s.ul}>
              <li style={s.li}>허위 정보를 이용하여 계정을 생성하거나 서비스를 이용하는 행위</li>
              <li style={s.li}>서비스를 영리 목적으로 제3자에게 재판매하는 행위</li>
              <li style={s.li}>서비스의 정상적인 운영을 방해하는 행위(크롤링, 과부하 공격 등)</li>
              <li style={s.li}>타인의 개인정보를 무단으로 수집·이용하는 행위</li>
              <li style={s.li}>관련 법령을 위반하는 행위</li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제6조 서비스의 제공 및 변경</h2>
            <p style={s.p}>
              차림은 학생 사이드 프로젝트로 운영되며, 서비스의 지속적 제공을 보장하지 않습니다.
              서비스 내용의 변경, 중단, 종료가 발생할 수 있으며, 이 경우 사전에 공지하도록 노력합니다.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제7조 면책 조항</h2>
            <ul style={s.ul}>
              <li style={s.li}>차림은 이용자 간 또는 이용자와 제3자 사이의 분쟁에 개입하지 않으며, 이로 인한 손해를 배상할 책임이 없습니다.</li>
              <li style={s.li}>차림은 토스(Toss) 등 제3자 결제 서비스의 오류나 장애로 인해 발생하는 손해에 대해 책임을 지지 않습니다.</li>
              <li style={s.li}>차림은 천재지변, 서버 장애, 네트워크 오류 등 불가항력적 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다.</li>
              <li style={s.li}>이용자가 입력한 메뉴, 가격, 계좌 정보의 정확성에 대한 책임은 이용자에게 있습니다.</li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제8조 약관의 변경</h2>
            <p style={s.p}>
              차림은 필요 시 본 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지 또는 이메일을 통해
              이용자에게 안내합니다. 변경 후에도 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.h2}>제9조 연락처</h2>
            <p style={s.p}>
              서비스 이용에 관한 문의는 아래 연락처로 하시기 바랍니다.
            </p>
            <div style={s.contactBox}>
              <span style={s.contactLabel}>이메일</span>
              <a href="mailto:kucseai@gmail.com" style={s.contactLink}>kucseai@gmail.com</a>
            </div>
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
    textTransform: 'uppercase',
    letterSpacing: '.08em',
  },
  contactLink: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--ink-900)',
    textDecoration: 'none',
  },
};
