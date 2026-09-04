import { query, input, s, ref, inp, auth, or, expr, col, c, withFilters, fl } from "@xanots/sdk";
import { reviewGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { permitTypes } from "../tables/permit_types.js";
import { permitApplications } from "../tables/permit_applications.js";
import { reviewActions } from "../tables/review_actions.js";
import { evaluateApplication } from "../functions/evaluate.js";

/**
 * Reviewer-or-admin only. Loads the ACTIVE eligibility rules for the
 * application's permit type, evaluates each against form_data (through the shared
 * evaluate_application function), records a `run_checks` action with the per-rule
 * pass/fail and the rule version that fired, and moves the status to
 * `under_review`. The role guard is a precondition, so an applicant forcing this
 * call gets a 403.
 */
export const runChecksQuery = query({
  name: "run-checks",
  verb: "POST",
  apiGroup: reviewGroup,
  auth: users,
  input: { application_id: input.int({ required: true }) },
  stack: [
    s.db.get({ table: users, fieldName: "id", fieldValue: auth("id"), as: "me" }),
    s.precondition({
      expr: or(
        expr(ref("me.role"), "=", c.text("reviewer")),
        expr(ref("me.role"), "=", c.text("program_admin")),
      ),
      error: c.text("Only reviewers can run eligibility checks."),
      error_type: "accessdenied",
    }),
    s.db.get({
      table: permitApplications,
      fieldName: "id",
      fieldValue: inp("application_id"),
      as: "app",
    }),
    s.precondition({
      expr: expr(ref("app", { safe: true }), "!=", c.null()),
      error: c.text("Application not found."),
      error_type: "notfound",
    }),
    s.function.run({
      fn: evaluateApplication,
      input: { application_id: inp("application_id") },
      as: "eval",
    }),
    s.db.add({
      table: reviewActions,
      row: {
        application_id: inp("application_id"),
        actor_id: auth("id"),
        action: "run_checks",
        rule_results: ref("eval.results"),
        note: "Eligibility checks run by the reviewer.",
      },
    }),
    s.db.edit({
      table: permitApplications,
      fieldName: "id",
      fieldValue: inp("application_id"),
      row: { status: "under_review" },
      as: "app2",
    }),
  ],
  response: { application: ref("app2"), evaluation: ref("eval") },
});

/**
 * Reviewer-or-admin only. Records a decision: `request_changes`, `approve`, or
 * `deny`. The key governed rule: an application CANNOT be approved while any
 * active eligibility rule is failing. The gate re-runs the same evaluate function
 * and refuses the approve with a 400 that names the failing rule and its version,
 * so the rule outcome, not the reviewer's discretion, controls the approval.
 */
export const decideQuery = query({
  name: "decide",
  verb: "POST",
  apiGroup: reviewGroup,
  auth: users,
  input: {
    application_id: input.int({ required: true }),
    decision: input.enum(["request_changes", "approve", "deny"], { required: true }),
    note: input.text({ default: "" }),
  },
  stack: [
    s.db.get({ table: users, fieldName: "id", fieldValue: auth("id"), as: "me" }),
    s.precondition({
      expr: or(
        expr(ref("me.role"), "=", c.text("reviewer")),
        expr(ref("me.role"), "=", c.text("program_admin")),
      ),
      error: c.text("Only reviewers can decide an application."),
      error_type: "accessdenied",
    }),
    s.db.get({
      table: permitApplications,
      fieldName: "id",
      fieldValue: inp("application_id"),
      as: "app",
    }),
    s.precondition({
      expr: expr(ref("app", { safe: true }), "!=", c.null()),
      error: c.text("Application not found."),
      error_type: "notfound",
    }),
    s.function.run({
      fn: evaluateApplication,
      input: { application_id: inp("application_id") },
      as: "eval",
    }),
    // The approve-gate: refuse an approval while any active rule fails.
    s.conditional({
      when: expr(inp("decision"), "=", c.text("approve")),
      then: [
        s.precondition({
          expr: expr(ref("eval.all_passed"), "=", c.bool(true)),
          error: withFilters(
            c.text("Cannot approve while an eligibility rule is failing: "),
            fl.concat(ref("eval.failed_text")),
          ),
          error_type: "badrequest",
        }),
      ],
    }),
    // Map the decision to the new status.
    s.switch({
      on: inp("decision"),
      cases: [
        { when: c.text("approve"), body: [s.set_var("new_status", c.text("approved"))], break: true },
        { when: c.text("deny"), body: [s.set_var("new_status", c.text("denied"))], break: true },
        {
          when: c.text("request_changes"),
          body: [s.set_var("new_status", c.text("needs_changes"))],
          break: true,
        },
      ],
    }),
    s.db.edit({
      table: permitApplications,
      fieldName: "id",
      fieldValue: inp("application_id"),
      row: {
        status: ref("new_status"),
        decided_by: auth("id"),
        decided_at: c.now(),
      },
      as: "app2",
    }),
    s.db.add({
      table: reviewActions,
      row: {
        application_id: inp("application_id"),
        actor_id: auth("id"),
        action: inp("decision"),
        rule_results: ref("eval.results"),
        note: inp("note"),
      },
    }),
  ],
  response: { application: ref("app2"), evaluation: ref("eval") },
});

/**
 * Reviewer-or-admin only. The review queue: applications filtered by status
 * (default the open statuses `submitted` + `under_review`), newest first, each
 * with the applicant name and permit type. The role guard is enforced here, so
 * the queue is unreadable by an applicant no matter what the frontend renders.
 */
export const queueQuery = query({
  name: "queue",
  verb: "GET",
  apiGroup: reviewGroup,
  auth: users,
  input: { status: input.text({ default: "" }) },
  stack: [
    s.db.get({ table: users, fieldName: "id", fieldValue: auth("id"), as: "me" }),
    s.precondition({
      expr: or(
        expr(ref("me.role"), "=", c.text("reviewer")),
        expr(ref("me.role"), "=", c.text("program_admin")),
      ),
      error: c.text("Only reviewers can read the review queue."),
      error_type: "accessdenied",
    }),
    s.conditional({
      when: expr(inp("status"), "!=", c.text("")),
      then: [
        s.db.query({
          table: permitApplications,
          where: expr(col("status"), "=", inp("status")),
          bind: [
            { table: users, as: "applicant", join: "left", where: expr(col("applicant_id"), "=", col("applicant.id")) },
            { table: permitTypes, as: "ptype", join: "left", where: expr(col("permit_type_id"), "=", col("ptype.id")) },
          ],
          eval: [
            { name: "applicant.name", as: "applicant_name" },
            { name: "ptype.name", as: "permit_type_name" },
          ],
          sort: [{ sortBy: "created_at", dir: "desc" }],
          as: "rows",
        }),
      ],
      else: [
        s.db.query({
          table: permitApplications,
          where: or(
            expr(col("status"), "=", c.text("submitted")),
            expr(col("status"), "=", c.text("under_review")),
          ),
          bind: [
            { table: users, as: "applicant", join: "left", where: expr(col("applicant_id"), "=", col("applicant.id")) },
            { table: permitTypes, as: "ptype", join: "left", where: expr(col("permit_type_id"), "=", col("ptype.id")) },
          ],
          eval: [
            { name: "applicant.name", as: "applicant_name" },
            { name: "ptype.name", as: "permit_type_name" },
          ],
          sort: [{ sortBy: "created_at", dir: "desc" }],
          as: "rows",
        }),
      ],
    }),
  ],
  response: ref("rows"),
});
