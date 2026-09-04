import { table, f } from "@xanots/sdk";
import { permitTypes } from "./permit_types.js";

/**
 * The auditable checks a submission must pass, one row per rule. Rules are
 * versioned: a superseded rule stays in the table with `active: false`, so a
 * reviewer can always see WHICH version of a rule fired on a past decision.
 * Many rules belong to one permit_type.
 */
export const eligibilityRules = table({
  name: "eligibility_rules",
  schema: {
    permit_type_id: f.tableRef(permitTypes, { required: true }),
    version: f.int({ required: true, default: 1 }),
    active: f.bool({ required: true, default: true }),
    effective_from: f.timestamp(),
    // The stable rule key, e.g. "attendance_max".
    key: f.text({ required: true }),
    // The human sentence a reviewer reads, e.g. "Expected attendance is 500 or fewer".
    label: f.text({ required: true }),
    check_type: f.enum(["field_present", "min", "max", "equals", "in_set"], {
      required: true,
    }),
    // Which form_data key this rule tests.
    field: f.text({ required: true }),
    // Threshold / allowed values, e.g. { value: 500 } or { values: ["downtown"] }.
    config: f.json(),
  },
});
