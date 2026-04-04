
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create safety_nets table
CREATE TABLE public.safety_nets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_name TEXT NOT NULL,
  patient_email TEXT NOT NULL,
  condition TEXT NOT NULL,
  timeframe_hours INTEGER NOT NULL DEFAULT 48,
  red_flags TEXT[] NOT NULL DEFAULT '{}',
  gp_name TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  follow_up_at TIMESTAMP WITH TIME ZONE NOT NULL
);

ALTER TABLE public.safety_nets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own safety nets" ON public.safety_nets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own safety nets" ON public.safety_nets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own safety nets" ON public.safety_nets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own safety nets" ON public.safety_nets FOR DELETE USING (auth.uid() = user_id);

-- Create check_ins table
CREATE TABLE public.check_ins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  safety_net_id UUID REFERENCES public.safety_nets(id) ON DELETE CASCADE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  patient_response TEXT,
  red_flags_triggered BOOLEAN NOT NULL DEFAULT false,
  escalated BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view check-ins for own safety nets" ON public.check_ins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.safety_nets WHERE safety_nets.id = check_ins.safety_net_id AND safety_nets.user_id = auth.uid())
  );

CREATE POLICY "Users can create check-ins for own safety nets" ON public.check_ins
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.safety_nets WHERE safety_nets.id = check_ins.safety_net_id AND safety_nets.user_id = auth.uid())
  );
