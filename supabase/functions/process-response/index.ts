import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { safety_net_id, response_text } = await req.json();

    if (!safety_net_id || !response_text) {
      return new Response(
        JSON.stringify({ error: "safety_net_id and response_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openMailKey = Deno.env.get("OPENMAIL_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the safety net
    const { data: net, error: netError } = await supabase
      .from("safety_nets")
      .select("*")
      .eq("id", safety_net_id)
      .single();

    if (netError || !net) {
      return new Response(
        JSON.stringify({ error: "Safety net not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Keyword matching: check each red flag against patient response
    const responseLower = response_text.toLowerCase();
    const matchedFlags: string[] = [];

    for (const flag of net.red_flags as string[]) {
      // Extract significant words (3+ chars) from the red flag
      const words = flag
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length >= 3)
        .filter((w: string) => !["the", "and", "for", "not", "has", "are", "was", "been", "with", "from", "than"].includes(w));

      if (words.some((word: string) => responseLower.includes(word))) {
        matchedFlags.push(flag);
      }
    }

    const isEscalated = matchedFlags.length > 0;

    // Update safety net status
    await supabase
      .from("safety_nets")
      .update({ status: isEscalated ? "escalated" : "resolved" })
      .eq("id", safety_net_id);

    // Find most recent check-in for this safety net and update it
    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("id")
      .eq("safety_net_id", safety_net_id)
      .order("sent_at", { ascending: false })
      .limit(1);

    if (checkIns && checkIns.length > 0) {
      await supabase
        .from("check_ins")
        .update({
          patient_response: response_text,
          red_flags_triggered: isEscalated,
          escalated: isEscalated,
        })
        .eq("id", checkIns[0].id);
    }

    // If escalated, send GP notification
    if (isEscalated) {
      // Get GP's email from auth via the user_id
      const { data: userData } = await supabase.auth.admin.getUserById(net.user_id);
      const gpEmail = userData?.user?.email;

      if (gpEmail) {
        if (!openMailKey) {
          console.log("OpenMail API key not configured, GP notification email skipped");
        } else {
          try {
            const matchedList = matchedFlags.map((f: string) => `• ${f}`).join("\n");

            const emailBody = `URGENT: SafetyNet Escalation

${net.patient_name} has reported symptoms matching red flags for ${net.condition}.

Matched flags:
${matchedList}

Patient response:
"${response_text}"

Please review urgently.

— SafetyNet`;

            await fetch("https://api.openmail.com/v1/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openMailKey}`,
              },
              body: JSON.stringify({
                to: gpEmail,
                subject: `URGENT: SafetyNet Escalation — ${net.patient_name} — ${net.condition}`,
                text: emailBody,
              }),
            });
          } catch (emailErr) {
            console.error("GP notification email error:", emailErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: isEscalated ? "escalated" : "resolved",
        matched_flags: matchedFlags,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("process-response error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
