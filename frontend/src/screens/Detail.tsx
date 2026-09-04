import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ListChecks,
  Loader2,
  PencilLine,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { RuleResults } from "@/components/RuleResults";
import { AuditTrail } from "@/components/AuditTrail";
import { api, ApiError, type Detail as DetailData, type Evaluation, type Me, type RuleResult } from "@/lib/api";
import { titleCaseKey } from "@/lib/format";

const TERMINAL = new Set(["approved", "denied"]);

export function Detail({
  id,
  me,
  navigate,
}: {
  id: number;
  me: Me;
  navigate: (to: string) => void;
}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isStaff = me.role === "reviewer" || me.role === "program_admin";

  const load = useCallback(async () => {
    try {
      const d = await api.getApplication(id);
      setData(d);
      // Latest eligibility results come from the most recent run_checks entry.
      const lastChecks = [...d.actions]
        .reverse()
        .find((a) => a.action === "run_checks" && Array.isArray(a.rule_results));
      if (lastChecks && Array.isArray(lastChecks.rule_results)) {
        setEvaluation(evalFromResults(lastChecks.rule_results));
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load the application.");
    }
  }, [id]);

  useEffect(() => {
    setData(null);
    setEvaluation(null);
    setLoadError(null);
    load();
  }, [load]);

  const formEntries = useMemo(() => {
    const fd = (data?.application?.form_data ?? {}) as Record<string, unknown>;
    return Object.entries(fd);
  }, [data]);

  async function runChecks() {
    setBusy("checks");
    setError(null);
    try {
      const r = await api.runChecks({ application_id: id });
      setEvaluation(r.evaluation);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run checks.");
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: "approve" | "deny" | "request_changes") {
    setBusy(decision);
    setError(null);
    try {
      const r = await api.decide({ application_id: id, decision, note });
      setEvaluation(r.evaluation);
      setNote("");
      await load();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : "Could not record the decision.");
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <BackLink navigate={navigate} isStaff={isStaff} />
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading application...
      </div>
    );
  }

  const status = data.application.status as string;
  const terminal = TERMINAL.has(status);
  const approveBlocked = !!evaluation && !evaluation.all_passed;

  return (
    <div className="space-y-6">
      <BackLink navigate={navigate} isStaff={isStaff} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.permit_type.name as string}
        </h1>
        <StatusBadge status={status} />
        <span className="text-muted-foreground text-sm">Application #{id}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application answers</CardTitle>
            </CardHeader>
            <CardContent>
              {formEntries.length === 0 ? (
                <p className="text-muted-foreground text-sm">No answers recorded.</p>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {formEntries.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground text-xs">{titleCaseKey(k)}</dt>
                      <dd className="text-sm">
                        {v === "" || v === null || v === undefined ? (
                          <span className="text-muted-foreground italic">not provided</span>
                        ) : (
                          String(v)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eligibility results</CardTitle>
            </CardHeader>
            <CardContent>
              {evaluation ? (
                <RuleResults results={evaluation.results} />
              ) : (
                <p className="text-muted-foreground text-sm">
                  No eligibility checks have been run yet.
                  {isStaff && " Run the checks to evaluate this application against the active rules."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review trail</CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTrail actions={data.actions} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {isStaff ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={runChecks}
                  disabled={busy !== null}
                >
                  {busy === "checks" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ListChecks className="size-4" />
                  )}
                  Run eligibility checks
                </Button>

                {terminal ? (
                  <p className="text-muted-foreground text-sm">
                    This application is {status}. The decision is recorded in the trail.
                  </p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="note">Note (optional)</Label>
                      <Textarea
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a note for the applicant or the record"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Button
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-600/90"
                        onClick={() => decide("approve")}
                        disabled={busy !== null || approveBlocked}
                        title={
                          approveBlocked
                            ? "Approval is blocked while an eligibility rule is failing"
                            : undefined
                        }
                      >
                        {busy === "approve" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        Approve
                      </Button>
                      {approveBlocked && (
                        <p className="text-xs text-amber-400">
                          Approval is blocked while a rule fails ({evaluation?.failed_text}).
                        </p>
                      )}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => decide("request_changes")}
                        disabled={busy !== null}
                      >
                        {busy === "request_changes" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <PencilLine className="size-4" />
                        )}
                        Request changes
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full text-red-400 hover:text-red-400"
                        onClick={() => decide("deny")}
                        disabled={busy !== null}
                      >
                        {busy === "deny" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Ban className="size-4" />
                        )}
                        Deny
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  A reviewer runs the eligibility checks and decides this application. You
                  cannot approve or deny your own permit, and the review queue is not
                  available to applicants.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function BackLink({
  navigate,
  isStaff,
}: {
  navigate: (to: string) => void;
  isStaff: boolean;
}) {
  return (
    <button
      onClick={() => navigate(isStaff ? "#/queue" : "#/mine")}
      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft className="size-4" />
      Back to {isStaff ? "queue" : "my applications"}
    </button>
  );
}

function evalFromResults(results: RuleResult[]): Evaluation {
  const failed = results.filter((r) => !r.passed);
  return {
    results,
    checked: results.length,
    failed_count: failed.length,
    all_passed: failed.length === 0,
    failed_text: failed.map((r) => `${r.key} v${r.version}`).join(", "),
  };
}
