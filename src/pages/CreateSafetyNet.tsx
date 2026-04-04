import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown, ChevronUp, Mail, Phone, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CONDITION_GROUPS, RED_FLAGS, TIMEFRAMES } from "@/lib/conditions";

const CreateSafetyNet = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientDob, setPatientDob] = useState<Date | undefined>();
  const [nhsNumber, setNhsNumber] = useState("");
  const [condition, setCondition] = useState<string>("");
  const [customCondition, setCustomCondition] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [customRedFlags, setCustomRedFlags] = useState("");
  const [selectedRedFlags, setSelectedRedFlags] = useState<string[]>([]);
  const [timeframeHours, setTimeframeHours] = useState(48);
  const [followUpMethod, setFollowUpMethod] = useState<"email" | "phone">("email");
  const [gpName, setGpName] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const toggleGroup = (specialty: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(specialty)) next.delete(specialty);
      else next.add(specialty);
      return next;
    });
  };

  const handleConditionSelect = (c: string) => {
    setCondition(c);
    setCustomCondition("");
    setSelectedRedFlags(RED_FLAGS[c] ?? []);
  };

  const handleOtherSelected = () => {
    setCondition("Other");
    setSelectedRedFlags([]);
  };

  const toggleRedFlag = (flag: string) => {
    setSelectedRedFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]
    );
  };

  const finalCondition = condition === "Other" ? customCondition.trim() : condition;

  const mutation = useMutation({
    mutationFn: async () => {
      const followUpAt = new Date(Date.now() + timeframeHours * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("safety_nets").insert({
        user_id: user!.id,
        patient_name: patientName.trim(),
        patient_email: patientEmail.trim(),
        patient_dob: patientDob ? format(patientDob, "yyyy-MM-dd") : null,
        nhs_number: nhsNumber.trim() || null,
        condition: finalCondition,
        timeframe_hours: timeframeHours,
        red_flags: condition === "Other"
          ? customRedFlags.split("\n").map(s => s.trim()).filter(Boolean)
          : selectedRedFlags,
        gp_name: gpName.trim(),
        notes: notes.trim() || null,
        follow_up_at: followUpAt,
        follow_up_method: followUpMethod,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      const label = TIMEFRAMES.find((t) => t.hours === timeframeHours)?.label ?? `${timeframeHours}h`;
      toast({
        title: "Safety net active",
        description: `${patientName} will be contacted in ${label}.`,
      });
      navigate("/");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = patientName && patientEmail && finalCondition && gpName;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Create Safety Net</h1>

      <div className="space-y-6">
        {/* Patient details row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="patientName">Patient name</Label>
            <Input
              id="patientName"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Full name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="patientEmail">Patient email</Label>
            <Input
              id="patientEmail"
              type="email"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="patient@email.com"
              required
            />
          </div>
        </div>

        {/* Patient details row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Date of birth</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !patientDob && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {patientDob ? format(patientDob, "dd MMM yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={patientDob}
                  onSelect={setPatientDob}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nhsNumber">NHS number (optional)</Label>
            <Input
              id="nhsNumber"
              value={nhsNumber}
              onChange={(e) => setNhsNumber(e.target.value)}
              placeholder="000 000 0000"
            />
          </div>
        </div>

        {/* Condition pills grouped by specialty */}
        <div className="space-y-2">
          <Label>Condition</Label>
          {CONDITION_GROUPS.map((group) => {
            const isOpen = expandedGroups.has(group.specialty);
            const hasSelected = group.conditions.includes(condition);
            return (
              <div key={group.specialty} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.specialty)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-colors",
                    hasSelected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {group.specialty}
                    {hasSelected && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {condition}
                      </Badge>
                    )}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {isOpen && (
                  <div className="flex flex-wrap gap-2 p-3 pt-1 animate-in slide-in-from-top-1 duration-200">
                    {group.conditions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleConditionSelect(c)}
                        className={`px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                          condition === c
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* Other */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Other</p>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={handleOtherSelected}
                className={`px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                  condition === "Other"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary/50"
                }`}
              >
                Other
              </button>
              {condition === "Other" && (
                <Input
                  value={customCondition}
                  onChange={(e) => setCustomCondition(e.target.value)}
                  placeholder="Enter condition…"
                  className="max-w-xs animate-in slide-in-from-left-2 duration-200"
                  autoFocus
                />
              )}
            </div>
          </div>
        </div>

        {/* Red flags */}
        {condition && condition !== "Other" && RED_FLAGS[condition] && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
            <Label>Red flags — untick what doesn't apply</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RED_FLAGS[condition].map((flag) => (
                <label
                  key={flag}
                  className="flex items-center gap-2 p-2.5 rounded-md border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedRedFlags.includes(flag)}
                    onCheckedChange={() => toggleRedFlag(flag)}
                  />
                  <span className="text-sm">{flag}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Custom red flags for Other */}
        {condition === "Other" && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
            <Label>Red flags (one per line)</Label>
            <Textarea
              value={customRedFlags}
              onChange={(e) => setCustomRedFlags(e.target.value)}
              placeholder={"e.g.\nWorsening pain\nFever > 38°C\nUnable to eat or drink"}
              rows={4}
            />
          </div>
        )}

        {/* Timeframe */}
        <div className="space-y-2">
          <Label>Follow-up timeframe</Label>
          <div className="flex gap-2">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.hours}
                type="button"
                onClick={() => setTimeframeHours(t.hours)}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold border transition-all ${
                  timeframeHours === t.hours
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:border-primary/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Follow-up method */}
        <div className="space-y-2">
          <Label>Follow-up method</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFollowUpMethod("email")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold border transition-all",
                followUpMethod === "email"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary/50"
              )}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => setFollowUpMethod("phone")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold border transition-all",
                followUpMethod === "phone"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary/50"
              )}
            >
              <Phone className="h-4 w-4" />
              Phone Call
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {followUpMethod === "email"
              ? "Patient will receive an automated email check-in via OpenMail"
              : "Patient will receive an automated voice call via ElevenLabs"}
          </p>
        </div>

        {/* GP Name */}
        <div className="space-y-1.5">
          <Label htmlFor="gpName">GP name</Label>
          <Input
            id="gpName"
            value={gpName}
            onChange={(e) => setGpName(e.target.value)}
            placeholder="Dr. Smith"
            required
          />
        </div>

        {/* Notes toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            {showNotes ? "Hide notes" : "Add notes"}
          </button>
          {showNotes && (
            <div className="mt-2 animate-in slide-in-from-top-1 duration-200">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes…"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <Button
          className="w-full py-6 text-base font-semibold"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Activating…" : "Activate Safety Net"}
        </Button>
      </div>
    </div>
  );
};

export default CreateSafetyNet;
