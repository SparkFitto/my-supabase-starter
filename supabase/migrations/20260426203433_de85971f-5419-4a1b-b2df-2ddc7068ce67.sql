
-- ============ ENUMS / ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users see their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ SERIES ============
CREATE TABLE public.series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  alt_titles TEXT[] DEFAULT '{}',
  cover_url TEXT,
  source_language TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manhwa',
  status TEXT NOT NULL DEFAULT 'ongoing',
  follow_count INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,1),
  release_year INTEGER,
  age_rating TEXT,
  mangadex_id TEXT,
  description TEXT,
  genres TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Series are public" ON public.series FOR SELECT USING (true);
CREATE POLICY "Admins manage series" ON public.series FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_series_slug ON public.series(slug);
CREATE INDEX idx_series_type ON public.series(type);
CREATE INDEX idx_series_status ON public.series(status);

-- ============ CHAPTERS ============
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  chapter_number TEXT NOT NULL,
  volume_number TEXT,
  release_date TIMESTAMPTZ,
  mangadex_chapter_id TEXT UNIQUE,
  raw_download_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (series_id, chapter_number)
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chapters are public" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "Admins manage chapters" ON public.chapters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_chapters_series ON public.chapters(series_id);
CREATE INDEX idx_chapters_release ON public.chapters(release_date DESC);

-- ============ TRANSLATIONS ============
CREATE TABLE public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'none',
  translated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  translator_username TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  upvotes INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  image_urls TEXT[] DEFAULT '{}',
  page_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, target_language, translated_by)
);
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published translations are public" ON public.translations FOR SELECT USING (published = TRUE);
CREATE POLICY "Users see their own translations" ON public.translations FOR SELECT TO authenticated USING (translated_by = auth.uid());
CREATE POLICY "Users insert own translations" ON public.translations FOR INSERT TO authenticated WITH CHECK (translated_by = auth.uid());
CREATE POLICY "Users update own translations" ON public.translations FOR UPDATE TO authenticated USING (translated_by = auth.uid());
CREATE INDEX idx_translations_chapter ON public.translations(chapter_id);
CREATE INDEX idx_translations_lang ON public.translations(target_language);

-- ============ JOBS ============
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL,
  source_language TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  current_step TEXT NOT NULL DEFAULT 'Queued',
  error_message TEXT,
  result_translation_id UUID REFERENCES public.translations(id) ON DELETE SET NULL,
  raw_file_url TEXT,
  device_id TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own jobs" ON public.jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_jobs_user ON public.jobs(user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER TABLE public.jobs REPLICA IDENTITY FULL;

-- ============ USER PROFILES ============
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  weekly_chapters_used INTEGER NOT NULL DEFAULT 0,
  weekly_reset_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  paddle_customer_id TEXT,
  chapters_translated_total INTEGER NOT NULL DEFAULT 0,
  preferred_target_language TEXT DEFAULT 'en',
  preferred_reading_mode TEXT DEFAULT 'long_strip',
  notify_on_release BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are public-readable" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ FAVORITES ============
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  notify_on_release BOOLEAN NOT NULL DEFAULT TRUE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, series_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own favorites" ON public.favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users add own favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users remove own favorites" ON public.favorites FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own favorites" ON public.favorites FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============ GLOSSARY ============
CREATE TABLE public.series_glossary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  original_term TEXT NOT NULL,
  translated_term TEXT NOT NULL,
  target_language TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  suggested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (series_id, original_term, target_language)
);
ALTER TABLE public.series_glossary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved glossary is public" ON public.series_glossary FOR SELECT USING (approved = TRUE);
CREATE POLICY "Users see own glossary suggestions" ON public.series_glossary FOR SELECT TO authenticated USING (suggested_by = auth.uid());
CREATE POLICY "Users suggest glossary" ON public.series_glossary FOR INSERT TO authenticated WITH CHECK (suggested_by = auth.uid());
CREATE POLICY "Admins manage glossary" ON public.series_glossary FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('raw-uploads', 'raw-uploads', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('translated-images', 'translated-images', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Users upload own raw files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'raw-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own raw files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'raw-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Translated images are public" ON storage.objects FOR SELECT
  USING (bucket_id = 'translated-images');
CREATE POLICY "Authenticated upload translated images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'translated-images');
