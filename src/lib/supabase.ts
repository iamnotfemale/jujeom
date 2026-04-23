/**
 * 레거시 재수출 — 기존 `import { supabase } from '@/lib/supabase'` 호환용.
 * 클라이언트 컴포넌트 전용. 서버 측에선 `@/lib/supabase/server` 사용.
 */
import { createClient } from './supabase/client';

export const supabase = createClient();
