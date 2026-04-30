-- GUILDS TABLE
CREATE TABLE IF NOT EXISTS public.guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (char_length(name) >= 2 AND char_length(name) <= 40),
  description TEXT CHECK (char_length(description) <= 500),
  avatar_url TEXT,
  banner_url TEXT,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 10),
  xp INTEGER NOT NULL DEFAULT 0,
  member_count INTEGER NOT NULL DEFAULT 1,
  join_type TEXT NOT NULL DEFAULT 'open' CHECK (join_type IN ('open','closed','request')),
  leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guild_card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guilds_level ON public.guilds(level DESC, member_count DESC);
ALTER TABLE public.guilds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees guilds" ON public.guilds FOR SELECT USING (true);
CREATE POLICY "Authenticated create guilds" ON public.guilds FOR INSERT TO authenticated WITH CHECK (leader_id = auth.uid());
CREATE POLICY "Leaders update guilds" ON public.guilds FOR UPDATE TO authenticated USING (leader_id = auth.uid());
CREATE POLICY "Leaders delete guilds" ON public.guilds FOR DELETE TO authenticated USING (leader_id = auth.uid());
ALTER TABLE public.guilds REPLICA IDENTITY FULL;

-- GUILD MEMBERS
CREATE TABLE IF NOT EXISTS public.guild_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader','officer','member')),
  guild_nickname TEXT CHECK (char_length(guild_nickname) <= 30),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  weekly_xp_contributed INTEGER NOT NULL DEFAULT 0,
  total_xp_contributed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON public.guild_members(guild_id, total_xp_contributed DESC);
CREATE INDEX IF NOT EXISTS idx_guild_members_user ON public.guild_members(user_id);
ALTER TABLE public.guild_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees guild members" ON public.guild_members FOR SELECT USING (true);
CREATE POLICY "System manages guild members" ON public.guild_members FOR ALL TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid())) WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid()));

-- GUILD JOIN REQUESTS
CREATE TABLE IF NOT EXISTS public.guild_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT CHECK (char_length(message) <= 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, user_id)
);
ALTER TABLE public.guild_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants see requests" ON public.guild_join_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_join_requests.guild_id AND gm.user_id = auth.uid() AND gm.role = 'officer'));
CREATE POLICY "Users send requests" ON public.guild_join_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leaders manage requests" ON public.guild_join_requests FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_join_requests.guild_id AND gm.user_id = auth.uid() AND gm.role = 'officer'));

-- GUILD RELATIONS
CREATE TABLE IF NOT EXISTS public.guild_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  target_guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ally','rival')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guild_id, target_guild_id),
  CHECK (guild_id <> target_guild_id)
);
ALTER TABLE public.guild_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees guild relations" ON public.guild_relations FOR SELECT USING (true);
CREATE POLICY "Leaders manage relations" ON public.guild_relations FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid()));

-- GUILD CHEST
CREATE TABLE IF NOT EXISTS public.guild_chest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  donated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guild_chest_guild ON public.guild_chest(guild_id);
ALTER TABLE public.guild_chest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see guild chest" ON public.guild_chest FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_chest.guild_id AND gm.user_id = auth.uid()));
CREATE POLICY "Members donate to chest" ON public.guild_chest FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_chest.guild_id AND gm.user_id = auth.uid()));
CREATE POLICY "Leaders manage chest" ON public.guild_chest FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_chest.guild_id AND gm.user_id = auth.uid() AND gm.role = 'officer')) WITH CHECK (EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_chest.guild_id AND gm.user_id = auth.uid() AND gm.role = 'officer'));

-- GUILD WARS
CREATE TABLE IF NOT EXISTS public.guild_wars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_a_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  guild_b_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  guild_a_score INTEGER NOT NULL DEFAULT 0,
  guild_b_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished','cancelled')),
  winner_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  CHECK (guild_a_id <> guild_b_id)
);
CREATE INDEX IF NOT EXISTS idx_guild_wars_active ON public.guild_wars(status, ends_at);
ALTER TABLE public.guild_wars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees guild wars" ON public.guild_wars FOR SELECT USING (true);
ALTER TABLE public.guild_wars REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='guild_wars') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_wars';
  END IF;
END $$;

-- GUILD XP LOG
CREATE TABLE IF NOT EXISTS public.guild_xp_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guild_xp_log_guild ON public.guild_xp_log(guild_id, created_at DESC);
ALTER TABLE public.guild_xp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees guild xp log" ON public.guild_xp_log FOR SELECT USING (true);
CREATE POLICY "System inserts xp log" ON public.guild_xp_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='guild_xp_log') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_xp_log';
  END IF;
END $$;

-- ADD guild_id TO USER PROFILES
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS guild_id UUID REFERENCES public.guilds(id) ON DELETE SET NULL;

-- STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('guild-avatars', 'guild-avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('guild-banners', 'guild-banners', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Guild avatar public read" ON storage.objects;
CREATE POLICY "Guild avatar public read" ON storage.objects FOR SELECT USING (bucket_id IN ('guild-avatars','guild-banners'));
DROP POLICY IF EXISTS "Users upload guild images" ON storage.objects;
CREATE POLICY "Users upload guild images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('guild-avatars','guild-banners'));
DROP POLICY IF EXISTS "Users update guild images" ON storage.objects;
CREATE POLICY "Users update guild images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('guild-avatars','guild-banners'));

-- RPC: award_guild_xp
CREATE OR REPLACE FUNCTION public.award_guild_xp(_guild_id UUID, _user_id UUID, _amount INTEGER, _source TEXT, _description TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_xp INTEGER;
  _new_level INTEGER;
  _thresholds INTEGER[] := ARRAY[0,1000,5000,15000,40000,100000,250000,500000,900000,1500000];
BEGIN
  UPDATE public.guilds SET xp = xp + _amount WHERE id = _guild_id RETURNING xp INTO _new_xp;
  _new_level := 1;
  FOR i IN 2..10 LOOP
    IF _new_xp >= _thresholds[i] THEN _new_level := i; END IF;
  END LOOP;
  UPDATE public.guilds SET level = _new_level WHERE id = _guild_id;
  UPDATE public.guild_members
    SET weekly_xp_contributed = weekly_xp_contributed + _amount,
        total_xp_contributed = total_xp_contributed + _amount
    WHERE guild_id = _guild_id AND user_id = _user_id;
  INSERT INTO public.guild_xp_log (guild_id, user_id, xp_amount, source, description)
    VALUES (_guild_id, _user_id, _amount, _source, _description);
  RETURN _new_level;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.award_guild_xp(UUID, UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_guild_xp(UUID, UUID, INTEGER, TEXT, TEXT) TO authenticated;

-- RPC: spend_ink
CREATE OR REPLACE FUNCTION public.spend_ink(_amount INTEGER, _source TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _new_balance INTEGER;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  UPDATE public.user_profiles
    SET ink_balance = ink_balance - _amount
    WHERE id = _uid AND ink_balance >= _amount
    RETURNING ink_balance INTO _new_balance;
  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient Ink balance';
  END IF;
  INSERT INTO public.daily_ink_log (user_id, source, amount)
    VALUES (_uid, _source, -_amount);
  RETURN _new_balance;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spend_ink(INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_ink(INTEGER, TEXT) TO authenticated;