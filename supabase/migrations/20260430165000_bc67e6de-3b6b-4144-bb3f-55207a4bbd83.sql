-- smelt_cards: take 3 user_cards of the same rank → produce 1 random card of next-higher rank
-- Rank order per user spec: G < F < E < D < C < B < A < S < X
-- For X and S, the upgrade returns a card of the same rank (X stays X, S stays S? user wants X→X for top).
-- User spec said: "E→D→C→B→G→F→A→S→X→X for X/S which stay same rank" — interpreted as: top ranks (S, X) stay same.
-- But for normal upgrade chain we follow the global rank order in CARD_RANKS: G→F→E→D→C→B→A→S→X
-- So next_rank: G→F, F→E, E→D, D→C, C→B, B→A, A→S, S→X, X→X.

CREATE OR REPLACE FUNCTION public.smelt_cards(_user_card_ids uuid[])
 RETURNS TABLE(output_card_id uuid, output_rank text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid UUID := auth.uid();
  _ranks TEXT[];
  _rank TEXT;
  _next TEXT;
  _picked UUID;
  _uc_id UUID;
  _operation_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF array_length(_user_card_ids, 1) <> 3 THEN RAISE EXCEPTION 'Must provide exactly 3 user_card ids'; END IF;

  -- Fetch the ranks of the 3 user_cards (must belong to caller)
  SELECT array_agg(c.rank) INTO _ranks
  FROM public.user_cards uc
  JOIN public.cards c ON c.id = uc.card_id
  WHERE uc.id = ANY(_user_card_ids) AND uc.user_id = _uid AND uc.quantity > 0;

  IF _ranks IS NULL OR array_length(_ranks, 1) <> 3 THEN
    RAISE EXCEPTION 'You must own all 3 selected cards';
  END IF;

  -- All same rank?
  IF NOT (_ranks[1] = _ranks[2] AND _ranks[2] = _ranks[3]) THEN
    RAISE EXCEPTION 'All 3 cards must be the same rank';
  END IF;

  _rank := _ranks[1];
  _next := CASE _rank
    WHEN 'G' THEN 'F'
    WHEN 'F' THEN 'E'
    WHEN 'E' THEN 'D'
    WHEN 'D' THEN 'C'
    WHEN 'C' THEN 'B'
    WHEN 'B' THEN 'A'
    WHEN 'A' THEN 'S'
    WHEN 'S' THEN 'X'
    WHEN 'X' THEN 'X'
    ELSE NULL
  END;
  IF _next IS NULL THEN RAISE EXCEPTION 'Cannot upgrade rank %', _rank; END IF;

  -- Decrement / delete each user_card row
  FOREACH _uc_id IN ARRAY _user_card_ids LOOP
    UPDATE public.user_cards SET quantity = quantity - 1 WHERE id = _uc_id AND user_id = _uid;
  END LOOP;
  DELETE FROM public.user_cards WHERE user_id = _uid AND quantity <= 0;

  -- Pick a random approved card of the next rank
  SELECT id INTO _picked FROM public.cards
    WHERE is_approved = true AND rank = _next
    ORDER BY random() LIMIT 1;
  IF _picked IS NULL THEN
    -- fallback: any approved card
    SELECT id INTO _picked FROM public.cards WHERE is_approved = true ORDER BY random() LIMIT 1;
  END IF;
  IF _picked IS NULL THEN RAISE EXCEPTION 'No cards available to grant'; END IF;

  -- Add to user_cards
  INSERT INTO public.user_cards (user_id, card_id, quantity)
    VALUES (_uid, _picked, 1)
    ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = public.user_cards.quantity + 1;

  -- Log operation
  INSERT INTO public.card_operations (user_id, type, input_card_ids, output_card_id, result)
    VALUES (_uid, 'smelt', _user_card_ids, _picked, _next)
    RETURNING id INTO _operation_id;

  RETURN QUERY SELECT _picked, _next;
END;
$function$;