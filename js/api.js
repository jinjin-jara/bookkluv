// DB 읽기/쓰기만 한다. DOM은 건드리지 않는다.

import { supabase } from './supabase.js';
import { getAnonId } from './nickname.js';

/** 목록용. 질문 본문은 빼고 가볍게 가져온다. */
export async function listMeetings() {
  const { data, error } = await supabase
    .from('meetings')
    .select('id, date, title, author, pages, picked_by')
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMeeting(id) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createMeeting(meeting) {
  const { data, error } = await supabase
    .from('meetings')
    .insert(meeting)
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function updateMeeting(id, patch) {
  const { error } = await supabase.from('meetings').update(patch).eq('id', id);
  if (error) throw error;
}

export async function listComments(meetingId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addComment({ meetingId, target, nickname, body }) {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      meeting_id: meetingId,
      target,
      nickname: nickname.trim(),
      body: body.trim(),
      anon_id: getAnonId(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** 내가 30분 안에 쓴 댓글만 통과한다. 아니면 DB가 거부한다. */
export async function updateComment(id, body) {
  const { error } = await supabase
    .from('comments')
    .update({ body: body.trim() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteComment(id) {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}

export async function listPicks() {
  const { data, error } = await supabase
    .from('picks')
    .select('*, meetings(date, title)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addPicks(rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from('picks').insert(rows).select('id');
  if (error) throw error;
  return data || [];
}
