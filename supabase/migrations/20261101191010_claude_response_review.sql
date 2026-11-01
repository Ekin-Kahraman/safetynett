-- Store the response and its assessment together; every response stays open for review.
ALTER TABLE public.check_ins ADD COLUMN assessment jsonb
  CHECK (assessment IS NULL OR jsonb_typeof(assessment) = 'object');

-- Legacy automatic resolution did not establish that a clinician reviewed a reply.
UPDATE public.safety_nets SET status = 'review_required' WHERE status = 'resolved';

DROP FUNCTION public.record_safety_net_response(uuid, text, boolean);

CREATE FUNCTION public.record_safety_net_response(
  p_safety_net_id uuid, p_response text, p_assessment jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  check_in_id uuid;
  priority_review boolean;
BEGIN
  IF p_response IS NULL OR char_length(btrim(p_response)) = 0 OR char_length(p_response) > 5000
      OR p_assessment IS NULL OR jsonb_typeof(p_assessment) <> 'object' THEN
    RAISE EXCEPTION 'Invalid response assessment' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_assessment->>'status', '') NOT IN ('completed', 'unavailable')
      OR coalesce(p_assessment->>'outcome', '') NOT IN ('routine_review', 'priority_review', 'uncertain')
      OR coalesce(btrim(p_assessment->>'summary'), '') = ''
      OR char_length(p_assessment->>'summary') > 1500
      OR coalesce(btrim(p_assessment->>'prompt_version'), '') = ''
      OR coalesce(p_assessment->>'assessed_at', '') = ''
      OR jsonb_typeof(p_assessment->'evidence') IS DISTINCT FROM 'array'
      OR (p_assessment->>'status' = 'unavailable' AND p_assessment->>'outcome' <> 'uncertain')
      OR (p_assessment->>'status' = 'completed' AND coalesce(btrim(p_assessment->>'model'), '') = '') THEN
    RAISE EXCEPTION 'Invalid response assessment' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.safety_nets
    WHERE id = p_safety_net_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow-up not found' USING ERRCODE = 'P0002';
  END IF;
  priority_review := p_assessment->>'status' <> 'completed'
    OR p_assessment->>'outcome' <> 'routine_review';
  SELECT id INTO check_in_id FROM public.check_ins
    WHERE safety_net_id = p_safety_net_id AND patient_response IS NULL
    ORDER BY sent_at DESC, id DESC LIMIT 1;
  IF check_in_id IS NULL THEN
    INSERT INTO public.check_ins (safety_net_id, patient_response, escalated, assessment)
      VALUES (p_safety_net_id, btrim(p_response), priority_review, p_assessment)
      RETURNING id INTO check_in_id;
  ELSE
    UPDATE public.check_ins SET patient_response = btrim(p_response),
      red_flags_triggered = false, escalated = priority_review, assessment = p_assessment
      WHERE id = check_in_id;
  END IF;
  UPDATE public.safety_nets SET status = CASE WHEN priority_review THEN 'escalated' ELSE 'review_required' END
    WHERE id = p_safety_net_id;
  RETURN check_in_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_safety_net_response(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_safety_net_response(uuid, text, jsonb) TO authenticated;
