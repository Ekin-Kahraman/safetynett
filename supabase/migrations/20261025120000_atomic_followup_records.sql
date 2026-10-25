-- Keep status and check-in history consistent when either write fails.
-- These functions run with the caller's permissions and existing RLS policies.
CREATE POLICY "Users can update check-ins for own safety nets" ON public.check_ins
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.safety_nets
      WHERE safety_nets.id = check_ins.safety_net_id AND safety_nets.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.safety_nets
      WHERE safety_nets.id = check_ins.safety_net_id AND safety_nets.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.record_followup_sent(p_safety_net_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  current_status text;
BEGIN
  SELECT status INTO current_status FROM public.safety_nets
    WHERE id = p_safety_net_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow-up not found' USING ERRCODE = 'P0002';
  END IF;
  IF current_status <> 'pending' THEN RETURN false; END IF;
  INSERT INTO public.check_ins (safety_net_id) VALUES (p_safety_net_id);
  UPDATE public.safety_nets SET status = 'sent' WHERE id = p_safety_net_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_safety_net_response(
  p_safety_net_id uuid, p_response text, p_escalated boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  check_in_id uuid;
BEGIN
  IF p_response IS NULL OR char_length(btrim(p_response)) = 0
      OR char_length(p_response) > 5000 OR p_escalated IS NULL THEN
    RAISE EXCEPTION 'Invalid response' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.safety_nets
    WHERE id = p_safety_net_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow-up not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT id INTO check_in_id FROM public.check_ins
    WHERE safety_net_id = p_safety_net_id AND patient_response IS NULL
    ORDER BY sent_at DESC, id DESC LIMIT 1;
  IF check_in_id IS NULL THEN
    INSERT INTO public.check_ins (safety_net_id, patient_response, red_flags_triggered, escalated)
      VALUES (p_safety_net_id, btrim(p_response), p_escalated, p_escalated)
      RETURNING id INTO check_in_id;
  ELSE
    UPDATE public.check_ins SET patient_response = btrim(p_response),
      red_flags_triggered = p_escalated, escalated = p_escalated WHERE id = check_in_id;
  END IF;
  UPDATE public.safety_nets SET status = CASE WHEN p_escalated THEN 'escalated' ELSE 'resolved' END
    WHERE id = p_safety_net_id;
  RETURN check_in_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_followup_sent(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_safety_net_response(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_followup_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_safety_net_response(uuid, text, boolean) TO authenticated;
