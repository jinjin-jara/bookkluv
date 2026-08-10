// Supabase 접속 정보.
//
// 이 두 값은 브라우저에 그대로 노출된다. 의도된 것이다. 실제 권한은 DB의 RLS
// 정책이 정한다(supabase/schema.sql 참고). secret key / service_role key는
// 여기에 절대 넣지 않는다.

export const SUPABASE_URL = 'https://qncxdlaksqzohoicjwhv.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_7xnOr3SEwOZVgOlIiHjGTQ_L07pdArG';

// 국립중앙도서관 ISBN 서지정보 인증키.
// 비워 두면 책 검색이 Google Books로만 동작한다.
// 이 키도 브라우저에 노출된다. 조회 전용이라 남이 써도 우리 데이터에는 영향이 없다.
export const NL_KEY = '';
