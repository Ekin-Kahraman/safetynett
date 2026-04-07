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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openMailKey = Deno.env.get("OPENMAIL_API_KEY");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find pending safety nets where follow_up_at has passed
    const { data: dueNets, error: fetchError } = await supabase
      .from("safety_nets")
      .select("*")
      .eq("status", "pending")
      .lte("follow_up_at", new Date().toISOString());

    if (fetchError) throw fetchError;
    if (!dueNets || dueNets.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending follow-ups due", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;

    for (const net of dueNets) {
      // Send email if method is email
      if (net.follow_up_method === "email") {
        if (!openMailKey) {
          console.log("OpenMail API key not configured, email skipped");
        } else {
          try {
            const redFlagsList = (net.red_flags as string[])
              .map((f: string) => `• ${f}`)
              .join("\n");

            const emailBody = `Dear ${net.patient_name},

Your GP ${net.gp_name} asked us to check in with you about your ${net.condition}. It has been ${net.timeframe_hours} hours since your appointment.

Please let us know how you are feeling. Are you experiencing any of these:

${redFlagsList}

Reply to this email to let us know.

If this is a medical emergency call 999.

— SafetyNet on behalf of ${net.gp_name}`;

            const res = await fetch("https://api.openmail.com/v1/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openMailKey}`,
              },
              body: JSON.stringify({
                to: net.patient_email,
                subject: `Health check-in from ${net.gp_name} — ${net.condition}`,
                text: emailBody,
              }),
            });

            if (!res.ok) {
              console.error(`OpenMail send failed for ${net.id}: ${res.status} ${await res.text()}`);
            }
          } catch (emailErr) {
            console.error(`Email send error for ${net.id}:`, emailErr);
          }
        }
      } else {
        // Phone follow-up — handled externally, just mark as sent
        console.log(`Phone follow-up for ${net.id} — external ElevenLabs call not implemented`);
      }

      // Update status to sent
      const { error: updateError } = await supabase
        .from("safety_nets")
        .update({ status: "sent" })
        .eq("id", net.id);

      if (updateError) {
        console.error(`Failed to update status for ${net.id}:`, updateError);
        continue;
      }

      // Insert check-in record
      const { error: ciError } = await supabase.from("check_ins").insert({
        safety_net_id: net.id,
      });

      if (ciError) {
        console.error(`Failed to insert check-in for ${net.id}:`, ciError);
      }

      processed++;
    }

    return new Response(
      JSON.stringify({ message: "Follow-ups processed", processed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("trigger-followup error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
