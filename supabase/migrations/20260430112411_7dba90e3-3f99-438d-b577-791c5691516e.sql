
-- ============ ROLE ENUM EXPANSION ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pro' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'pro';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'moderator' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'moderator';
  END IF;
END $$;

-- ============ CURRENCY COLUMNS ON user_profiles ============
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS ink_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pages_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pack_counter INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS s_pity_counter INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS x_pity_counter INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_ink_claimed_at DATE,
  ADD COLUMN IF NOT EXISTS shard_balance JSONB NOT NULL DEFAULT '{"X":0,"S":0,"A":0,"P":0,"G":0,"B":0,"C":0,"D":0,"E":0}'::jsonb;

ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles';
  END IF;
END $$;

-- ============ CARDS ============
CREATE TABLE IF NOT EXISTS public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
  character_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  rank TEXT NOT NULL CHECK (rank IN ('E','D','C','B','G','P','A','S','X','T','H','N','V','L','K','Q')),
  is_animated BOOLEAN NOT NULL DEFAULT false,
  is_limited BOOLEAN NOT NULL DEFAULT false,
  event_type TEXT CHECK (event_type IN ('H','N','V','L') OR event_type IS NULL),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cards_rank ON public.cards(rank);
CREATE INDEX IF NOT EXISTS idx_cards_series ON public.cards(series_id);
CREATE INDEX IF NOT EXISTS idx_cards_approved ON public.cards(is_approved);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees approved cards" ON public.cards;
CREATE POLICY "Anyone sees approved cards" ON public.cards FOR SELECT USING (is_approved = true OR submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
DROP POLICY IF EXISTS "Authenticated submit cards" ON public.cards;
CREATE POLICY "Authenticated submit cards" ON public.cards FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid());
DROP POLICY IF EXISTS "Admins manage cards" ON public.cards;
CREATE POLICY "Admins manage cards" ON public.cards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));

-- ============ USER_CARDS ============
CREATE TABLE IF NOT EXISTS public.user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  frame_level INTEGER NOT NULL DEFAULT 0 CHECK (frame_level >= 0 AND frame_level <= 7),
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  is_trade_ready BOOLEAN NOT NULL DEFAULT false,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_cards_user ON public.user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_card ON public.user_cards(card_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_cards_unique ON public.user_cards(user_id, card_id);
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public sees user_cards" ON public.user_cards;
CREATE POLICY "Public sees user_cards" ON public.user_cards FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own user_cards" ON public.user_cards;
CREATE POLICY "Users manage own user_cards" ON public.user_cards FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER TABLE public.user_cards REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='user_cards') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_cards';
  END IF;
END $$;

-- ============ CARD_TRADES ============
CREATE TABLE IF NOT EXISTS public.card_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  receiver_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  seen_at TIMESTAMPTZ,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> receiver_id)
);
CREATE INDEX IF NOT EXISTS idx_trades_sender ON public.card_trades(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_receiver ON public.card_trades(receiver_id, status);
ALTER TABLE public.card_trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants see trades" ON public.card_trades;
CREATE POLICY "Participants see trades" ON public.card_trades FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());
DROP POLICY IF EXISTS "Users send trades" ON public.card_trades;
CREATE POLICY "Users send trades" ON public.card_trades FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
DROP POLICY IF EXISTS "Participants update trades" ON public.card_trades;
CREATE POLICY "Participants update trades" ON public.card_trades FOR UPDATE TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());
ALTER TABLE public.card_trades REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='card_trades') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.card_trades';
  END IF;
END $$;

-- ============ CARD_LOTS ============
CREATE TABLE IF NOT EXISTS public.card_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  price_amount INTEGER NOT NULL CHECK (price_amount > 0),
  price_rank TEXT NOT NULL CHECK (price_rank IN ('E','D','C','B','G','P','A','S','X')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lots_active ON public.card_lots(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lots_seller ON public.card_lots(seller_id);
ALTER TABLE public.card_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees active lots" ON public.card_lots;
CREATE POLICY "Anyone sees active lots" ON public.card_lots FOR SELECT USING (status = 'active' OR seller_id = auth.uid());
DROP POLICY IF EXISTS "Users create lots" ON public.card_lots;
CREATE POLICY "Users create lots" ON public.card_lots FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own lots" ON public.card_lots;
CREATE POLICY "Users manage own lots" ON public.card_lots FOR UPDATE TO authenticated USING (seller_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own lots" ON public.card_lots;
CREATE POLICY "Users delete own lots" ON public.card_lots FOR DELETE TO authenticated USING (seller_id = auth.uid());
ALTER TABLE public.card_lots REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='card_lots') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.card_lots';
  END IF;
END $$;

-- ============ CARD_REQUESTS ============
CREATE TABLE IF NOT EXISTS public.card_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  offer_amount INTEGER NOT NULL CHECK (offer_amount > 0),
  offer_rank TEXT NOT NULL CHECK (offer_rank IN ('E','D','C','B','G','P','A','S','X')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_requests_card ON public.card_requests(card_id, status);
ALTER TABLE public.card_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees open requests" ON public.card_requests;
CREATE POLICY "Anyone sees open requests" ON public.card_requests FOR SELECT USING (status = 'open' OR buyer_id = auth.uid());
DROP POLICY IF EXISTS "Users create requests" ON public.card_requests;
CREATE POLICY "Users create requests" ON public.card_requests FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own requests" ON public.card_requests;
CREATE POLICY "Users manage own requests" ON public.card_requests FOR UPDATE TO authenticated USING (buyer_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own requests" ON public.card_requests;
CREATE POLICY "Users delete own requests" ON public.card_requests FOR DELETE TO authenticated USING (buyer_id = auth.uid());

-- ============ CARD_WISHLIST ============
CREATE TABLE IF NOT EXISTS public.card_wishlist (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'want' CHECK (type IN ('want','unwanted')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);
ALTER TABLE public.card_wishlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees wishlists" ON public.card_wishlist;
CREATE POLICY "Anyone sees wishlists" ON public.card_wishlist FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own wishlist" ON public.card_wishlist;
CREATE POLICY "Users manage own wishlist" ON public.card_wishlist FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ CARD_DECKS ============
CREATE TABLE IF NOT EXISTS public.card_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 60),
  description TEXT CHECK (char_length(description) <= 300),
  card_ids UUID[] NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_trade_deck BOOLEAN NOT NULL DEFAULT false,
  likes INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decks_user ON public.card_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_decks_public ON public.card_decks(is_public, created_at DESC);
ALTER TABLE public.card_decks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees public decks" ON public.card_decks;
CREATE POLICY "Anyone sees public decks" ON public.card_decks FOR SELECT USING (is_public = true OR user_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own decks" ON public.card_decks;
CREATE POLICY "Users manage own decks" ON public.card_decks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ CARD_DECK_LIKES ============
CREATE TABLE IF NOT EXISTS public.card_deck_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES public.card_decks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deck_id)
);
ALTER TABLE public.card_deck_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees deck likes" ON public.card_deck_likes;
CREATE POLICY "Anyone sees deck likes" ON public.card_deck_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own deck likes" ON public.card_deck_likes;
CREATE POLICY "Users manage own deck likes" ON public.card_deck_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ CARD_OPERATIONS ============
CREATE TABLE IF NOT EXISTS public.card_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('smelt','split','frame_upgrade','animate')),
  input_card_ids UUID[] NOT NULL DEFAULT '{}',
  output_card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  ink_spent INTEGER NOT NULL DEFAULT 0,
  shards_spent JSONB NOT NULL DEFAULT '{}'::jsonb,
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.card_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own operations" ON public.card_operations;
CREATE POLICY "Users see own operations" ON public.card_operations FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users create operations" ON public.card_operations;
CREATE POLICY "Users create operations" ON public.card_operations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ PACK_OPENINGS ============
CREATE TABLE IF NOT EXISTS public.pack_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cards_shown UUID[] NOT NULL DEFAULT '{}',
  card_chosen UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  ink_spent INTEGER NOT NULL DEFAULT 55,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pack_openings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own openings" ON public.pack_openings;
CREATE POLICY "Users see own openings" ON public.pack_openings FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users create openings" ON public.pack_openings;
CREATE POLICY "Users create openings" ON public.pack_openings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own openings" ON public.pack_openings;
CREATE POLICY "Users update own openings" ON public.pack_openings FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============ DAILY_INK_LOG ============
CREATE TABLE IF NOT EXISTS public.daily_ink_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL CHECK (source IN ('login','read','comment','translate','publish_bonus','streak_bonus')),
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ink_log_user_date ON public.daily_ink_log(user_id, date, source);
ALTER TABLE public.daily_ink_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own ink log" ON public.daily_ink_log;
CREATE POLICY "Users see own ink log" ON public.daily_ink_log FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own ink log" ON public.daily_ink_log;
CREATE POLICY "Users insert own ink log" ON public.daily_ink_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ CARD_COMMENTS ============
CREATE TABLE IF NOT EXISTS public.card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_comments_card ON public.card_comments(card_id, created_at DESC);
ALTER TABLE public.card_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees card comments" ON public.card_comments;
CREATE POLICY "Anyone sees card comments" ON public.card_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated comment on cards" ON public.card_comments;
CREATE POLICY "Authenticated comment on cards" ON public.card_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own card comments" ON public.card_comments;
CREATE POLICY "Users delete own card comments" ON public.card_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ SHOWCASE_CARDS ============
CREATE TABLE IF NOT EXISTS public.showcase_cards (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1 AND position <= 10),
  user_card_id UUID REFERENCES public.user_cards(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, position)
);
ALTER TABLE public.showcase_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees showcase" ON public.showcase_cards;
CREATE POLICY "Anyone sees showcase" ON public.showcase_cards FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own showcase" ON public.showcase_cards;
CREATE POLICY "Users manage own showcase" ON public.showcase_cards FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ READING_CARD_DROPS ============
CREATE TABLE IF NOT EXISTS public.reading_card_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
  dropped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drops_user ON public.reading_card_drops(user_id, dropped_at DESC);
ALTER TABLE public.reading_card_drops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own drops" ON public.reading_card_drops;
CREATE POLICY "Users see own drops" ON public.reading_card_drops FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own drops" ON public.reading_card_drops;
CREATE POLICY "Users insert own drops" ON public.reading_card_drops FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
ALTER TABLE public.reading_card_drops REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='reading_card_drops') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_card_drops';
  END IF;
END $$;

-- ============ CARD_IMAGE_SUGGESTIONS ============
CREATE TABLE IF NOT EXISTS public.card_image_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.card_image_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users submit suggestions" ON public.card_image_suggestions;
CREATE POLICY "Users submit suggestions" ON public.card_image_suggestions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users see own suggestions" ON public.card_image_suggestions;
CREATE POLICY "Users see own suggestions" ON public.card_image_suggestions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));
DROP POLICY IF EXISTS "Admins manage suggestions" ON public.card_image_suggestions;
CREATE POLICY "Admins manage suggestions" ON public.card_image_suggestions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Card images public read" ON storage.objects;
CREATE POLICY "Card images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'card-images');

DROP POLICY IF EXISTS "Users upload own card images" ON storage.objects;
CREATE POLICY "Users upload own card images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'card-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own card images" ON storage.objects;
CREATE POLICY "Users update own card images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'card-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own card images" ON storage.objects;
CREATE POLICY "Users delete own card images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'card-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Admins manage card images" ON storage.objects;
CREATE POLICY "Admins manage card images" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'card-images' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role)))
  WITH CHECK (bucket_id = 'card-images' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role)));

-- ============ RPC: award_ink ============
CREATE OR REPLACE FUNCTION public.award_ink(_amount INTEGER, _source TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _new_balance INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.user_profiles
    SET ink_balance = ink_balance + _amount
    WHERE id = _uid
    RETURNING ink_balance INTO _new_balance;

  INSERT INTO public.daily_ink_log (user_id, source, amount)
    VALUES (_uid, _source, _amount);

  RETURN _new_balance;
END;
$$;

-- ============ RPC: open_pack (basic working stub) ============
CREATE OR REPLACE FUNCTION public.open_pack()
RETURNS TABLE (opening_id UUID, card_ids UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _balance INTEGER;
  _s_pity INTEGER;
  _x_pity INTEGER;
  _picks UUID[] := '{}';
  _pick UUID;
  _force_rank TEXT := NULL;
  _ranks TEXT[] := ARRAY['X','S','A','P','G','B','C','D','E'];
  _r TEXT;
  _i INTEGER;
  _roll NUMERIC;
  _opening_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT ink_balance, s_pity_counter, x_pity_counter
    INTO _balance, _s_pity, _x_pity
    FROM public.user_profiles WHERE id = _uid FOR UPDATE;

  IF _balance < 55 THEN RAISE EXCEPTION 'Not enough Ink'; END IF;

  -- Pity check
  IF _x_pity + 1 >= 150 THEN _force_rank := 'X';
  ELSIF _s_pity + 1 >= 50 THEN _force_rank := 'S';
  END IF;

  -- Pick 3 cards
  FOR _i IN 1..3 LOOP
    IF _i = 1 AND _force_rank IS NOT NULL THEN
      _r := _force_rank;
    ELSE
      _roll := random();
      IF _roll < 0.01 THEN _r := 'X';
      ELSIF _roll < 0.05 THEN _r := 'S';
      ELSIF _roll < 0.20 THEN _r := (ARRAY['P','A'])[1 + floor(random()*2)::int];
      ELSIF _roll < 0.55 THEN _r := (ARRAY['C','B','G'])[1 + floor(random()*3)::int];
      ELSE _r := (ARRAY['D','E'])[1 + floor(random()*2)::int];
      END IF;
    END IF;

    SELECT id INTO _pick FROM public.cards
      WHERE is_approved = true AND rank = _r
      ORDER BY random() LIMIT 1;

    -- Fallback if no card of that rank exists
    IF _pick IS NULL THEN
      SELECT id INTO _pick FROM public.cards WHERE is_approved = true ORDER BY random() LIMIT 1;
    END IF;

    _picks := _picks || _pick;
  END LOOP;

  -- Deduct + update counters
  UPDATE public.user_profiles
    SET ink_balance = ink_balance - 55,
        pack_counter = pack_counter + 1,
        s_pity_counter = CASE WHEN _force_rank = 'S' OR _force_rank = 'X' THEN 0 ELSE s_pity_counter + 1 END,
        x_pity_counter = CASE WHEN _force_rank = 'X' THEN 0 ELSE x_pity_counter + 1 END
    WHERE id = _uid;

  INSERT INTO public.pack_openings (user_id, cards_shown, ink_spent)
    VALUES (_uid, _picks, 55) RETURNING id INTO _opening_id;

  RETURN QUERY SELECT _opening_id, _picks;
END;
$$;

-- ============ RPC: pack_select_card ============
CREATE OR REPLACE FUNCTION public.pack_select_card(_opening_id UUID, _card_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _shown UUID[];
  _existing INTEGER;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT cards_shown INTO _shown FROM public.pack_openings
    WHERE id = _opening_id AND user_id = _uid AND card_chosen IS NULL FOR UPDATE;
  IF _shown IS NULL THEN RAISE EXCEPTION 'Invalid pack opening'; END IF;
  IF NOT (_card_id = ANY(_shown)) THEN RAISE EXCEPTION 'Card not in pack'; END IF;

  UPDATE public.pack_openings SET card_chosen = _card_id WHERE id = _opening_id;

  INSERT INTO public.user_cards (user_id, card_id, quantity)
    VALUES (_uid, _card_id, 1)
    ON CONFLICT (user_id, card_id)
    DO UPDATE SET quantity = public.user_cards.quantity + 1;
END;
$$;

-- ============ RPC: accept_trade (basic working stub) ============
CREATE OR REPLACE FUNCTION public.accept_trade(_trade_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _trade RECORD;
  _entry JSONB;
  _cid UUID;
  _qty INTEGER;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _trade FROM public.card_trades WHERE id = _trade_id FOR UPDATE;
  IF _trade IS NULL THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF _trade.receiver_id <> _uid THEN RAISE EXCEPTION 'Only receiver can accept'; END IF;
  IF _trade.status <> 'pending' THEN RAISE EXCEPTION 'Trade not pending'; END IF;

  -- sender_cards: array of {card_id, quantity}; verify sender owns and deduct
  FOR _entry IN SELECT * FROM jsonb_array_elements(_trade.sender_cards) LOOP
    _cid := (_entry->>'card_id')::UUID;
    _qty := COALESCE((_entry->>'quantity')::INTEGER, 1);
    UPDATE public.user_cards SET quantity = quantity - _qty
      WHERE user_id = _trade.sender_id AND card_id = _cid AND quantity >= _qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sender no longer owns required cards'; END IF;
    INSERT INTO public.user_cards (user_id, card_id, quantity)
      VALUES (_trade.receiver_id, _cid, _qty)
      ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = public.user_cards.quantity + _qty;
  END LOOP;

  -- receiver_cards: receiver gives, sender gets
  FOR _entry IN SELECT * FROM jsonb_array_elements(_trade.receiver_cards) LOOP
    _cid := (_entry->>'card_id')::UUID;
    _qty := COALESCE((_entry->>'quantity')::INTEGER, 1);
    UPDATE public.user_cards SET quantity = quantity - _qty
      WHERE user_id = _trade.receiver_id AND card_id = _cid AND quantity >= _qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'You no longer own required cards'; END IF;
    INSERT INTO public.user_cards (user_id, card_id, quantity)
      VALUES (_trade.sender_id, _cid, _qty)
      ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = public.user_cards.quantity + _qty;
  END LOOP;

  -- Clean up zero-quantity rows
  DELETE FROM public.user_cards WHERE quantity = 0;

  UPDATE public.card_trades SET status = 'accepted', updated_at = now() WHERE id = _trade_id;
END;
$$;

-- ============ SEED ============
INSERT INTO public.cards (name, character_name, rank, image_url, is_approved, tags) VALUES
  ('Sung Jin-Woo', 'Sung Jin-Woo', 'X', 'https://picsum.photos/seed/card1/300/420', true, ARRAY['male','hunter','dark']),
  ('Cha Hae-In', 'Cha Hae-In', 'S', 'https://picsum.photos/seed/card2/300/420', true, ARRAY['female','hunter']),
  ('Go Gun-Hee', 'Go Gun-Hee', 'A', 'https://picsum.photos/seed/card3/300/420', true, ARRAY['male','guild']),
  ('Igris', 'Igris', 'P', 'https://picsum.photos/seed/card4/300/420', true, ARRAY['shadow','knight']),
  ('Beru', 'Beru', 'G', 'https://picsum.photos/seed/card5/300/420', true, ARRAY['shadow','ant']),
  ('Thomas Andre', 'Thomas Andre', 'B', 'https://picsum.photos/seed/card6/300/420', true, ARRAY['male','hunter']),
  ('Liu Zhigang', 'Liu Zhigang', 'C', 'https://picsum.photos/seed/card7/300/420', true, ARRAY['male']),
  ('Yoo Jin-Ho', 'Yoo Jin-Ho', 'D', 'https://picsum.photos/seed/card8/300/420', true, ARRAY['male','friend']),
  ('Monarch of Destruction', 'Antares', 'S', 'https://picsum.photos/seed/card9/300/420', true, ARRAY['boss','demon']),
  ('Shadow Monarch', 'Ashborn', 'X', 'https://picsum.photos/seed/card10/300/420', true, ARRAY['shadow','monarch'])
ON CONFLICT DO NOTHING;
