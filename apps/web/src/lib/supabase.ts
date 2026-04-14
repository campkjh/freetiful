import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 빌드 시점에 env가 비어있어도 크래시 방지를 위해 placeholder URL 사용.
// 실제 런타임 동작은 Vercel 환경변수에 NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY 등록 후 가능.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);
