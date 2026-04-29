-- Ensure realtime delivery for comments and votes
ALTER TABLE public.series_comments REPLICA IDENTITY FULL;
ALTER TABLE public.comment_votes REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.series_comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_votes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;