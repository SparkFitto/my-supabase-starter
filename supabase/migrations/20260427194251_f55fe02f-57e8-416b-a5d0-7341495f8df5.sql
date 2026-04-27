
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
