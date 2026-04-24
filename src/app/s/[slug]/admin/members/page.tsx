'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/admin-api';
import { useStore } from '../../StoreProvider';
import { useToast } from '@/components/ToastProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import type { StoreRole } from '@/lib/types/store';

interface MemberItem {
  userId: string;
  email: string;
  role: StoreRole;
}

interface MembersResponse {
  members: MemberItem[];
  myRole: StoreRole;
}

const ROLE_LABEL: Record<StoreRole, string> = {
  owner: '소유자',
  manager: '매니저',
  kitchen: '주방',
};

export default function MembersPage() {
  const store = useStore();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [myRole, setMyRole] = useState<StoreRole>('kitchen');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<'manager' | 'kitchen'>('manager');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await adminApi<MembersResponse>(
      `/api/admin/${store.slug}/members`,
      { method: 'GET' },
    );
    if (error || !data) {
      showToast('멤버 목록을 불러오지 못했습니다', 'error');
    } else {
      setMembers(data.members);
      setMyRole(data.myRole);
    }
    setLoading(false);
  }, [store.slug, showToast]);

  // 현재 로그인 유저 id 파악 — supabase client 없이 멤버 목록에서 자신 찾기
  // (layout에서 role 전달하지 않으므로 API 응답 활용)
  useEffect(() => {
    // supabase session에서 user id 가져오기
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        setMyUserId(data?.user?.id ?? null);
      });
    });
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleAdd = async () => {
    if (!addEmail.trim()) return;
    setAddLoading(true);
    setAddError(null);
    const { error } = await adminApi(`/api/admin/${store.slug}/members`, {
      method: 'POST',
      body: { email: addEmail.trim(), role: addRole },
    });
    setAddLoading(false);
    if (error === 'user_not_found') {
      setAddError('가입되지 않은 이메일입니다');
      return;
    }
    if (error === 'cannot_add_self') {
      setAddError('자기 자신은 추가할 수 없습니다');
      return;
    }
    if (error) {
      setAddError('추가 실패: ' + error);
      return;
    }
    showToast('멤버를 추가했습니다', 'success');
    setAddEmail('');
    fetchMembers();
  };

  const handleRemove = async (member: MemberItem) => {
    const ok = await confirm({
      title: '멤버 제거',
      message: `${member.email}을(를) 팀에서 제거하시겠습니까?`,
      confirmText: '제거',
      danger: true,
    });
    if (!ok) return;
    const { error } = await adminApi(`/api/admin/${store.slug}/members`, {
      method: 'DELETE',
      body: { userId: member.userId },
    });
    if (error) {
      showToast('제거 실패: ' + error, 'error');
      return;
    }
    showToast('멤버를 제거했습니다');
    fetchMembers();
  };

  const isOwner = myRole === 'owner';

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>팀 관리</h1>
          <p style={s.sub}>
            {loading ? '불러오는 중...' : `멤버 ${members.length}명`}
          </p>
        </div>
      </div>

      {/* Member List */}
      <div style={s.section}>
        <div style={s.sectionTitle}>현재 멤버</div>
        <div style={s.card}>
          {loading ? (
            <div style={s.empty}>불러오는 중...</div>
          ) : members.length === 0 ? (
            <div style={s.empty}>멤버가 없습니다</div>
          ) : (
            members.map((m, i) => {
              const isSelf = m.userId === myUserId;
              const isOwnerMember = m.role === 'owner';
              return (
                <div
                  key={m.userId}
                  style={{
                    ...s.memberRow,
                    borderBottom: i < members.length - 1 ? '1px solid var(--ink-050)' : 'none',
                  }}
                >
                  <div style={s.memberAvatar}>
                    {(m.email ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.memberEmail} title={m.email}>
                      {m.email}
                      {isSelf && (
                        <span style={s.selfBadge}>나</span>
                      )}
                    </div>
                  </div>
                  <span style={{ ...s.roleBadge, ...roleBadgeStyle(m.role) }}>
                    {ROLE_LABEL[m.role]}
                  </span>
                  {isOwner && !isOwnerMember && !isSelf && (
                    <button
                      onClick={() => handleRemove(m)}
                      style={s.removeBtn}
                      title="멤버 제거"
                    >
                      ✕
                    </button>
                  )}
                  {(!isOwner || isOwnerMember || isSelf) && (
                    <div style={{ width: 32 }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Member — owner only */}
      {isOwner && (
        <div style={s.section}>
          <div style={s.sectionTitle}>멤버 추가</div>
          <div style={{ ...s.card, padding: '20px 24px' }}>
            <div style={s.addRow}>
              <input
                type="email"
                placeholder="이메일 주소"
                value={addEmail}
                onChange={(e) => { setAddEmail(e.target.value); setAddError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                style={s.emailInput}
              />
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as 'manager' | 'kitchen')}
                style={s.roleSelect}
              >
                <option value="manager">매니저</option>
                <option value="kitchen">주방</option>
              </select>
              <button
                onClick={handleAdd}
                disabled={addLoading || !addEmail.trim()}
                style={{
                  ...s.addBtn,
                  opacity: addLoading || !addEmail.trim() ? 0.5 : 1,
                  cursor: addLoading || !addEmail.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {addLoading ? '추가 중...' : '추가'}
              </button>
            </div>
            {addError && (
              <div style={s.errorMsg}>{addError}</div>
            )}
            <div style={s.addHint}>
              이미 가입된 계정의 이메일만 추가할 수 있습니다.
              이미 멤버인 경우 역할이 업데이트됩니다.
            </div>
          </div>
        </div>
      )}

      {/* Role Guide */}
      <div style={s.section}>
        <div style={s.sectionTitle}>역할 안내</div>
        <div style={{ ...s.card, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            { role: 'owner' as StoreRole, desc: '모든 권한 — 가게 설정, 멤버 관리, 결제, 메뉴' },
            { role: 'manager' as StoreRole, desc: '운영 권한 — 결제 확인, 메뉴 관리, 테이블 관리' },
            { role: 'kitchen' as StoreRole, desc: '주방 권한 — 주방 화면 접근' },
          ] as { role: StoreRole; desc: string }[]).map(({ role, desc }) => (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...s.roleBadge, ...roleBadgeStyle(role), flexShrink: 0 }}>
                {ROLE_LABEL[role]}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-600)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function roleBadgeStyle(role: StoreRole): React.CSSProperties {
  if (role === 'owner') return { background: 'var(--ink-900)', color: '#fff' };
  if (role === 'manager') return { background: 'var(--neon)', color: 'var(--ink-900)' };
  return { background: 'var(--ink-100)', color: 'var(--ink-600)' };
}

const s: Record<string, React.CSSProperties> = {
  page: {
    padding: '0 0 40px',
    maxWidth: 680,
  },
  header: {
    padding: '24px 28px 0',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.3,
  },
  sub: {
    fontSize: 13,
    color: 'var(--ink-400)',
    margin: '2px 0 0',
  },
  section: {
    padding: '0 28px',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--ink-400)',
    marginBottom: 10,
  },
  card: {
    background: 'var(--white)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    overflow: 'hidden',
  },
  empty: {
    padding: 32,
    textAlign: 'center' as const,
    color: 'var(--ink-400)',
    fontSize: 13,
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--ink-100)',
    color: 'var(--ink-600)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  memberEmail: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ink-900)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  selfBadge: {
    fontSize: 10,
    fontWeight: 700,
    background: 'var(--ink-100)',
    color: 'var(--ink-500)',
    padding: '1px 6px',
    borderRadius: 'var(--r-pill)',
  },
  roleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 10px',
    borderRadius: 'var(--r-pill)',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'color-mix(in oklab, var(--crim) 10%, white)',
    color: 'var(--crim)',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background .12s ease',
  },
  addRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  emailInput: {
    flex: 1,
    minWidth: 180,
    height: 38,
    padding: '0 14px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border)',
    fontSize: 13,
    fontFamily: 'var(--f-sans)',
    outline: 'none',
    background: 'var(--white)',
  },
  roleSelect: {
    height: 38,
    padding: '0 12px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border)',
    fontSize: 13,
    fontFamily: 'var(--f-sans)',
    background: 'var(--white)',
    cursor: 'pointer',
    outline: 'none',
  },
  addBtn: {
    height: 38,
    padding: '0 20px',
    borderRadius: 'var(--r-sm)',
    border: 'none',
    background: 'var(--ink-900)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'var(--f-sans)',
    transition: 'opacity .12s ease',
  },
  errorMsg: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--crim)',
  },
  addHint: {
    marginTop: 10,
    fontSize: 12,
    color: 'var(--ink-400)',
    lineHeight: 1.5,
  },
};
