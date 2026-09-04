import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { api, type QueueRow } from "@/lib/api";
import { formatDate } from "@/lib/format";

const FILTERS = [
  { value: "open", label: "Open (submitted + under review)" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "needs_changes", label: "Needs changes" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
];

export function Queue({ navigate }: { navigate: (to: string) => void }) {
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: string) => {
    setRows(null);
    setError(null);
    try {
      const r = await api.queue(s === "open" ? undefined : s);
      setRows(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the queue.");
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Applications waiting on staff. This endpoint is reviewer-only at the API layer.
          </p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!rows && !error && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading...
        </div>
      )}
      {rows && rows.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No applications match this filter.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(rows ?? []).map((r) => (
          <button
            key={r.id as number}
            onClick={() => navigate(`#/app/${r.id}`)}
            className="w-full text-left"
          >
            <Card className="hover:border-primary/40 transition-colors">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.permit_type_name}</span>
                    <StatusBadge status={r.status as string} />
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    #{r.id as number} · {r.applicant_name} · submitted {formatDate(r.submitted_at)}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
