ALTER TABLE public.daily_ink_log DROP CONSTRAINT IF EXISTS daily_ink_log_source_check;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='card_decks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.card_decks;
  END IF;
END $$;

ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.card_decks REPLICA IDENTITY FULL;