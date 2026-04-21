import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';

// 이 클라이언트는 RLS 우회. 오직 서버 API route에서만 사용.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = createClient<any>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
