// Supabase 접속 정보.
//
// 이 두 값은 브라우저에 그대로 노출된다. 의도된 것이다. 실제 권한은 DB의 RLS
// 정책이 정한다(supabase/schema.sql 참고). secret key / service_role key는
// 여기에 절대 넣지 않는다.

export const SUPABASE_URL = 'https://qncxdlaksqzohoicjwhv.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_7xnOr3SEwOZVgOlIiHjGTQ_L07pdArG';
