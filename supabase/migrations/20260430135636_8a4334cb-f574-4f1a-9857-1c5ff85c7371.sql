-- Step 0: Replace the rank CHECK constraint to allow 'F' (and the new full set)
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_rank_check;
ALTER TABLE public.cards
  ADD CONSTRAINT cards_rank_check
  CHECK (rank IN ('X','S','A','B','C','D','E','F','G','P'));

-- 1) Rename rank 'P' to 'F'
UPDATE public.cards SET rank = 'F' WHERE rank = 'P';

-- Now drop 'P' from the allowed set
ALTER TABLE public.cards DROP CONSTRAINT cards_rank_check;
ALTER TABLE public.cards
  ADD CONSTRAINT cards_rank_check
  CHECK (rank IN ('X','S','A','B','C','D','E','F','G'));

-- 2) Migrate shard_balance jsonb (rename P -> F)
UPDATE public.user_profiles
SET shard_balance = (shard_balance - 'P') || jsonb_build_object('F', COALESCE(shard_balance->'P', '0'::jsonb))
WHERE shard_balance ? 'P';

UPDATE public.user_profiles
SET shard_balance = COALESCE(shard_balance, '{}'::jsonb)
  || jsonb_build_object(
    'X', COALESCE(shard_balance->'X','0'::jsonb),
    'S', COALESCE(shard_balance->'S','0'::jsonb),
    'A', COALESCE(shard_balance->'A','0'::jsonb),
    'B', COALESCE(shard_balance->'B','0'::jsonb),
    'C', COALESCE(shard_balance->'C','0'::jsonb),
    'D', COALESCE(shard_balance->'D','0'::jsonb),
    'E', COALESCE(shard_balance->'E','0'::jsonb),
    'F', COALESCE(shard_balance->'F','0'::jsonb),
    'G', COALESCE(shard_balance->'G','0'::jsonb)
  );

ALTER TABLE public.user_profiles
  ALTER COLUMN shard_balance SET DEFAULT '{"X":0,"S":0,"A":0,"B":0,"C":0,"D":0,"E":0,"F":0,"G":0}'::jsonb;

-- 3) Update price_rank values in marketplace
UPDATE public.card_lots SET price_rank = 'F' WHERE price_rank = 'P';
UPDATE public.card_requests SET offer_rank = 'F' WHERE offer_rank = 'P';

-- 4) Update single-pack RPC for new rank weights
CREATE OR REPLACE FUNCTION public.open_pack()
RETURNS TABLE(opening_id uuid, card_ids uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _balance INTEGER; _s_pity INTEGER; _x_pity INTEGER;
  _picks UUID[] := '{}'; _pick UUID; _force_rank TEXT := NULL;
  _r TEXT; _i INTEGER; _roll NUMERIC; _opening_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT ink_balance, s_pity_counter, x_pity_counter INTO _balance, _s_pity, _x_pity
    FROM public.user_profiles WHERE id = _uid FOR UPDATE;
  IF _balance < 55 THEN RAISE EXCEPTION 'Not enough Ink'; END IF;
  IF _x_pity + 1 >= 150 THEN _force_rank := 'X';
  ELSIF _s_pity + 1 >= 50 THEN _force_rank := 'S';
  END IF;
  FOR _i IN 1..3 LOOP
    IF _i = 1 AND _force_rank IS NOT NULL THEN _r := _force_rank;
    ELSE
      _roll := random();
      IF _roll < 0.01 THEN _r := 'X';
      ELSIF _roll < 0.05 THEN _r := 'S';
      ELSIF _roll < 0.20 THEN _r := 'A';
      ELSIF _roll < 0.40 THEN _r := (ARRAY['B','C'])[1 + floor(random()*2)::int];
      ELSIF _roll < 0.70 THEN _r := (ARRAY['D','E'])[1 + floor(random()*2)::int];
      ELSE _r := (ARRAY['F','G'])[1 + floor(random()*2)::int];
      END IF;
    END IF;
    SELECT id INTO _pick FROM public.cards WHERE is_approved = true AND rank = _r ORDER BY random() LIMIT 1;
    IF _pick IS NULL THEN
      SELECT id INTO _pick FROM public.cards WHERE is_approved = true ORDER BY random() LIMIT 1;
    END IF;
    _picks := _picks || _pick;
  END LOOP;
  UPDATE public.user_profiles
    SET ink_balance = ink_balance - 55,
        pack_counter = pack_counter + 1,
        s_pity_counter = CASE WHEN _force_rank IN ('S','X') THEN 0 ELSE s_pity_counter + 1 END,
        x_pity_counter = CASE WHEN _force_rank = 'X' THEN 0 ELSE x_pity_counter + 1 END
    WHERE id = _uid;
  INSERT INTO public.pack_openings (user_id, cards_shown, ink_spent)
    VALUES (_uid, _picks, 55) RETURNING id INTO _opening_id;
  RETURN QUERY SELECT _opening_id, _picks;
END; $$;

-- 5) New 10x pack RPC: 500 Ink, 10 columns × 3 cards
CREATE OR REPLACE FUNCTION public.open_pack_10()
RETURNS TABLE(opening_ids uuid[], columns jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _balance INTEGER; _s_pity INTEGER; _x_pity INTEGER;
  _opening_ids UUID[] := '{}'; _columns JSONB := '[]'::jsonb;
  _col_picks UUID[]; _pick UUID; _force_rank TEXT;
  _r TEXT; _i INTEGER; _j INTEGER; _roll NUMERIC; _opening_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT ink_balance, s_pity_counter, x_pity_counter INTO _balance, _s_pity, _x_pity
    FROM public.user_profiles WHERE id = _uid FOR UPDATE;
  IF _balance < 500 THEN RAISE EXCEPTION 'Not enough Ink (need 500)'; END IF;
  FOR _i IN 1..10 LOOP
    _col_picks := '{}'; _force_rank := NULL;
    IF _x_pity + 1 >= 150 THEN _force_rank := 'X';
    ELSIF _s_pity + 1 >= 50 THEN _force_rank := 'S';
    END IF;
    FOR _j IN 1..3 LOOP
      IF _j = 1 AND _force_rank IS NOT NULL THEN _r := _force_rank;
      ELSE
        _roll := random();
        IF _roll < 0.01 THEN _r := 'X';
        ELSIF _roll < 0.05 THEN _r := 'S';
        ELSIF _roll < 0.20 THEN _r := 'A';
        ELSIF _roll < 0.40 THEN _r := (ARRAY['B','C'])[1 + floor(random()*2)::int];
        ELSIF _roll < 0.70 THEN _r := (ARRAY['D','E'])[1 + floor(random()*2)::int];
        ELSE _r := (ARRAY['F','G'])[1 + floor(random()*2)::int];
        END IF;
      END IF;
      SELECT id INTO _pick FROM public.cards WHERE is_approved = true AND rank = _r ORDER BY random() LIMIT 1;
      IF _pick IS NULL THEN
        SELECT id INTO _pick FROM public.cards WHERE is_approved = true ORDER BY random() LIMIT 1;
      END IF;
      _col_picks := _col_picks || _pick;
    END LOOP;
    IF _force_rank = 'X' THEN _x_pity := 0; _s_pity := 0;
    ELSIF _force_rank = 'S' THEN _s_pity := 0; _x_pity := _x_pity + 1;
    ELSE _s_pity := _s_pity + 1; _x_pity := _x_pity + 1;
    END IF;
    INSERT INTO public.pack_openings (user_id, cards_shown, ink_spent)
      VALUES (_uid, _col_picks, 50) RETURNING id INTO _opening_id;
    _opening_ids := _opening_ids || _opening_id;
    _columns := _columns || jsonb_build_array(jsonb_build_object('opening_id', _opening_id, 'cards', to_jsonb(_col_picks)));
  END LOOP;
  UPDATE public.user_profiles
    SET ink_balance = ink_balance - 500,
        pack_counter = pack_counter + 10,
        s_pity_counter = _s_pity,
        x_pity_counter = _x_pity
    WHERE id = _uid;
  RETURN QUERY SELECT _opening_ids, _columns;
END; $$;

-- 6) Recent picks function for live ticker
CREATE OR REPLACE FUNCTION public.recent_pack_picks(_limit integer DEFAULT 5)
RETURNS TABLE(
  opening_id uuid, card_id uuid, character_name text, rank text, image_url text,
  username text, avatar_url text, opened_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT po.id, po.card_chosen, c.character_name, c.rank, c.image_url,
         up.username, up.avatar_url, po.opened_at
  FROM public.pack_openings po
  JOIN public.cards c ON c.id = po.card_chosen
  LEFT JOIN public.user_profiles up ON up.id = po.user_id
  WHERE po.card_chosen IS NOT NULL
  ORDER BY po.opened_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 50));
$$;

-- Realtime publication for ticker
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pack_openings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;