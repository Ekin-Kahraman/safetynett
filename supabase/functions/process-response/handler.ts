import { authenticate, failure, HttpError, isId, json, preflight, readBody, sendMail, type Dependencies } from "../_shared/runtime.ts";
import { assessResponse, needsPriorityReview } from "../_shared/assess-response.ts";

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
      const assessment = await assessResponse(deps, {
        condition: String(net.condition), warning_signs: net.red_flags as string[], patient_response: response,
      });
      const escalated = needsPriorityReview(assessment);
      const { data: checkInId, error: recordError } = await client.rpc("record_safety_net_response", {
        p_safety_net_id: net.id, p_response: response, p_assessment: assessment,
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
              body: `Clinician review is required.\n\nAssessment: ${assessment.status}\nOutcome: ${assessment.outcome}\nSummary: ${assessment.summary}\nModel: ${assessment.model ?? "not configured"}\nPrompt: ${assessment.prompt_version}\n\nSupporting quotes:\n${assessment.evidence.join("\n") || "No automated evidence available."}\n\nPatient response:\n${response}\n\nThis is a demonstration review request, not a diagnosis or assurance of clinical safety.`,
              idempotencyKey: `response-${checkInId}`,
            });
            notification = "accepted";
          } catch { /* The response is saved; expose failed notification separately. */ }
        }
      }
      return json({ status: escalated ? "escalated" : "review_required", assessment, notification });
    } catch (error) { return failure(error); }
  };
}
