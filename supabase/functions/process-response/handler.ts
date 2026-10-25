import { authenticate, failure, HttpError, isId, json, preflight, readBody, sendMail, type Dependencies } from "../_shared/runtime.ts";
import { matchRedFlags } from "../_shared/match-flags.ts";

export function createResponseHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const early = preflight(req);
    if (early) return early;
    try {
      const { client, user } = await authenticate(req, deps);
      const body = await readBody(req);
      if (!isId(body.safety_net_id) || typeof body.response_text !== "string" || !body.response_text.trim() || body.response_text.length > 5_000) {
        throw new HttpError(400, "Provide a safety_net_id UUID and a response of 1–5,000 characters");
      }
      if (body.simulation !== undefined && typeof body.simulation !== "boolean") {
        throw new HttpError(400, "simulation must be a boolean");
      }
      const { data: net, error } = await client.from("safety_nets").select("*")
        .eq("id", body.safety_net_id).eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!net) throw new HttpError(404, "Follow-up not found");
      const response = body.response_text.trim();
      const matched = matchRedFlags(response, net.red_flags as string[]);
      const escalated = matched.length > 0;
      const { data: checkInId, error: recordError } = await client.rpc("record_safety_net_response", {
        p_safety_net_id: net.id, p_response: response, p_escalated: escalated,
      });
      if (recordError) throw recordError;
      let notification = "not_required";
      if (body.simulation === true) notification = "simulation";
      else if (escalated) {
        notification = "failed";
        if (user.email) {
          try {
            await sendMail(deps, {
              to: user.email,
              subject: `Review requested — ${net.patient_name} — ${net.condition}`,
              body: `A demonstration response matched these configured phrases:\n${matched.join("\n")}\n\nResponse:\n${response}\n\nPlease review the response. A keyword match is not a clinical assessment.`,
              idempotencyKey: `response-${checkInId}`,
            });
            notification = "accepted";
          } catch { /* The response is saved; expose failed notification separately. */ }
        }
      }
      return json({ status: escalated ? "escalated" : "resolved", matched_flags: matched, notification });
    } catch (error) { return failure(error); }
  };
}
