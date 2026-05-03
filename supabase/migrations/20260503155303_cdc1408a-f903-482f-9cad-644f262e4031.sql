
-- ============ SHOP ITEMS ============
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('avatar','banner','frame','skin','status')),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  price_ink INTEGER NOT NULL CHECK (price_ink >= 0),
  original_price_ink INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_items_category ON public.shop_items(category, is_active, sort_order);
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees active shop items" ON public.shop_items FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins manage shop items" ON public.shop_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ USER PURCHASES ============
CREATE TABLE IF NOT EXISTS public.user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  ink_spent INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_equipped BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON public.user_purchases(user_id);
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own purchases" ON public.user_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users buy items" ON public.user_purchases FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users equip items" ON public.user_purchases FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============ INK PACKAGES ============
CREATE TABLE IF NOT EXISTS public.ink_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ink_amount INTEGER NOT NULL,
  price_usd NUMERIC(6,2) NOT NULL,
  bonus_percent INTEGER NOT NULL DEFAULT 0,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  first_purchase_bonus_percent INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.ink_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees active packages" ON public.ink_packages FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins manage packages" ON public.ink_packages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

INSERT INTO public.ink_packages (ink_amount, price_usd, bonus_percent, first_purchase_bonus_percent, is_popular, sort_order) VALUES
  (700, 0.99, 0, 100, false, 1),
  (2000, 2.49, 0, 100, true, 2),
  (4500, 4.99, 10, 0, false, 3),
  (10000, 9.99, 20, 0, false, 4),
  (22000, 19.99, 25, 0, false, 5),
  (60000, 49.99, 33, 0, false, 6);

-- ============ CONTRACTS ============
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_usd NUMERIC(6,2) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  total_ink INTEGER NOT NULL,
  daily_ink_bonus INTEGER NOT NULL DEFAULT 0,
  milestone_rewards JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees contracts" ON public.contracts FOR SELECT USING (true);
CREATE POLICY "Admins manage contracts" ON public.contracts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

INSERT INTO public.contracts (name, description, price_usd, duration_days, total_ink, daily_ink_bonus, milestone_rewards) VALUES
  ('Chronicler''s Pact', '30 days of daily Ink bonuses and guaranteed rare cards at milestones.', 3.99, 30, 5000, 166,
   '[{"day":7,"reward":"random_b_card"},{"day":14,"reward":"random_a_card"},{"day":21,"reward":"random_s_card"},{"day":28,"reward":"random_x_card"}]'::jsonb);

CREATE TABLE IF NOT EXISTS public.user_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  days_claimed INTEGER NOT NULL DEFAULT 0,
  milestones_claimed INTEGER[] NOT NULL DEFAULT '{}',
  total_ink_collected INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, contract_id)
);
ALTER TABLE public.user_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own contracts" ON public.user_contracts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own contracts" ON public.user_contracts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ PLATFORM SETTINGS ============
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins update settings" ON public.platform_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('pack_cost_ink', '55', 'Ink cost to open 1 pack'),
  ('pack_cost_ten_ink', '500', 'Ink cost to open 10 packs at once'),
  ('guild_create_cost', '1000', 'Ink cost to create a guild'),
  ('s_pity_threshold', '50', 'Packs opened until guaranteed S card'),
  ('x_pity_threshold', '150', 'Packs opened until guaranteed X card'),
  ('daily_login_ink', '20', 'Ink awarded on daily login (free)'),
  ('daily_login_ink_pro', '30', 'Ink awarded on daily login (PRO)'),
  ('read_ink_per_5pages', '5', 'Ink per 5 pages read'),
  ('read_ink_daily_max_times', '8', 'Max times reading Ink awards per day'),
  ('comment_ink', '6', 'Ink per comment posted'),
  ('comment_ink_daily_max', '5', 'Max comment Ink awards per day (free)'),
  ('comment_ink_daily_max_pro', '10', 'Max comment Ink awards per day (PRO)'),
  ('translate_ink', '15', 'Ink per published translation'),
  ('translate_ink_daily_max', '2', 'Max translation Ink awards per day'),
  ('lot_max_free', '5', 'Max active marketplace lots (free)'),
  ('lot_max_pro', '10', 'Max active marketplace lots (PRO)'),
  ('deck_free_slots', '50', 'Free card slots per deck (free)'),
  ('deck_free_slots_pro', '75', 'Free card slots per deck (PRO)'),
  ('split_free_daily_pro', '7', 'Free card splits per day (PRO)'),
  ('split_extra_cost', '10', 'Ink per extra split after daily limit'),
  ('wishlist_max_free', '100', 'Max wishlist items (free)'),
  ('wishlist_max_pro', '200', 'Max wishlist items (PRO)'),
  ('blocklist_max_free', '10', 'Max blocked users (free)'),
  ('blocklist_max_pro', '50', 'Max blocked users (PRO)'),
  ('free_translations_lifetime', '3', 'Lifetime free translations (free)'),
  ('free_translations_pro_monthly', '5', 'Monthly free translations (PRO)'),
  ('translation_cost_ink', '40', 'Ink cost per translation after free uses'),
  ('guild_war_duration_days', '7', 'Guild war duration in days'),
  ('guild_level_1_max_members', '30', 'Max guild members at level 1'),
  ('guild_level_2_max_members', '55', 'Max guild members at level 2'),
  ('guild_level_3_max_members', '80', 'Max guild members at level 3'),
  ('guild_level_4_max_members', '120', 'Max guild members at level 4'),
  ('guild_level_5_max_members', '155', 'Max guild members at level 5'),
  ('guild_level_6_max_members', '175', 'Max guild members at level 6'),
  ('guild_level_7_plus_max_members', '200', 'Max guild members at level 7+'),
  ('cards_system_enabled', 'true', 'Cards system enabled'),
  ('guild_system_enabled', 'true', 'Guild system enabled'),
  ('marketplace_enabled', 'true', 'Marketplace enabled'),
  ('shop_enabled', 'true', 'Shop enabled');

-- ============ WAITLISTS ============
CREATE TABLE IF NOT EXISTS public.payment_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID,
  package_id UUID,
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone joins waitlist" ON public.payment_waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read waitlist" ON public.payment_waitlist FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.contract_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID,
  contract_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone joins contract waitlist" ON public.contract_waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read contract waitlist" ON public.contract_waitlist FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- ============ HOMEPAGE FEATURED ============
CREATE TABLE IF NOT EXISTS public.homepage_featured (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL CHECK (section IN ('popular','new','featured')),
  series_id UUID NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_homepage_featured_section ON public.homepage_featured(section, sort_order);
ALTER TABLE public.homepage_featured ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads featured" ON public.homepage_featured FOR SELECT USING (true);
CREATE POLICY "Admins manage featured" ON public.homepage_featured FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- ============ USER PROFILE COLUMNS ============
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS equipped_avatar_item_id UUID,
  ADD COLUMN IF NOT EXISTS equipped_banner_item_id UUID,
  ADD COLUMN IF NOT EXISTS equipped_frame_item_id UUID,
  ADD COLUMN IF NOT EXISTS has_pro BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS show_pro_badge BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status_text TEXT,
  ADD COLUMN IF NOT EXISTS lifetime_free_translations_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_pro_translations_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pro_translations_reset_at DATE,
  ADD COLUMN IF NOT EXISTS monthly_spend_usd NUMERIC(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_ink_purchased INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_spend_reset_at DATE;

-- ============ SERIES TIER ============
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS tier INTEGER NOT NULL DEFAULT 1 CHECK (tier IN (1,2,3));

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-items','shop-items', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public reads shop items" ON storage.objects FOR SELECT USING (bucket_id = 'shop-items');
CREATE POLICY "Admins upload shop items" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shop-items' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins update shop items" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'shop-items' AND public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins delete shop items" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'shop-items' AND public.has_role(auth.uid(),'admin'::public.app_role));
