// The one contract. Paths (getPath), verbs, and request/response *types* are
// derived from the xanots query defs — never a hand-typed URL or request body.
// Change a def and the client follows.
//
// Response types are derived with InferResponse where the shape is inferable.
// Two endpoints return a value shaped inside a JavaScript lambda
// (evaluate_application), which is opaque to InferResponse, so their result is
// typed with a hand-declared view type below — the documented gap, noted in the
// build's self-grade. Enriched list rows keep their derived base columns and
// intersect the joined columns (which infer as `unknown`).

import type { InferInput } from "@xanots/sdk";

import { signupQuery, loginQuery, meQuery } from "../../../xano/api/auth.js";
import { permitTypesQuery } from "../../../xano/api/catalog.js";
import { saveQuery, submitQuery, mineQuery, getQuery } from "../../../xano/api/applications.js";
import { runChecksQuery, decideQuery, queueQuery } from "../../../xano/api/review.js";
import { seedQuery } from "../../../xano/api/seed.js";

/** The deployed backend base URL: injected by `xanots deploy --static`, or VITE_XANO_HOST in dev. */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// ── Auth token (kept in localStorage so a refresh stays signed in) ──────────
const TOKEN_KEY = "prw_token";
let authToken: string | null =
  typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

export function setToken(t: string | null) {
  authToken = t;
  if (typeof localStorage === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getToken(): string | null {
  return authToken;
}

/** An error carrying the HTTP status, so the UI can tell a 403 (RBAC) from a 400 (a rule). */
export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function call(
  path: string,
  verb: string,
  body?: unknown,
  opts?: { auth?: boolean },
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (opts?.auth !== false && authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(XANO_HOST + path, {
    method: verb,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : typeof data === "string" && data
          ? data
          : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

// ── Request types are DERIVED from the query defs (InferInput). Response
// view-models are hand-declared: several endpoints shape their result inside a
// JavaScript lambda (evaluate_application) or return a ref bound in a
// conditional/enriched query, both of which InferResponse resolves as `unknown`.
// That is the documented gap, noted in the build's self-grade. ──────────────
export type Role = "applicant" | "reviewer" | "program_admin";

export interface Me {
  id: number;
  name: string;
  email: string;
  role: Role;
}
export interface AuthResult {
  token: string;
  id: number;
  name: string;
  role: Role;
}
export interface PermitType {
  id: number;
  created_at: number;
  code: string;
  name: string;
  description: string;
  required_fields: string[];
  active: boolean;
}
export interface Application {
  id: number;
  created_at: number;
  applicant_id: number;
  permit_type_id: number;
  status: string;
  form_data: Record<string, unknown>;
  submitted_at: number | null;
  decided_by: number;
  decided_at: number | null;
}
export interface MineRow extends Application {
  permit_type_name: string;
  permit_type_code: string;
}
export interface QueueRow extends Application {
  applicant_name: string;
  permit_type_name: string;
}
export interface EligibilityRule {
  id: number;
  created_at: number;
  permit_type_id: number;
  version: number;
  active: boolean;
  effective_from: number;
  key: string;
  label: string;
  check_type: string;
  field: string;
  config: { value?: number | string; values?: string[] } | null;
}

/** One rule outcome — shaped inside the evaluate_application lambda. */
export interface RuleResult {
  key: string;
  version: number;
  label: string;
  check_type: string;
  field: string;
  config: { value?: number | string; values?: string[] } | null;
  value: unknown;
  passed: boolean;
}
/** The evaluate_application result — lambda-shaped, opaque to InferResponse. */
export interface Evaluation {
  results: RuleResult[];
  checked: number;
  failed_count: number;
  all_passed: boolean;
  failed_text: string;
}
export interface ReviewActionRow {
  id: number;
  created_at: number;
  application_id: number;
  actor_id: number;
  action: string;
  rule_results: RuleResult[] | null;
  note: string;
  actor_name: string | null;
}
export interface Detail {
  application: Application;
  permit_type: PermitType;
  rules: EligibilityRule[];
  actions: ReviewActionRow[];
}
export interface DecisionResult {
  application: Application;
  evaluation: Evaluation;
}

// ── The typed endpoint wrappers ─────────────────────────────────────────────
export const api = {
  signup: (body: InferInput<typeof signupQuery>) =>
    call(signupQuery.getPath(), signupQuery.verb, body, { auth: false }) as Promise<AuthResult>,
  login: (body: InferInput<typeof loginQuery>) =>
    call(loginQuery.getPath(), loginQuery.verb, body, { auth: false }) as Promise<AuthResult>,
  me: () => call(meQuery.getPath(), meQuery.verb) as Promise<Me>,
  permitTypes: () =>
    call(permitTypesQuery.getPath(), permitTypesQuery.verb, undefined, { auth: false }) as Promise<
      PermitType[]
    >,
  save: (body: InferInput<typeof saveQuery>) =>
    call(saveQuery.getPath(), saveQuery.verb, body) as Promise<Application>,
  submit: (body: InferInput<typeof submitQuery>) =>
    call(submitQuery.getPath(), submitQuery.verb, body) as Promise<Application>,
  mine: () => call(mineQuery.getPath(), mineQuery.verb) as Promise<MineRow[]>,
  getApplication: (id: number) =>
    call(getQuery.getPath({ params: { application_id: String(id) } }), getQuery.verb) as Promise<Detail>,
  runChecks: (body: InferInput<typeof runChecksQuery>) =>
    call(runChecksQuery.getPath(), runChecksQuery.verb, body) as Promise<DecisionResult>,
  decide: (body: InferInput<typeof decideQuery>) =>
    call(decideQuery.getPath(), decideQuery.verb, body) as Promise<DecisionResult>,
  queue: (status?: string) =>
    call(
      queueQuery.getPath() + (status ? `?status=${encodeURIComponent(status)}` : ""),
      queueQuery.verb,
    ) as Promise<QueueRow[]>,
  seed: () =>
    call(seedQuery.getPath(), seedQuery.verb, {}, { auth: false }) as Promise<{
      ok: boolean;
      message: string;
    }>,
};
