import {
  CheckCircle2,
  FileUp,
  ListChecks,
  PencilLine,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ACTION_LABELS, formatDate } from "@/lib/format";
import type { ReviewActionRow } from "@/lib/api";

const ICONS: Record<string, typeof FileUp> = {
  submit: FileUp,
  run_checks: ListChecks,
  request_changes: PencilLine,
  approve: CheckCircle2,
  deny: XCircle,
};

const ICON_TINT: Record<string, string> = {
  submit: "text-sky-400",
  run_checks: "text-amber-400",
  request_changes: "text-orange-400",
  approve: "text-emerald-400",
  deny: "text-red-400",
};

/**
 * The append-only audit trail: every action taken on the application, in order,
 * with who did it and when. A run_checks entry also shows how many rules passed.
 */
export function AuditTrail({ actions }: { actions: ReviewActionRow[] }) {
  if (!actions || actions.length === 0) {
    return <p className="text-muted-foreground text-sm">No activity yet.</p>;
  }
  return (
    <ol className="space-y-4">
      {actions.map((a, i) => {
        const Icon = ICONS[a.action] ?? FileUp;
        const results = Array.isArray(a.rule_results) ? a.rule_results : null;
        const passed = results ? results.filter((r) => r.passed).length : 0;
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
                <Icon className={cn("size-4", ICON_TINT[a.action] ?? "text-foreground")} />
              </div>
              {i < actions.length - 1 && <div className="bg-border mt-1 w-px flex-1" />}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">
                  {ACTION_LABELS[a.action] ?? a.action}
                </span>
                <span className="text-muted-foreground text-xs">
                  by {a.actor_name ?? "someone"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(a.created_at)}
                </span>
              </div>
              {results && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {passed} of {results.length} eligibility rules passed
                </p>
              )}
              {a.note && <p className="mt-1 text-sm">{a.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
