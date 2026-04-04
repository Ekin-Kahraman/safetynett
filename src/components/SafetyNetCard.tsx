import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, Mail, Phone, Play, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const OPENMAIL_API_KEY = import.meta.env.VITE_OPENMAIL_API_KEY ?? "";
const OPENMAIL_INBOX_ID = import.meta.env.VITE_OPENMAIL_INBOX_ID ?? "";

type SafetyNet = Tables<"safety_nets">;
type CheckIn = Tables<"check_ins">;

interface SafetyNetCardProps {
  safetyNet: SafetyNet;
  checkIns: CheckIn[];
}

const statusBarColor: Record<string, string> = {
  escalated: "bg-destructive",
  sent: "bg-primary",
  pending: "bg-muted-foreground/40",
  resolved: "bg-success",
};

const statusLabel: Record<string, string> = {
  escalated: "Escalated",
  sent: "Awaiting Response",
  pending: "Pending",
  resolved: "Resolved",
};

// Simple keyword match for red flags against patient response
function matchRedFlags(response: string, redFlags: string[]): string[] {
  const text = response.toLowerCase();
  return redFlags.filter((flag) => {
    const words = flag.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => text.includes(w));
  });
}

// Generate a realistic deterioration response based on condition
function generateBadResponse(condition: string, redFlags: string[]): string {
  const responses: Record<string, string> = {
    "Viral URTI": "She's still really hot after 3 days, temperature was 39.4 this morning and she won't drink anything. She seems very floppy and sleepy.",
    "Bronchiolitis": "His breathing is really fast and he's not feeding properly, maybe half what he normally takes. I noticed his chest pulling in a lot.",
    "Croup": "The cough is much worse and now he's making that stridor noise even when he's sitting still. He's drooling and can't seem to swallow.",
    "Meningitis": "She has a rash that doesn't go away when I press a glass on it, and she's very stiff in her neck. She seems confused and won't look at the light.",
    "Community acquired pneumonia": "My oxygen levels are reading 92% on the home monitor. I'm feeling confused and the chest pain is getting worse not better despite the antibiotics.",
    "Asthma exacerbation": "I can't finish a sentence without gasping. My peak flow is only 40% of my best. My lips look a bit blue.",
    "Acute coronary syndrome": "The pain has come back and it's going down my left arm and into my jaw. I'm sweating a lot and feel really sick.",
    "Heart failure": "I can't lie flat at all now, I have to sit up to breathe. My ankles are very swollen and I've gained 3kg since Monday.",
    "Concussion": "I've been sick three times since yesterday and the headache is getting much worse. I feel really confused about where I am.",
    "Gastroenteritis": "I can't keep anything down at all, not even water. There's blood in my stool and I've had a high fever for two days now.",
    "Cellulitis": "The redness has spread a lot since yesterday, there are red lines going up my arm now and it's much more painful than it should be. I feel feverish.",
    "Acute suicidal ideation": "I've made a plan and I know how I would do it. I've been giving away my things to people.",
    "Cauda equina syndrome": "I've lost feeling in my saddle area and I'm having trouble controlling my bladder. Both legs feel weak.",
  };
  return responses[condition] ?? `I'm feeling much worse. I have ${redFlags.slice(0, 2).join(" and ").toLowerCase()}.`;
}

const SafetyNetCard = ({ safetyNet, checkIns }: SafetyNetCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);
  const [simulatedResponse, setSimulatedResponse] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const flagsList = safetyNet.red_flags.map((f) => `  - ${f}`).join("\n");
      const body = `Dear ${safetyNet.patient_name},\n\nYour GP, ${safetyNet.gp_name}, asked us to follow up with you about your ${safetyNet.condition}.\n\nIt has been ${safetyNet.timeframe_hours} hours since your appointment. Please let us know if you are experiencing any of the following:\n\n${flagsList}\n\nReply to this email to let us know how you are doing. If you are feeling better, simply reply saying so.\n\nIf this is a medical emergency, call 999 immediately.\n\nBest wishes,\nSafetyNet — Automated Clinical Safety Netting\nOn behalf of ${safetyNet.gp_name}`;

      const res = await fetch(`https://api.openmail.sh/v1/inboxes/${OPENMAIL_INBOX_ID}/send`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENMAIL_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          to: safetyNet.patient_email,
          subject: "SafetyNet: Your GP has asked us to check in",
          body,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenMail error: ${res.status} ${err}`);
      }

      await supabase.from("safety_nets").update({ status: "sent" }).eq("id", safetyNet.id);
      await supabase.from("check_ins").insert({ safety_net_id: safetyNet.id, patient_response: null, red_flags_triggered: false, escalated: false });
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: `Follow-up sent to ${safetyNet.patient_email} via OpenMail` });
      queryClient.invalidateQueries({ queryKey: ["safety_nets"] });
      queryClient.invalidateQueries({ queryKey: ["check_ins"] });
    },
    onError: (err: Error) => {
      toast({ title: "Email failed", description: err.message, variant: "destructive" });
    },
  });

  const simulateMutation = useMutation({
    mutationFn: async (responseText: string) => {
      const matched = matchRedFlags(responseText, safetyNet.red_flags);
      const hasRedFlags = matched.length > 0;
      const newStatus = hasRedFlags ? "escalated" : "resolved";

      const { error: updateError } = await supabase
        .from("safety_nets")
        .update({ status: newStatus })
        .eq("id", safetyNet.id);
      if (updateError) throw updateError;

      const { error: checkInError } = await supabase.from("check_ins").insert({
        safety_net_id: safetyNet.id,
        patient_response: responseText,
        red_flags_triggered: hasRedFlags,
        escalated: hasRedFlags,
      });
      if (checkInError) throw checkInError;
    },
    onSuccess: () => {
      setShowSimulate(false);
      setSimulatedResponse("");
      queryClient.invalidateQueries({ queryKey: ["safety_nets"] });
      queryClient.invalidateQueries({ queryKey: ["check_ins"] });
    },
  });

  const barColor = statusBarColor[safetyNet.status] ?? "bg-muted-foreground/40";

  const timeText = (() => {
    if (safetyNet.status === "resolved") {
      return `Resolved ${formatDistanceToNow(new Date(safetyNet.created_at), { addSuffix: true })}`;
    }
    const followUp = new Date(safetyNet.follow_up_at);
    if (followUp > new Date()) {
      return `Follow-up in ${formatDistanceToNow(followUp)}`;
    }
    return `Follow-up overdue by ${formatDistanceToNow(followUp)}`;
  })();

  const escalatedCheckIn = checkIns.find((ci) => ci.escalated);
  const latestCheckIn = checkIns[0];
  const patientResponse = latestCheckIn?.patient_response;

  return (
    <div
      className={cn(
        "border border-border rounded-lg overflow-hidden bg-card cursor-pointer transition-all hover:shadow-md",
        safetyNet.status === "escalated" && "animate-pulse-red border-destructive/50"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex">
        {/* Color bar */}
        <div className={cn("w-1.5 shrink-0", barColor)} />

        <div className="flex-1 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-foreground">{safetyNet.patient_name}</p>
              <p className="text-sm text-muted-foreground">{safetyNet.condition}</p>
            </div>
            <div className="flex items-center gap-2">
              {safetyNet.status === "sent" && (
                <span className="text-xs text-primary font-medium flex items-center gap-1">
                  Awaiting response
                  <span className="inline-flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </span>
              )}
              {safetyNet.status !== "sent" && (
                <span className="text-xs text-muted-foreground">{timeText}</span>
              )}
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-1">GP: {safetyNet.gp_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground">
              Created {formatDistanceToNow(new Date(safetyNet.created_at), { addSuffix: true })}
            </p>
            {safetyNet.follow_up_method === "phone" ? (
              <Phone className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Mail className="h-3 w-3 text-muted-foreground" />
            )}
          </div>

          {/* Escalated: red flag badges + patient response */}
          {safetyNet.status === "escalated" && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1">
                {safetyNet.red_flags.map((flag) => (
                  <Badge key={flag} variant="destructive" className="text-xs">
                    {flag}
                  </Badge>
                ))}
              </div>
              {patientResponse && (
                <p className="text-sm text-foreground bg-destructive/10 rounded p-2 border border-destructive/20">
                  "{patientResponse}"
                </p>
              )}
              {escalatedCheckIn && (
                <p className="text-xs text-muted-foreground">
                  GP notification sent {formatDistanceToNow(new Date(escalatedCheckIn.sent_at), { addSuffix: true })}
                </p>
              )}
            </div>
          )}

          {/* Resolved: patient response in italic */}
          {safetyNet.status === "resolved" && patientResponse && (
            <p className="text-sm text-muted-foreground italic mt-2">
              "{patientResponse}"
            </p>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="mt-4 pt-4 border-t border-border space-y-3 animate-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="text-foreground">{safetyNet.patient_email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span className="text-foreground">{statusLabel[safetyNet.status] ?? safetyNet.status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  <span className="text-foreground">
                    {format(new Date(safetyNet.created_at), "dd MMM yyyy, HH:mm")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Timeframe:</span>{" "}
                  <span className="text-foreground">{safetyNet.timeframe_hours}h</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Method:</span>{" "}
                  <span className="text-foreground capitalize">{safetyNet.follow_up_method}</span>
                </div>
                {safetyNet.nhs_number && (
                  <div>
                    <span className="text-muted-foreground">NHS:</span>{" "}
                    <span className="text-foreground">{safetyNet.nhs_number}</span>
                  </div>
                )}
              </div>

              {safetyNet.red_flags.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Red flags:</p>
                  <div className="flex flex-wrap gap-1">
                    {safetyNet.red_flags.map((flag) => (
                      <Badge key={flag} variant="outline" className="text-xs">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {safetyNet.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes:</p>
                  <p className="text-sm text-foreground">{safetyNet.notes}</p>
                </div>
              )}

              {checkIns.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Check-ins</p>
                  {checkIns.map((ci) => (
                    <div key={ci.id} className="text-sm border border-border rounded p-2 mb-1">
                      <p className="text-muted-foreground">
                        Sent {formatDistanceToNow(new Date(ci.sent_at), { addSuffix: true })}
                      </p>
                      {ci.patient_response && (
                        <p className="text-foreground mt-1">{ci.patient_response}</p>
                      )}
                      {ci.escalated && (
                        <Badge variant="destructive" className="mt-1 text-xs">Escalated</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Simulate Patient Response — demo only */}
              {(safetyNet.status === "sent" || safetyNet.status === "pending") && (
                <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                  {!showSimulate ? (
                    <div className="flex gap-2">
                      {safetyNet.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={sendEmailMutation.isPending}
                          onClick={() => sendEmailMutation.mutate()}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          {sendEmailMutation.isPending ? "Sending…" : "Send Follow-up Now"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowSimulate(true);
                          setSimulatedResponse(generateBadResponse(safetyNet.condition, safetyNet.red_flags));
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Simulate Response (Demo)
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 border border-dashed border-primary/30 rounded-lg p-3 bg-primary/5">
                      <p className="text-xs font-medium text-primary">Simulate Patient Response</p>
                      <Textarea
                        value={simulatedResponse}
                        onChange={(e) => setSimulatedResponse(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSimulatedResponse("I'm feeling much better now, thank you for checking in. The symptoms have cleared up.")}
                        >
                          Feeling better
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => setSimulatedResponse(generateBadResponse(safetyNet.condition, safetyNet.red_flags))}
                        >
                          Red flags present
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!simulatedResponse.trim() || simulateMutation.isPending}
                          onClick={() => simulateMutation.mutate(simulatedResponse)}
                        >
                          {simulateMutation.isPending ? "Processing…" : "Submit Response"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowSimulate(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SafetyNetCard;
