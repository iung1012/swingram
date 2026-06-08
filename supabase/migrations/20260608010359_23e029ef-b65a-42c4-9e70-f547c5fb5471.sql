
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'support', 'user');
CREATE TYPE public.profile_type AS ENUM ('single_m','single_f','single_nb','couple_mm','couple_ff','couple_mf');
CREATE TYPE public.moderation_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.couple_status AS ENUM ('pending','active','dissolved');
CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.interest_status AS ENUM ('pending','accepted','rejected');
CREATE TYPE public.message_status AS ENUM ('sent','moderated','removed');
CREATE TYPE public.report_target AS ENUM ('user','post','comment','message','chat');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','resolved','dismissed');
CREATE TYPE public.mod_item_type AS ENUM ('post','comment','message','verification');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  profile_type public.profile_type NOT NULL DEFAULT 'single_m',
  interests TEXT[] NOT NULL DEFAULT '{}',
  birth_date DATE NOT NULL,
  gender_seeking TEXT[] NOT NULL DEFAULT '{}',
  city TEXT,
  lat_snap DOUBLE PRECISION,
  lng_snap DOUBLE PRECISION,
  share_location BOOLEAN NOT NULL DEFAULT false,
  invisible_mode BOOLEAN NOT NULL DEFAULT false,
  nsfw_blur_default BOOLEAN NOT NULL DEFAULT true,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  trust_score INTEGER NOT NULL DEFAULT 0,
  banned BOOLEAN NOT NULL DEFAULT false,
  shadow_banned BOOLEAN NOT NULL DEFAULT false,
  terms_version TEXT,
  terms_accepted_at TIMESTAMPTZ,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT handle_format CHECK (handle ~ '^[a-z0-9_]{3,24}$')
);
CREATE INDEX profiles_handle_idx ON public.profiles (handle);
CREATE INDEX profiles_city_idx ON public.profiles (city);
CREATE INDEX profiles_geo_idx ON public.profiles (lat_snap, lng_snap);

-- =========================================================
-- ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','moderator','support')
  );
$$;

-- =========================================================
-- 2FA
-- =========================================================
CREATE TABLE public.user_2fa (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_secret TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  backup_codes TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- COUPLE LINKS
-- =========================================================
CREATE TABLE public.couple_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.couple_status NOT NULL DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a_id <> user_b_id)
);
CREATE UNIQUE INDEX couple_links_pair_idx ON public.couple_links (LEAST(user_a_id,user_b_id), GREATEST(user_a_id,user_b_id));

-- =========================================================
-- VERIFICATION
-- =========================================================
CREATE TABLE public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_front_path TEXT NOT NULL,
  doc_back_path TEXT,
  selfie_path TEXT NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  retention_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '180 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX verification_status_idx ON public.verification_requests(status);

-- =========================================================
-- POSTS / MEDIA
-- =========================================================
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption TEXT DEFAULT '',
  nsfw BOOLEAN NOT NULL DEFAULT false,
  moderation_status public.moderation_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX posts_user_idx ON public.posts(user_id, created_at DESC);
CREATE INDEX posts_feed_idx ON public.posts(moderation_status, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  width INT, height INT,
  "order" INT NOT NULL DEFAULT 0,
  ai_labels JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX post_media_post_idx ON public.post_media(post_id, "order");

CREATE TABLE public.age_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attestation_text TEXT NOT NULL,
  attestation_version TEXT NOT NULL DEFAULT 'v1',
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.content_hashes (
  hash TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_by UUID REFERENCES auth.users(id)
);

-- =========================================================
-- LIKES / COMMENTS / SAVES
-- =========================================================
CREATE TABLE public.likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON public.comments(post_id, created_at);

CREATE TABLE public.saves (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- =========================================================
-- INTERESTS / CONVERSATIONS / MESSAGES
-- =========================================================
CREATE TABLE public.interests_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.interest_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (from_user, to_user)
);

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unlocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a <> user_b)
);
CREATE UNIQUE INDEX conversations_pair_idx ON public.conversations (LEAST(user_a,user_b), GREATEST(user_a,user_b));

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status public.message_status NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX messages_conv_idx ON public.messages(conversation_id, created_at);

-- =========================================================
-- REPORTS / BLOCKS / SHADOWBAN
-- =========================================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  priority INT NOT NULL DEFAULT 5,
  status public.report_status NOT NULL DEFAULT 'open',
  handled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_at TIMESTAMPTZ
);
CREATE INDEX reports_open_idx ON public.reports(status, priority, created_at);

CREATE TABLE public.blocks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_user_id),
  CHECK (user_id <> blocked_user_id)
);

-- =========================================================
-- BANNERS / AUDIT / PROXIMITY / MOD QUEUE
-- =========================================================
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  link TEXT,
  position TEXT NOT NULL DEFAULT 'home_top',
  active BOOLEAN NOT NULL DEFAULT true,
  "order" INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_admin_idx ON public.audit_logs(admin_id, created_at DESC);

CREATE TABLE public.proximity_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX proximity_pings_idx ON public.proximity_pings(user_id, other_user_id, created_at DESC);

CREATE TABLE public.moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type public.mod_item_type NOT NULL,
  item_id UUID NOT NULL,
  status public.moderation_status NOT NULL DEFAULT 'pending',
  priority INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- FUTURE-READY TABLES (schema only)
-- =========================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  processor_ref TEXT,
  renews_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount_cents INT NOT NULL,
  processor TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.private_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unlock_mode TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE public.album_access (
  album_id UUID NOT NULL REFERENCES public.private_albums(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (album_id, viewer_id)
);

CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.safety_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_with_id UUID REFERENCES auth.users(id),
  location TEXT,
  trusted_contact TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- GRANTS
-- =========================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_2fa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couple_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_media TO authenticated;
GRANT SELECT, INSERT ON public.age_consent_records TO authenticated;
GRANT SELECT ON public.content_hashes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.saves TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interests_sent TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT SELECT ON public.banners TO authenticated, anon;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.proximity_pings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.moderation_queue TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_albums TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.album_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_checkins TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.age_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interests_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proximity_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_checkins ENABLE ROW LEVEL SECURITY;

-- profiles: anyone can see basic profile; user updates own; admin updates anyone
CREATE POLICY "profiles select all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles update staff" ON public.profiles FOR UPDATE USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "profiles delete admin" ON public.profiles FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- user_roles: users can read own roles; admin can manage
CREATE POLICY "roles read self" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 2FA: only self
CREATE POLICY "2fa self" ON public.user_2fa FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- couple_links: visible to participants; either participant can insert/update
CREATE POLICY "couples read" ON public.couple_links FOR SELECT USING (auth.uid() IN (user_a_id,user_b_id) OR public.is_staff(auth.uid()));
CREATE POLICY "couples insert" ON public.couple_links FOR INSERT WITH CHECK (auth.uid() = user_a_id);
CREATE POLICY "couples update" ON public.couple_links FOR UPDATE USING (auth.uid() IN (user_a_id,user_b_id));
CREATE POLICY "couples delete" ON public.couple_links FOR DELETE USING (auth.uid() IN (user_a_id,user_b_id) OR public.has_role(auth.uid(),'admin'));

-- verification: user inserts own; user reads own; admin manages
CREATE POLICY "ver insert self" ON public.verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ver select self" ON public.verification_requests FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ver update admin" ON public.verification_requests FOR UPDATE USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- posts: approved visible to all logged in; owner sees own anywhere; staff sees all
CREATE POLICY "posts select" ON public.posts FOR SELECT USING (
  deleted_at IS NULL AND (
    (moderation_status = 'approved'::public.moderation_status)
    OR auth.uid() = user_id
    OR public.is_staff(auth.uid())
  )
);
CREATE POLICY "posts insert self" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts update self or staff" ON public.posts FOR UPDATE USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "posts delete self or staff" ON public.posts FOR DELETE USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- post_media: same access as parent post
CREATE POLICY "media select" ON public.post_media FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND (
    (p.moderation_status='approved'::public.moderation_status AND p.deleted_at IS NULL)
    OR auth.uid() = p.user_id
    OR public.is_staff(auth.uid())
  ))
);
CREATE POLICY "media insert owner" ON public.post_media FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid())
);
CREATE POLICY "media delete owner or staff" ON public.post_media FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND (p.user_id = auth.uid() OR public.is_staff(auth.uid())))
);

-- age_consent: insert only by post owner; read by owner or admin
CREATE POLICY "consent insert" ON public.age_consent_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "consent read" ON public.age_consent_records FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- content_hashes: staff only writes; read by authenticated
CREATE POLICY "hash read" ON public.content_hashes FOR SELECT USING (true);
CREATE POLICY "hash write staff" ON public.content_hashes FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- likes
CREATE POLICY "likes select" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes insert self" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes delete self" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- comments
CREATE POLICY "comments select" ON public.comments FOR SELECT USING (status = 'visible' OR auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "comments insert self" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments update self or staff" ON public.comments FOR UPDATE USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "comments delete self or staff" ON public.comments FOR DELETE USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- saves
CREATE POLICY "saves self" ON public.saves FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- interests
CREATE POLICY "interest select" ON public.interests_sent FOR SELECT USING (auth.uid() IN (from_user, to_user) OR public.is_staff(auth.uid()));
CREATE POLICY "interest insert" ON public.interests_sent FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "interest update target" ON public.interests_sent FOR UPDATE USING (auth.uid() = to_user);
CREATE POLICY "interest delete" ON public.interests_sent FOR DELETE USING (auth.uid() IN (from_user,to_user));

-- conversations
CREATE POLICY "conv select" ON public.conversations FOR SELECT USING (auth.uid() IN (user_a,user_b) OR public.is_staff(auth.uid()));
CREATE POLICY "conv insert" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IN (user_a,user_b));
CREATE POLICY "conv update" ON public.conversations FOR UPDATE USING (auth.uid() IN (user_a,user_b) OR public.is_staff(auth.uid()));

-- messages: only participants
CREATE POLICY "msg select" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() IN (c.user_a,c.user_b) OR public.is_staff(auth.uid())))
);
CREATE POLICY "msg insert participant" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.unlocked = true AND auth.uid() IN (c.user_a,c.user_b)
  )
);
CREATE POLICY "msg update self or staff" ON public.messages FOR UPDATE USING (auth.uid() = sender_id OR public.is_staff(auth.uid()));
CREATE POLICY "msg delete staff" ON public.messages FOR DELETE USING (public.is_staff(auth.uid()));

-- reports
CREATE POLICY "report insert" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "report select" ON public.reports FOR SELECT USING (auth.uid() = reporter_id OR public.is_staff(auth.uid()));
CREATE POLICY "report update staff" ON public.reports FOR UPDATE USING (public.is_staff(auth.uid()));

-- blocks
CREATE POLICY "blocks self" ON public.blocks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- banners: visible all; staff manage
CREATE POLICY "banner select" ON public.banners FOR SELECT USING (true);
CREATE POLICY "banner manage" ON public.banners FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- audit logs: admin only
CREATE POLICY "audit admin" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert staff" ON public.audit_logs FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- proximity pings: self read/write
CREATE POLICY "prox self" ON public.proximity_pings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- moderation queue: staff
CREATE POLICY "modq staff" ON public.moderation_queue FOR ALL USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- subscriptions / transactions: self read
CREATE POLICY "sub self" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "tx self" ON public.transactions FOR SELECT USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- private albums: owner manage; viewers via album_access
CREATE POLICY "alb owner" ON public.private_albums FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "alb access self" ON public.album_access FOR SELECT USING (auth.uid() = viewer_id OR EXISTS (SELECT 1 FROM public.private_albums a WHERE a.id = album_id AND a.owner_id = auth.uid()));
CREATE POLICY "alb access owner" ON public.album_access FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.private_albums a WHERE a.id = album_id AND a.owner_id = auth.uid()));
CREATE POLICY "alb access owner delete" ON public.album_access FOR DELETE USING (EXISTS (SELECT 1 FROM public.private_albums a WHERE a.id = album_id AND a.owner_id = auth.uid()));

-- stories
CREATE POLICY "stories select" ON public.stories FOR SELECT USING (expires_at > now() OR auth.uid() = user_id);
CREATE POLICY "stories self" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories delete" ON public.stories FOR DELETE USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- safety check-ins
CREATE POLICY "safety self" ON public.safety_checkins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- updated_at trigger function
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- handle_new_user (assigns default role; profile created via onboarding form)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interests_sent;
