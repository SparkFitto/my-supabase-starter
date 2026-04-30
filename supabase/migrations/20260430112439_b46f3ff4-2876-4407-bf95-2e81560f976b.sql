
-- Lock down RPC execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.award_ink(INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.open_pack() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pack_select_card(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_trade(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.award_ink(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_pack() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pack_select_card(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_trade(UUID) TO authenticated;

-- Tighten card-images bucket: allow reading individual objects but not listing
DROP POLICY IF EXISTS "Card images public read" ON storage.objects;
CREATE POLICY "Card images public object read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'card-images' AND (storage.foldername(name))[1] IS NOT NULL);
