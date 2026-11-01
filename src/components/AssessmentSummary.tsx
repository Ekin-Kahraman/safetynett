import type { Json } from "@/integrations/supabase/types";

export default function AssessmentSummary({ value, detailed = false }: { value: Json | null; detailed?: boolean }) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.summary !== "string") return null;
  const unavailable = value.status !== "completed";
  const outcome = value.outcome === "priority_review" ? "Priority review"
    : value.outcome === "routine_review" ? "Awaiting clinician review" : "Uncertain — clinician review required";
  const evidence = Array.isArray(value.evidence) ? value.evidence.filter((quote): quote is string => typeof quote === "string") : [];
  return (
    <div role={unavailable ? "alert" : undefined} className={`mt-2 rounded border p-2 text-sm ${unavailable ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/30"}`}>
      <p className="font-medium">{unavailable ? "Assessment unavailable — manual review required" : `Claude assessment · ${outcome}`}</p>
      <p className="mt-1">{value.summary}</p>
      {detailed && (
        <>
          {evidence.map((quote, index) => <blockquote key={index} className="mt-1 border-l-2 border-primary/40 pl-2">“{quote}”</blockquote>)}
          <p className="mt-2 text-xs text-muted-foreground">
            Model: {typeof value.model === "string" ? value.model : "not configured"}
            {typeof value.prompt_version === "string" ? ` · Prompt: ${value.prompt_version}` : ""}
            {typeof value.assessed_at === "string" ? ` · Assessed: ${value.assessed_at}` : ""}
          </p>
        </>
      )}
    </div>
  );
}
