import { table, f } from "@xanots/sdk";
import { users } from "./users.js";
import { permitTypes } from "./permit_types.js";

/**
 * One resident submission and its state. `status` is the state machine the
 * review endpoints move it through; `form_data` is the free-form answers the
 * frontend collected, checked against the permit type's required_fields and the
 * eligibility rules at the API layer.
 */
export const permitApplications = table({
  name: "permit_applications",
  schema: {
    applicant_id: f.tableRef(users, { required: true }),
    permit_type_id: f.tableRef(permitTypes, { required: true }),
    status: f.enum(
      ["draft", "submitted", "under_review", "needs_changes", "approved", "denied"],
      { required: true, default: "draft" },
    ),
    form_data: f.json(),
    submitted_at: f.timestamp({ nullable: true }),
    // Optional FK: a 0 sentinel means "not decided yet" (see fields.md — a null
    // in an f.tableRef is unqueryable, so 0 is the correct "unset" value).
    decided_by: f.tableRef(users, { default: 0 }),
    decided_at: f.timestamp({ nullable: true }),
  },
});
