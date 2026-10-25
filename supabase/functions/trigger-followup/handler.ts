import { authenticate, failure, HttpError, isId, json, preflight, readBody, sendMail, type Dependencies } from "../_shared/runtime.ts";

export function createFollowupHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const early = preflight(req);
    if (early) return early;
    try {
      const { client, user } = await authenticate(req, deps);
      const body = await readBody(req);
      if (body.safety_net_id !== undefined && !isId(body.safety_net_id)) {
        throw new HttpError(400, "safety_net_id must be a UUID");
      }
      let query = client.from("safety_nets").select("*").eq("user_id", user.id).eq("status", "pending");
      query = body.safety_net_id
        ? query.eq("id", body.safety_net_id)
        : query.lte("follow_up_at", (deps.now?.() ?? new Date()).toISOString());
      const { data: nets, error } = await query.order("follow_up_at").limit(100);
      if (error) throw error;
      if (body.safety_net_id && !nets?.length) throw new HttpError(404, "Pending follow-up not found");

      let processed = 0;
      const failed: { id: string; error: string }[] = [];
      for (const net of nets ?? []) {
        try {
          if (net.follow_up_method !== "email") throw new HttpError(422, "Phone follow-up is not implemented");
          await sendMail(deps, {
            to: net.patient_email,
            subject: `Follow-up from ${net.gp_name} — ${net.condition}`,
            body: `Dear ${net.patient_name},\n\n${net.gp_name} asked us to check in about your ${net.condition}.\n\nPlease let us know how you are feeling and whether you have noticed any of these:\n\n${(net.red_flags as string[]).map(flag => `• ${flag}`).join("\n")}\n\n— SafetyNett demonstration`,
            idempotencyKey: `followup-${net.id}-${net.follow_up_at}`,
          });
          // Both writes commit together; failed delivery never marks a record sent.
          const { data, error: recordError } = await client.rpc("record_followup_sent", { p_safety_net_id: net.id });
          if (recordError) throw recordError;
          if (data === true) processed++;
        } catch (error) {
          failed.push({ id: net.id, error: error instanceof HttpError ? error.message : "Could not record the follow-up; check the run before retrying" });
        }
      }
      return json({ processed, failed }, failed.length && !processed ? 502 : 200);
    } catch (error) { return failure(error); }
  };
}
