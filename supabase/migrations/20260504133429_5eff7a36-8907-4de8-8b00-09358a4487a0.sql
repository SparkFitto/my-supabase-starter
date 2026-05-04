-- Region on guilds
ALTER TABLE public.guilds 
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'global' 
    CHECK (region IN ('global','en','es','pt','fr','ru','id'));

-- Guild member nicknames (column exists, ensure constraint)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='guild_members' AND column_name='guild_nickname') THEN
    ALTER TABLE public.guild_members ADD COLUMN guild_nickname TEXT;
  END IF;
END $$;

-- Guild reward tape tracking
CREATE TABLE IF NOT EXISTS public.guild_member_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL,
  user_id UUID NOT NULL,
  total_xp_for_rewards INTEGER NOT NULL DEFAULT 0,
  last_reward_threshold INTEGER NOT NULL DEFAULT 0,
  claimed_thresholds INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guild_member_rewards_unique ON public.guild_member_rewards(guild_id, user_id);
ALTER TABLE public.guild_member_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members see own rewards" ON public.guild_member_rewards;
CREATE POLICY "Members see own rewards" ON public.guild_member_rewards FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_member_rewards.guild_id AND gm.user_id = auth.uid()));
DROP POLICY IF EXISTS "System manages rewards" ON public.guild_member_rewards;
CREATE POLICY "System manages rewards" ON public.guild_member_rewards FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Guild comments
CREATE TABLE IF NOT EXISTS public.guild_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
  parent_id UUID REFERENCES public.guild_comments(id) ON DELETE CASCADE,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guild_comments_guild ON public.guild_comments(guild_id, created_at DESC);
ALTER TABLE public.guild_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads guild comments" ON public.guild_comments;
CREATE POLICY "Anyone reads guild comments" ON public.guild_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated comment" ON public.guild_comments;
CREATE POLICY "Authenticated comment" ON public.guild_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Own comment delete" ON public.guild_comments;
CREATE POLICY "Own comment delete" ON public.guild_comments FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER TABLE public.guild_comments REPLICA IDENTITY FULL;

-- Guild announcements
CREATE TABLE IF NOT EXISTS public.guild_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guild_announcements_guild ON public.guild_announcements(guild_id, is_pinned DESC, created_at DESC);
ALTER TABLE public.guild_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads announcements" ON public.guild_announcements;
CREATE POLICY "Anyone reads announcements" ON public.guild_announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Leaders post announcements" ON public.guild_announcements;
CREATE POLICY "Leaders post announcements" ON public.guild_announcements FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.guild_members gm WHERE gm.guild_id = guild_announcements.guild_id AND gm.user_id = auth.uid() AND gm.role IN ('leader','officer'))
  )
);
DROP POLICY IF EXISTS "Authors update announcements" ON public.guild_announcements;
CREATE POLICY "Authors update announcements" ON public.guild_announcements FOR UPDATE TO authenticated USING (
  author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid())
);
DROP POLICY IF EXISTS "Authors delete own" ON public.guild_announcements;
CREATE POLICY "Authors delete own" ON public.guild_announcements FOR DELETE TO authenticated USING (
  author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.guilds g WHERE g.id = guild_id AND g.leader_id = auth.uid())
);

-- Pack drop percentages
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('drop_rate_x', '1', 'Pack drop rate: X rank (%)'),
  ('drop_rate_s', '4', 'Pack drop rate: S rank (%)'),
  ('drop_rate_a', '10', 'Pack drop rate: A rank (%)'),
  ('drop_rate_b', '15', 'Pack drop rate: B rank (%)'),
  ('drop_rate_c', '20', 'Pack drop rate: C rank (%)'),
  ('drop_rate_d', '20', 'Pack drop rate: D rank (%)'),
  ('drop_rate_e', '15', 'Pack drop rate: E rank (%)'),
  ('drop_rate_f', '8', 'Pack drop rate: F rank (%)'),
  ('drop_rate_g', '7', 'Pack drop rate: G rank (%)')
ON CONFLICT (key) DO NOTHING;

-- Guild XP level thresholds
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('guild_xp_level_1', '0', 'XP required for guild level 1'),
  ('guild_xp_level_2', '3000', 'XP required for guild level 2'),
  ('guild_xp_level_3', '10000', 'XP required for guild level 3'),
  ('guild_xp_level_4', '25000', 'XP required for guild level 4'),
  ('guild_xp_level_5', '60000', 'XP required for guild level 5 (wars unlock)'),
  ('guild_xp_level_6', '130000', 'XP required for guild level 6 (guild shop)'),
  ('guild_xp_level_7', '250000', 'XP required for guild level 7 (regional wars)'),
  ('guild_xp_level_8', '450000', 'XP required for guild level 8'),
  ('guild_xp_level_9', '750000', 'XP required for guild level 9'),
  ('guild_xp_level_10', '1200000', 'XP required for guild level 10 (max)')
ON CONFLICT (key) DO NOTHING;

-- Realtime
ALTER TABLE public.guilds REPLICA IDENTITY FULL;
ALTER TABLE public.guild_members REPLICA IDENTITY FULL;
ALTER TABLE public.guild_xp_log REPLICA IDENTITY FULL;
ALTER TABLE public.guild_wars REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='guilds') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.guilds';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='guild_members') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_members';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='guild_xp_log') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_xp_log';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='guild_comments') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_comments';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='guild_wars') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.guild_wars';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- award_guild_xp updated thresholds
CREATE OR REPLACE FUNCTION public.award_guild_xp(_guild_id UUID, _user_id UUID, _amount INTEGER, _source TEXT, _description TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_xp INTEGER;
  _new_level INTEGER;
  _thresholds INTEGER[] := ARRAY[0,3000,10000,25000,60000,130000,250000,450000,750000,1200000];
BEGIN
  UPDATE public.guilds SET xp = xp + _amount WHERE id = _guild_id RETURNING xp INTO _new_xp;
  IF _new_xp IS NULL THEN RETURN NULL; END IF;
  _new_level := 1;
  FOR i IN 2..10 LOOP
    IF _new_xp >= _thresholds[i] THEN _new_level := i; END IF;
  END LOOP;
  UPDATE public.guilds SET level = _new_level, member_count = (SELECT COUNT(*) FROM public.guild_members WHERE guild_id = _guild_id) WHERE id = _guild_id;
  UPDATE public.guild_members
    SET weekly_xp_contributed = weekly_xp_contributed + _amount,
        total_xp_contributed = total_xp_contributed + _amount
    WHERE guild_id = _guild_id AND user_id = _user_id;
  INSERT INTO public.guild_xp_log (guild_id, user_id, xp_amount, source, description)
    VALUES (_guild_id, _user_id, _amount, _source, _description);
  RETURN _new_level;
END;
$$;

-- open_pack with dynamic rates + tier weighting
CREATE OR REPLACE FUNCTION public.open_pack()
RETURNS TABLE(opening_id uuid, card_ids uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _balance INTEGER; _s_pity INTEGER; _x_pity INTEGER;
  _picks UUID[] := '{}'; _pick UUID; _force_rank TEXT := NULL;
  _r TEXT; _i INTEGER; _roll NUMERIC; _opening_id UUID;
  _cost INTEGER := 55; _s_thresh INTEGER := 50; _x_thresh INTEGER := 150;
  _rate_x NUMERIC := 0.01; _rate_s NUMERIC := 0.04; _rate_a NUMERIC := 0.10;
  _rate_b NUMERIC := 0.15; _rate_c NUMERIC := 0.20; _rate_d NUMERIC := 0.20;
  _rate_e NUMERIC := 0.15; _rate_f NUMERIC := 0.08;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT COALESCE((value::INTEGER), _cost) INTO _cost FROM public.platform_settings WHERE key='pack_cost_ink';
  SELECT COALESCE((value::INTEGER), _s_thresh) INTO _s_thresh FROM public.platform_settings WHERE key='s_pity_threshold';
  SELECT COALESCE((value::INTEGER), _x_thresh) INTO _x_thresh FROM public.platform_settings WHERE key='x_pity_threshold';
  SELECT COALESCE((value::NUMERIC/100), _rate_x) INTO _rate_x FROM public.platform_settings WHERE key='drop_rate_x';
  SELECT COALESCE((value::NUMERIC/100), _rate_s) INTO _rate_s FROM public.platform_settings WHERE key='drop_rate_s';
  SELECT COALESCE((value::NUMERIC/100), _rate_a) INTO _rate_a FROM public.platform_settings WHERE key='drop_rate_a';
  SELECT COALESCE((value::NUMERIC/100), _rate_b) INTO _rate_b FROM public.platform_settings WHERE key='drop_rate_b';
  SELECT COALESCE((value::NUMERIC/100), _rate_c) INTO _rate_c FROM public.platform_settings WHERE key='drop_rate_c';
  SELECT COALESCE((value::NUMERIC/100), _rate_d) INTO _rate_d FROM public.platform_settings WHERE key='drop_rate_d';
  SELECT COALESCE((value::NUMERIC/100), _rate_e) INTO _rate_e FROM public.platform_settings WHERE key='drop_rate_e';
  SELECT COALESCE((value::NUMERIC/100), _rate_f) INTO _rate_f FROM public.platform_settings WHERE key='drop_rate_f';

  SELECT ink_balance, s_pity_counter, x_pity_counter INTO _balance, _s_pity, _x_pity
    FROM public.user_profiles WHERE id = _uid FOR UPDATE;
  IF _balance < _cost THEN RAISE EXCEPTION 'Not enough Ink'; END IF;
  IF _x_pity + 1 >= _x_thresh THEN _force_rank := 'X';
  ELSIF _s_pity + 1 >= _s_thresh THEN _force_rank := 'S';
  END IF;
  FOR _i IN 1..3 LOOP
    IF _i = 1 AND _force_rank IS NOT NULL THEN _r := _force_rank;
    ELSE
      _roll := random();
      IF _roll < _rate_x THEN _r := 'X';
      ELSIF _roll < (_rate_x + _rate_s) THEN _r := 'S';
      ELSIF _roll < (_rate_x + _rate_s + _rate_a) THEN _r := 'A';
      ELSIF _roll < (_rate_x + _rate_s + _rate_a + _rate_b) THEN _r := 'B';
      ELSIF _roll < (_rate_x + _rate_s + _rate_a + _rate_b + _rate_c) THEN _r := 'C';
      ELSIF _roll < (_rate_x + _rate_s + _rate_a + _rate_b + _rate_c + _rate_d) THEN _r := 'D';
      ELSIF _roll < (_rate_x + _rate_s + _rate_a + _rate_b + _rate_c + _rate_d + _rate_e) THEN _r := 'E';
      ELSIF _roll < (_rate_x + _rate_s + _rate_a + _rate_b + _rate_c + _rate_d + _rate_e + _rate_f) THEN _r := 'F';
      ELSE _r := 'G';
      END IF;
    END IF;
    SELECT c.id INTO _pick FROM public.cards c
      LEFT JOIN public.series s ON s.id = c.series_id
      WHERE c.is_approved = true AND c.rank = _r
      ORDER BY (random() * CASE COALESCE(s.tier,1) WHEN 1 THEN 1.0 WHEN 2 THEN 0.5 WHEN 3 THEN 0.2 ELSE 1.0 END) DESC
      LIMIT 1;
    IF _pick IS NULL THEN
      SELECT id INTO _pick FROM public.cards WHERE is_approved = true ORDER BY random() LIMIT 1;
    END IF;
    _picks := _picks || _pick;
  END LOOP;
  UPDATE public.user_profiles
    SET ink_balance = ink_balance - _cost,
        pack_counter = pack_counter + 1,
        s_pity_counter = CASE WHEN _force_rank IN ('S','X') THEN 0 ELSE s_pity_counter + 1 END,
        x_pity_counter = CASE WHEN _force_rank = 'X' THEN 0 ELSE x_pity_counter + 1 END
    WHERE id = _uid;
  INSERT INTO public.pack_openings (user_id, cards_shown, ink_spent)
    VALUES (_uid, _picks, _cost) RETURNING id INTO _opening_id;
  RETURN QUERY SELECT _opening_id, _picks;
END;
$$;