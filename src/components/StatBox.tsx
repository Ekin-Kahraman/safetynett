import { cn } from "@/lib/utils";

interface StatBoxProps {
  label: string;
  count: number;
  variant: "default" | "pending" | "active" | "escalated";
}

const variantStyles: Record<StatBoxProps["variant"], string> = {
  default: "border-border",
  pending: "border-muted-foreground/30",
  active: "border-primary",
  escalated: "border-destructive animate-pulse-red",
};

const countStyles: Record<StatBoxProps["variant"], string> = {
  default: "text-foreground",
  pending: "text-muted-foreground",
  active: "text-primary",
  escalated: "text-destructive",
};

const StatBox = ({ label, count, variant }: StatBoxProps) => (
  <div className={cn("rounded-lg border-2 bg-card p-4 text-center", variantStyles[variant])}>
    <p className={cn("text-3xl font-bold", countStyles[variant])}>{count}</p>
    <p className="text-sm text-muted-foreground mt-1">{label}</p>
  </div>
);

export default StatBox;
