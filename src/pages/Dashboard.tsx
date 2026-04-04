import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StatBox from "@/components/StatBox";
import SafetyNetCard from "@/components/SafetyNetCard";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type SafetyNet = Tables<"safety_nets">;
type CheckIn = Tables<"check_ins">;

const TABS = ["All", "Escalated", "Awaiting Response", "Pending", "Resolved"] as const;
type Tab = (typeof TABS)[number];

const tabToStatus: Record<Tab, string | null> = {
  All: null,
  Escalated: "escalated",
  "Awaiting Response": "sent",
  Pending: "pending",
  Resolved: "resolved",
};

const statusOrder: Record<string, number> = {
  escalated: 0,
  sent: 1,
  pending: 2,
  resolved: 3,
};

const Dashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("All");

  const { data: safetyNets = [], isLoading } = useQuery({
    queryKey: ["safety_nets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_nets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SafetyNet[];
    },
    enabled: !!user,
  });

  const { data: checkIns = [] } = useQuery({
    queryKey: ["check_ins", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("check_ins").select("*");
      if (error) throw error;
      return data as CheckIn[];
    },
    enabled: !!user,
  });

  const checkInsMap = checkIns.reduce<Record<string, CheckIn[]>>((acc, ci) => {
    (acc[ci.safety_net_id] ??= []).push(ci);
    return acc;
  }, {});

  const active = safetyNets.filter((s) => s.status !== "resolved");
  const counts = {
    total: active.length,
    pending: safetyNets.filter((s) => s.status === "pending").length,
    awaiting: safetyNets.filter((s) => s.status === "sent").length,
    escalated: safetyNets.filter((s) => s.status === "escalated").length,
  };

  const filteredStatus = tabToStatus[activeTab];
  const filtered = filteredStatus
    ? safetyNets.filter((s) => s.status === filteredStatus)
    : safetyNets;

  const sorted = [...filtered].sort((a, b) => {
    const orderDiff = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
    if (orderDiff !== 0) return orderDiff;
    if (a.status === "pending") {
      return new Date(a.follow_up_at).getTime() - new Date(b.follow_up_at).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <Link to="/create">
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            New Safety Net
          </Button>
        </Link>
      </div>

      {/* Stat boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatBox label="Total Active" count={counts.total} variant="default" />
        <StatBox label="Pending" count={counts.pending} variant="pending" />
        <StatBox label="Awaiting Response" count={counts.awaiting} variant="active" />
        <StatBox label="Escalated" count={counts.escalated} variant="escalated" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto mb-4 border-b border-border pb-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">
            No active safety nets. Your patients are all accounted for.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((sn) => (
            <SafetyNetCard
              key={sn.id}
              safetyNet={sn}
              checkIns={checkInsMap[sn.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
