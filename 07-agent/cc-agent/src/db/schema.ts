export type AgentSessionRecord = {
  id: number;
  session_key: string;
  thread_id: string;
  agent_session_id: string | null;
  status: string;
  last_reply_to: string | null;
  last_sender_id: string | null;
  last_sender_name: string | null;
  last_is_private: number | null;
  created_at: string;
  updated_at: string;
};

export type ChannelMessageRecord = {
  id: number;
  session_id: number;
  message_uid: string | null;
  source: string;
  direction: string;
  content: string;
  sender_id: string | null;
  sender_name: string | null;
  reply_to: string | null;
  channel_payload: string | null;
  created_at: string;
};

export type AgentRunRecord = {
  id: number;
  session_id: number;
  input_message_id: number | null;
  status: string;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};
