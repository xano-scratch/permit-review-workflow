import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError, type PermitType } from "@/lib/api";
import { titleCaseKey } from "@/lib/format";

export function Apply({ navigate }: { navigate: (to: string) => void }) {
  const [types, setTypes] = useState<PermitType[] | null>(null);
  const [typeId, setTypeId] = useState<string>("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [appId, setAppId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .permitTypes()
      .then(setTypes)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load permit types."));
  }, []);

  const selected = types?.find((t) => String(t.id) === typeId) ?? null;

  function onSelectType(v: string) {
    setTypeId(v);
    setAppId(0);
    setError(null);
    setNotice(null);
    const t = types?.find((x) => String(x.id) === v);
    const fields = (t?.required_fields ?? []) as string[];
    const blank: Record<string, string> = {};
    for (const f of fields) blank[f] = "";
    setForm(blank);
  }

  async function save(): Promise<number | null> {
    if (!selected) return null;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const app = await api.save({
        application_id: appId,
        permit_type_id: selected.id as number,
        form_data: form,
      });
      const id = app.id as number;
      setAppId(id);
      setNotice("Draft saved.");
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the draft.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const id = appId > 0 ? appId : await save();
    if (!id) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.submit({ application_id: id });
      navigate(`#/app/${id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Apply for a permit</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The API checks completeness on submit. If a required field is missing, the
          submission is refused and the missing fields are named, no matter what this form
          lets you do.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permit type</CardTitle>
          <CardDescription>Choose what you are applying for.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={typeId} onValueChange={onSelectType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={types ? "Select a permit type" : "Loading..."} />
            </SelectTrigger>
            <SelectContent>
              {(types ?? []).map((t) => (
                <SelectItem key={t.id as number} value={String(t.id)}>
                  {t.name as string}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected?.description && (
            <p className="text-muted-foreground text-sm">{selected.description as string}</p>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Application details</CardTitle>
            <CardDescription>
              Every field below is required for this permit type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(selected.required_fields as string[]).map((field) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={field}>{titleCaseKey(field)}</Label>
                <Input
                  id={field}
                  value={form[field] ?? ""}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  placeholder={titleCaseKey(field)}
                />
              </div>
            ))}

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {notice && <p className="text-sm text-emerald-400">{notice}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={save} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save draft
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Submit application
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
