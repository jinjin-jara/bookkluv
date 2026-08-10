// Supabase 클라이언트 하나만 만들어 공유한다.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { getAnonId } from './nickname.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  global: {
    // 댓글 수정·삭제 정책이 이 헤더를 본다 (schema.sql의 current_anon_id()).
    headers: { 'x-anon-id': getAnonId() },
  },
});
