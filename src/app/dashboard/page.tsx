import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * 임시 대시보드 (Phase 2a 플레이스홀더).
 * Phase 2b에서 가게 목록/생성 UI로 확장될 예정.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>대시보드</h1>
        <p style={styles.email}>{user.email}</p>
        <p style={styles.body}>
          Phase 2b에서 내 가게 목록과 가게 생성 UI가 여기에 들어올 예정입니다.
        </p>
        <div style={styles.links}>
          <Link href="/auth/logout" style={styles.link}>
            로그아웃
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: 'var(--bg-1, #0E1220)',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    background: 'var(--bg-2, #141A2E)',
    borderRadius: 16,
    padding: '28px 24px',
    color: 'var(--text-1, #fff)',
  },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 10 },
  email: { fontSize: 14, color: 'var(--text-3, #9aa0b3)', marginBottom: 16 },
  body: { fontSize: 14, lineHeight: 1.6, color: 'var(--text-2, #c9ccd6)' },
  links: { marginTop: 20 },
  link: { color: 'var(--accent, #3B82F6)', textDecoration: 'none', fontSize: 14 },
};
