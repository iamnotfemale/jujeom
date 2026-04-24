'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * 서버 사이드에서 로그인 처리.
 * - signInWithPassword → setAll() 콜백이 서버에서 실행 → 쿠키가 HTTP 응답 헤더에 포함
 * - redirect() → 클라이언트가 올바른 쿠키를 받은 상태로 이동
 */
export async function serverSignIn(
  email: string,
  password: string,
  next: string,
): Promise<{ error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect(next || '/dashboard');
}

/**
 * 서버 사이드에서 회원가입 처리.
 * 이메일 확인 없이 즉시 세션이 발급된 경우 바로 대시보드로 이동.
 */
export async function serverSignUp(
  email: string,
  password: string,
): Promise<{ error?: string; info?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  if (data.session) {
    redirect('/dashboard');
  }
  return { info: '가입 완료! 이메일로 보낸 확인 링크를 클릭해 주세요.' };
}
