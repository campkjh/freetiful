import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Supabase env 가 없어도 빌드 깨지지 않게 placeholder URL 사용
// 실제 Supabase 호출이 필요한 페이지는 런타임에 env 체크로 가드 필요
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
