import { useEffect, useState } from "react";
import { ChevronRight, FilePlus2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { api, type MineRow } from "@/lib/api";
import { formatDate } from "@/lib/format";

export function MyApplications({ navigate }: { navigate: (to: string) => void }) {
  const [rows, setRows] = useState<MineRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .mine()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My applications</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every permit you have started or submitted.
          </p>
        </div>
        <Button onClick={() => navigate("#/apply")}>
          <FilePlus2 className="size-4" />
          New application
        </Button>
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
            You have no applications yet. Start one from the Apply screen.
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
                    Application #{r.id as number} · started {formatDate(r.created_at)}
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
