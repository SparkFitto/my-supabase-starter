## RAWL — Phase 1 + 2 Build Plan

A dark-themed manga/manhwa/manhua translation platform. Users upload raw chapters, get AI translations, share them with readers, and discover series. Built on **Lovable Cloud** (handles DB, auth, storage, edge functions, realtime — no manual Supabase setup).

---

### Design system (locked in from blueprint)
- Dark theme only. BG `#0d0d10`, cards `#16161e`, teal accent `#4ECDC4`, purple `#9b59b6`, status colors (green/amber/red/gray).
- DM Mono headers + logo, Inter body. 12px card radius. Mobile-first.
- Status badge pills (New / Translated / Pending / None).

---

### Database (Lovable Cloud — I create it all)
Tables exactly as the blueprint specifies, with **Row-Level Security** policies:
- `series`, `chapters`, `translations`, `jobs`, `user_profiles`, `favorites`, `series_glossary`
- Plus `series_alt_titles` (TEXT[] on series) for SEO multi-title indexing
- Plus a `user_roles` table + `has_role()` security-definer function for admin access (glossary approvals)
- Trigger to auto-create `user_profiles` row on signup
- Storage buckets: `raw-uploads` (private), `translated-images` (public)
- RLS: anyone reads published translations & series; users only modify their own jobs/favorites/profile

I'll seed ~10 demo series (Solo Leveling, Pick Me Up, One Piece, Jujutsu Kaisen, etc.) with cover URLs, alt titles, and a few sample chapters so the UI has real content to render immediately.

---

### Auth
- Email + password sign-up / sign-in
- Google OAuth (you enable the Google provider in Cloud → Users settings — I'll show you the one screen to click)
- `/signup`, `/signin`, `/reset-password` pages
- Username uniqueness check against `user_profiles`
- Auth-protected routes via TanStack `_authenticated` layout

---

### Pages (all 8 from blueprint + Catalogue)

1. **Homepage `/`** — sticky header, hero, big upload dropzone, FROM/TO language selectors, series search, "Just Released" + "Most Popular Ongoing" sections.
2. **Billboard `/billboard`** — release feed, type/time/language filter pills, dense list rows, paginated.
3. **Chapter Translate `/translate/[series]/[chapter]/[lang]`** — SEO-critical. Conditional UI: read-now / in-progress / upload-flow. Dynamic meta tags + JSON-LD ComicStory + hreflang.
4. **Series `/series/[slug]`** — hero with blurred cover, alt titles, genres, Description + Chapters tabs, favorite toggle, glossary section. Auto-hide header on scroll.
5. **Reader `/read/[translation-id]`** — long-strip vs page mode (auto from series.type), keyboard nav, page counter, completion card with upvote/report, attribution bar.
6. **Catalogue `/catalogue`** — your custom design: cover-image grid (3 col mobile / 4–5 desktop), rating badge bottom-left, status badge top-left, view toggle (grid / dense), sort dropdown (Popular/New/Rating/Updated), slide-in filter panel from right with Genre/Type/Tags/Status/Age/Rating/Year/Chapter-count + Exclude section. Instant filtering, no reload.
7. **Profile `/profile`** — usage card with weekly quota, tabs: My Translations / My Favorites / Settings.
8. **Pricing `/pricing`** — 4 tiers (Free / Pro $4 / Team $29 / Agency $99). All CTAs "Coming soon" (Paddle later — UI only).
9. **Auth pages** as above.

---

### Upload + simulated translation flow
- Drop file → validate (JPG/PNG/ZIP/CBZ/PDF) → show filename/size
- On Translate: auth check → quota check → upload to `raw-uploads` storage → insert `jobs` row
- **Edge Function `simulate-translation`**: I build this. Takes a job_id, steps through Queued → Extracting → Translating → Rendering → Done over ~8s, updates `jobs.progress` + `current_step`, then creates a `translations` row with picsum placeholder image URLs. This makes the full UI testable today; later you swap it to call your Railway backend with no frontend changes.
- Frontend subscribes via **Supabase Realtime** on the jobs row for live progress
- After completion: reader opens + "Publish?" modal with conflict handling per blueprint

---

### SEO strategy (the part you specifically asked for)
- **Canonical URL pattern**: `/translate/[slug]/chapter-[n]/[lang]` (and `/read/[translation-id]` for the actual reader)
- **Alternate URL patterns** that 301-redirect to canonical:
  - `/translate/[slug]/[n]/[lang]`
  - `/[slug]-chapter-[n]-[lang]-translation`
  - `/translate/[slug]/[n]/en` (short codes)
  - Implemented as TanStack server routes that issue 301s
- **Per-page dynamic head**: title, description, og:title, og:description, og:image (chapter cover), twitter card — all derived from loader data
- **JSON-LD ComicStory + ComicSeries** structured data on every chapter page (translationOfWork with source language)
- **hreflang tags** linking all available language versions of the same chapter
- **Alt-titles in page body**: every chapter page renders the natural keyword-rich paragraph you described ("Solo Leveling Chapter 266 — English Translation… Also available: Spanish · French… Series: Solo Leveling (나 혼자만 레벨업) · Korean Manhwa")
- **Auto-generated `/sitemap.xml`** server route — queries DB at request time, lists every series + chapter + language combination
- **`/robots.txt`** server route pointing to sitemap

---

### Behaviors
- Search bar full-text searches `series.title` + `series_alt_titles` with dropdown results
- Favorites toggle with optimistic UI
- Continue Reading (localStorage for guests, profile for logged-in)
- Header auto-hide on scroll for reader + series pages
- Glossary display on series page + suggestion form (admin approval)
- **Anti-abuse stubs**: device fingerprint generated client-side and sent with each job; IP rate-limit error UI ready (enforcement happens server-side later)
- Lazy-loaded images, skeletons everywhere
- Reading mode persisted in localStorage; auto-default by series.type

---

### Phase 3 deferred to a second pass (after you review)
- Notifications bell + email alert preferences
- Glossary admin approval UI
- Real Paddle integration (you do that manually anyway)
- "Novels" greyed-out nav item (I'll add this now actually — it's tiny)

---

### What you'll need to do manually after I'm done
Only these — everything else I handle:

1. **Enable Google OAuth provider** in Cloud → Users → Auth Settings (paste Google client ID + secret from Google Cloud Console). I'll give you the exact 3-click path.
2. **Later, when your Python backend on Railway is ready**: tell me, and I'll swap the `simulate-translation` edge function to call your Railway URL instead. ~5 min change.
3. **Later, Paddle**: you wire up payment webhooks when you're ready.

That's it. No SQL, no schema migrations, no storage bucket setup, no RLS policies — I do all of it.

---

### Build order (one push)
Auth → DB schema + seed → Homepage + upload dropzone → Edge function + realtime progress → Reader + publish modal → Profile → Billboard → Series page → Chapter translate page (with full SEO) → Catalogue with filters → Pricing → Sitemap/robots/redirects → Final QA pass.

Approve and I'll start. After it's running, you test the flow, then we do Phase 3 polish.