-- Users table (username-only login, no email/password)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  avatar_color TEXT NOT NULL DEFAULT '#FE2C55',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert_all" ON public.users FOR INSERT WITH CHECK (true);

-- Live streams table
CREATE TABLE IF NOT EXISTS public.streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Live Stream',
  is_live BOOLEAN NOT NULL DEFAULT true,
  viewer_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streams_select_all" ON public.streams FOR SELECT USING (true);
CREATE POLICY "streams_insert_all" ON public.streams FOR INSERT WITH CHECK (true);
CREATE POLICY "streams_update_all" ON public.streams FOR UPDATE USING (true);
CREATE POLICY "streams_delete_all" ON public.streams FOR DELETE USING (true);

-- Chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_select_all" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "chat_insert_all" ON public.chat_messages FOR INSERT WITH CHECK (true);

-- WebRTC signaling table for peer-to-peer connections
CREATE TABLE IF NOT EXISTS public.webrtc_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- 'offer', 'answer', 'ice-candidate', 'viewer-join'
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signals_select_all" ON public.webrtc_signals FOR SELECT USING (true);
CREATE POLICY "signals_insert_all" ON public.webrtc_signals FOR INSERT WITH CHECK (true);
CREATE POLICY "signals_delete_all" ON public.webrtc_signals FOR DELETE USING (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_signals;
