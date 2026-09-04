import { CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RuleResult } from "@/lib/api";

/**
 * The eligibility results, the heart of the governed story. Each row shows the
 * pass/fail outcome, the human rule label, the EXACT rule key and version that
 * fired, and the value that was tested. These come from the one shared
 * evaluate_application function, so what a reviewer reads here is the same code
 * that gates the approval.
 */
export function RuleResults({ results }: { results: RuleResult[] }) {
  if (!results || results.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No eligibility checks have been run yet.
      </p>
    );
  }
  const passed = results.filter((r) => r.passed).length;
  const allPass = passed === results.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className={cn("font-medium", allPass ? "text-emerald-400" : "text-amber-400")}>
          {passed} of {results.length} rules pass
        </span>
        {!allPass && (
          <span className="text-muted-foreground">
            approval is blocked while any rule fails
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {results.map((r) => (
          <li
            key={`${r.key}-${r.version}`}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3",
              r.passed
                ? "border-emerald-500/25 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5",
            )}
          >
            {r.passed ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{r.label}</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {r.key} v{r.version}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Field <code className="bg-muted rounded px-1 py-0.5">{r.field}</code>
                {r.value !== null && r.value !== undefined && (
                  <>
                    {" "}
                    was{" "}
                    <code className="bg-muted rounded px-1 py-0.5">
                      {String(r.value)}
                    </code>
                  </>
                )}
                {(r.value === null || r.value === undefined) && " was not provided"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
