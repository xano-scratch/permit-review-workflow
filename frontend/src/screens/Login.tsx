import { useState } from "react";
import { Building2, Database, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, setToken, type Me } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { label: "Reviewer", email: "priya@city.gov", hint: "Priya Shah" },
  { label: "Program admin", email: "admin@city.gov", hint: "Dana Reyes" },
  { label: "Applicant", email: "alice@example.com", hint: "Alice Nguyen" },
];

export function Login({ onAuthed }: { onAuthed: (me: Me) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("priya@city.gov");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  async function finish(token: string) {
    setToken(token);
    const me = await api.me();
    onAuthed(me);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const r = await api.login({ email, password });
        await finish(r.token as string);
      } else {
        const r = await api.signup({ email, password, name });
        await finish(r.token as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function loadDemo() {
    setBusy(true);
    setError(null);
    setSeedMsg(null);
    try {
      const r = await api.seed();
      setSeedMsg(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load demo data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="bg-primary/10 mx-auto flex size-12 items-center justify-center rounded-xl">
            <Building2 className="text-primary size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Permit Review Workflow</h1>
          <p className="text-muted-foreground text-sm">
            The governed backend under a public permit intake tool. Completeness,
            eligibility, and review-routing rules live in one versioned API layer.
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>{mode === "login" ? "Sign in" : "Register as an applicant"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Use a seeded account or register a new applicant."
                : "New accounts are always applicants. Staff roles are assigned by the program."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={onSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your name"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <button
              type="button"
              className="text-muted-foreground hover:text-foreground w-full text-center text-sm"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
            >
              {mode === "login"
                ? "Need an account? Register as an applicant"
                : "Have an account? Sign in"}
            </button>
          </CardContent>
        </Card>

        {mode === "login" && (
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="text-primary size-4" />
                Seeded accounts
              </CardTitle>
              <CardDescription>
                One click fills the form. Every seeded password is{" "}
                <code className="bg-muted rounded px-1 py-0.5">password123</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword("password123");
                    }}
                    className="border-border hover:bg-secondary/50 flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors"
                  >
                    <span>
                      <span className="font-medium">{a.label}</span>{" "}
                      <span className="text-muted-foreground">· {a.hint}</span>
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">{a.email}</span>
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={loadDemo}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
                Load demo data
              </Button>
              {seedMsg && <p className="text-sm text-emerald-400">{seedMsg}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
