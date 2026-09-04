import { table, f } from "@xanots/sdk";
import { users } from "./users.js";
import { permitApplications } from "./permit_applications.js";

/**
 * An append-only audit trail. Every step an application goes through is one row
 * here, never updated after it is written, so a reviewer or an auditor can read
 * the whole history: who submitted, who ran the checks (with the per-rule
 * results and the exact rule version that fired), and who decided.
 */
export const reviewActions = table({
  name: "review_actions",
  schema: {
    application_id: f.tableRef(permitApplications, { required: true }),
    actor_id: f.tableRef(users, { required: true }),
    action: f.enum(
      ["submit", "run_checks", "request_changes", "approve", "deny"],
      { required: true },
    ),
    // On a run_checks action: the per-rule pass/fail, each with the rule key and
    // the rule version that was evaluated.
    rule_results: f.json(),
    note: f.text(),
  },
});
