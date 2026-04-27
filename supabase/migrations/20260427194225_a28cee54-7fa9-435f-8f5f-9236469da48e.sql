
-- ============ user_profiles additions ============
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS bio TEXT CHECK (char_length(bio) <= 300);
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_login_date DATE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS history_is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS friends_are_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS daily_downvotes_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS downvotes_reset_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Enforce unique usernames (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_unique
  ON public.user_profiles (LOWER(username))
  WHERE username IS NOT NULL;

-- ============ series_comments ============
CREATE TABLE IF NOT EXISTS public.series_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  parent_id UUID REFERENCES public.series_comments(id) ON DELETE CASCADE,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_series_comments_series ON public.series_comments(series_id, created_at DESC);
ALTER TABLE public.series_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Series comments are public" ON public.series_comments FOR SELECT USING (true);
CREATE POLICY "Auth users post series comments" ON public.series_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authors edit own series comments" ON public.series_comments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authors delete own series comments" ON public.series_comments FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage series comments" ON public.series_comments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ profile_comments ============
CREATE TABLE IF NOT EXISTS public.profile_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_comments_profile ON public.profile_comments(profile_user_id, created_at DESC);
ALTER TABLE public.profile_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profile comments are public" ON public.profile_comments FOR SELECT USING (true);
CREATE POLICY "Auth users post profile comments" ON public.profile_comments FOR INSERT TO authenticated WITH CHECK (author_user_id = auth.uid());
CREATE POLICY "Authors or wall owner update profile comments" ON public.profile_comments FOR UPDATE TO authenticated USING (author_user_id = auth.uid() OR profile_user_id = auth.uid()) WITH CHECK (author_user_id = auth.uid() OR profile_user_id = auth.uid());
CREATE POLICY "Authors or wall owner delete profile comments" ON public.profile_comments FOR DELETE TO authenticated USING (author_user_id = auth.uid() OR profile_user_id = auth.uid());
CREATE POLICY "Admins manage profile comments" ON public.profile_comments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ comment_votes ============
CREATE TABLE IF NOT EXISTS public.comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL,
  comment_type TEXT NOT NULL CHECK (comment_type IN ('series','profile')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up','down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, comment_type, user_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_votes_target ON public.comment_votes(comment_type, comment_id);
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read aggregated votes (we'll aggregate client-side from public read)
CREATE POLICY "Comment votes are public" ON public.comment_votes FOR SELECT USING (true);
CREATE POLICY "Users cast own votes" ON public.comment_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own votes" ON public.comment_votes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own votes" ON public.comment_votes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ reading_history ============
CREATE TABLE IF NOT EXISTS public.reading_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  chapter_number TEXT,
  translation_id UUID REFERENCES public.translations(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reading_history_user ON public.reading_history(user_id, read_at DESC);
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;

-- Public unless owner is private
CREATE POLICY "Reading history visibility" ON public.reading_history FOR SELECT
USING (
  user_id = auth.uid()
  OR NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = reading_history.user_id AND up.history_is_private = true)
);
CREATE POLICY "Users insert own history" ON public.reading_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own history" ON public.reading_history FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ reading_lists ============
CREATE TABLE IF NOT EXISTS public.reading_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('reading','planned','completed','dropped')),
  current_chapter TEXT,
  is_private BOOLEAN NOT NULL DEFAULT false,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, series_id)
);
CREATE INDEX IF NOT EXISTS idx_reading_lists_user ON public.reading_lists(user_id, updated_at DESC);
ALTER TABLE public.reading_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reading list visibility" ON public.reading_lists FOR SELECT
USING (user_id = auth.uid() OR is_private = false);
CREATE POLICY "Users add own reading list" ON public.reading_lists FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own reading list" ON public.reading_lists FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users remove own reading list" ON public.reading_lists FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ friendships ============
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  is_highlighted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id, status);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants see friendships" ON public.friendships FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "Users send friend requests" ON public.friendships FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Participants update friendships" ON public.friendships FOR UPDATE TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid())
WITH CHECK (requester_id = auth.uid() OR addressee_id = auth.uid());
CREATE POLICY "Participants delete friendships" ON public.friendships FOR DELETE TO authenticated
USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- ============ conversations ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON public.conversations(user1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON public.conversations(user2_id, last_message_at DESC);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants see conversations" ON public.conversations FOR SELECT TO authenticated
USING (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY "Participants create conversations" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY "Participants update conversations" ON public.conversations FOR UPDATE TO authenticated
USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- ============ messages ============
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants see messages" ON public.messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())));
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
);
CREATE POLICY "Recipients mark messages read" ON public.messages FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())));

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- ============ notifications ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "System inserts notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============ site_updates ============
CREATE TABLE IF NOT EXISTS public.site_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'new' CHECK (type IN ('new','improved','fixed')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.site_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site updates are public" ON public.site_updates FOR SELECT USING (true);
CREATE POLICY "Admins manage site updates" ON public.site_updates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Realtime publication ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
