CREATE TABLE public.access_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  timezone TEXT,
  event_type TEXT NOT NULL DEFAULT 'login',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.access_history TO authenticated;
GRANT ALL ON public.access_history TO service_role;

ALTER TABLE public.access_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own access history"
  ON public.access_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX access_history_user_created_idx
  ON public.access_history (user_id, created_at DESC);