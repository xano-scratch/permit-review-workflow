import { query, input, s, ref, inp, auth, obj, and, or, expr, col, c, withFilters, fl } from "@xanots/sdk";
import { applicationsGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { permitTypes } from "../tables/permit_types.js";
import { permitApplications } from "../tables/permit_applications.js";
import { eligibilityRules } from "../tables/eligibility_rules.js";
import { reviewActions } from "../tables/review_actions.js";

/**
 * Create or update a DRAFT application. `application_id` 0 (the default) creates
 * a new draft owned by the caller; a positive id updates an existing one, but
 * only if the caller owns it and it is still a draft. A permit type that is not
 * active is rejected. The ownership guard lives here, in the API, not in the UI.
 */
export const saveQuery = query({
  name: "save",
  verb: "POST",
  apiGroup: applicationsGroup,
  auth: users,
  input: {
    application_id: input.int({ default: 0 }),
    permit_type_id: input.int({ required: true }),
    form_data: input.json(),
  },
  stack: [
    s.db.get({
      table: permitTypes,
      fieldName: "id",
      fieldValue: inp("permit_type_id"),
      as: "ptype",
    }),
    s.precondition({
      expr: expr(ref("ptype", { safe: true }), "!=", c.null()),
      error: c.text("Unknown permit type."),
      error_type: "notfound",
    }),
    s.precondition({
      expr: expr(ref("ptype.active"), "=", c.bool(true)),
      error: c.text("That permit type is not accepting applications."),
      error_type: "badrequest",
    }),
    s.conditional({
      when: expr(inp("application_id"), ">", c.int(0)),
      then: [
        s.db.get({
          table: permitApplications,
          fieldName: "id",
          fieldValue: inp("application_id"),
          as: "existing",
        }),
        s.precondition({
          expr: expr(ref("existing", { safe: true }), "!=", c.null()),
          error: c.text("Application not found."),
          error_type: "notfound",
        }),
        s.precondition({
          expr: expr(ref("existing.applicant_id"), "=", auth("id")),
          error: c.text("You can only edit your own application."),
          error_type: "accessdenied",
        }),
        s.precondition({
          expr: expr(ref("existing.status"), "=", c.text("draft")),
          error: c.text("Only a draft can be edited."),
          error_type: "badrequest",
        }),
        s.db.edit({
          table: permitApplications,
          fieldName: "id",
          fieldValue: inp("application_id"),
          row: { permit_type_id: inp("permit_type_id"), form_data: inp("form_data") },
          as: "app",
        }),
      ],
      else: [
        s.db.add({
          table: permitApplications,
          row: {
            applicant_id: auth("id"),
            permit_type_id: inp("permit_type_id"),
            status: "draft",
            form_data: inp("form_data"),
          },
          as: "app",
        }),
      ],
    }),
  ],
  response: ref("app"),
});

/**
 * Submit a draft. This runs the COMPLETENESS check at the API layer: every key
 * in the permit type's required_fields must be present in form_data. An
 * incomplete submit is refused with a 400 that names the missing fields, and the
 * status stays `draft`. On pass it moves to `submitted`, stamps submitted_at,
 * and writes a `submit` action to the audit trail.
 */
export const submitQuery = query({
  name: "submit",
  verb: "POST",
  apiGroup: applicationsGroup,
  auth: users,
  input: { application_id: input.int({ required: true }) },
  stack: [
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
    s.precondition({
      expr: expr(ref("app.applicant_id"), "=", auth("id")),
      error: c.text("You can only submit your own application."),
      error_type: "accessdenied",
    }),
    s.precondition({
      expr: expr(ref("app.status"), "=", c.text("draft")),
      error: c.text("This application has already been submitted."),
      error_type: "badrequest",
    }),
    s.db.get({
      table: permitTypes,
      fieldName: "id",
      fieldValue: ref("app.permit_type_id"),
      as: "ptype",
    }),
    s.lambda({
      as: "check",
      code: ({ $var }) => {
        const v: any = $var;
        const required: any[] = (v.ptype && v.ptype.required_fields) || [];
        const form: any = (v.app && v.app.form_data) || {};
        const missing = required.filter((k: string) => {
          const x = form[k];
          return x === undefined || x === null || x === "";
        });
        return {
          missing,
          complete: missing.length === 0,
          missing_text: missing.join(", "),
        };
      },
    }),
    s.precondition({
      expr: expr(ref("check.complete"), "=", c.bool(true)),
      error: withFilters(
        c.text("This application is missing required fields: "),
        fl.concat(ref("check.missing_text")),
      ),
      error_type: "badrequest",
    }),
    s.db.edit({
      table: permitApplications,
      fieldName: "id",
      fieldValue: inp("application_id"),
      row: { status: "submitted", submitted_at: c.now() },
      as: "app2",
    }),
    s.db.add({
      table: reviewActions,
      row: {
        application_id: inp("application_id"),
        actor_id: auth("id"),
        action: "submit",
        note: "Application submitted by the applicant.",
      },
    }),
  ],
  response: ref("app2"),
});

/**
 * The caller's own applications, newest first, each enriched with its permit
 * type name for the list. Filtered to `applicant_id == auth id` in the query, so
 * a resident only ever sees their own.
 */
export const mineQuery = query({
  name: "mine",
  verb: "GET",
  apiGroup: applicationsGroup,
  auth: users,
  stack: [
    s.db.query({
      table: permitApplications,
      where: expr(col("applicant_id"), "=", auth("id")),
      bind: [
        {
          table: permitTypes,
          as: "ptype",
          join: "left",
          where: expr(col("permit_type_id"), "=", col("ptype.id")),
        },
      ],
      eval: [
        { name: "ptype.name", as: "permit_type_name" },
        { name: "ptype.code", as: "permit_type_code" },
      ],
      sort: [{ sortBy: "created_at", dir: "desc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});

/**
 * One application in full: the answers, the permit type, the active eligibility
 * rules that apply, and the whole review_actions trail (with actor names). An
 * applicant may read only their own; a reviewer or admin may read any. That
 * ownership rule is enforced HERE, so forcing the request as an applicant on
 * someone else's application gets a 403, not just a hidden button.
 */
export const getQuery = query({
  name: "get/{application_id}",
  verb: "GET",
  apiGroup: applicationsGroup,
  auth: users,
  input: { application_id: input.int({ required: true }) },
  stack: [
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
    s.db.get({ table: users, fieldName: "id", fieldValue: auth("id"), as: "me" }),
    s.precondition({
      expr: or(
        expr(ref("app.applicant_id"), "=", auth("id")),
        expr(ref("me.role"), "=", c.text("reviewer")),
        expr(ref("me.role"), "=", c.text("program_admin")),
      ),
      error: c.text("You can only view your own application."),
      error_type: "accessdenied",
    }),
    s.db.get({
      table: permitTypes,
      fieldName: "id",
      fieldValue: ref("app.permit_type_id"),
      as: "ptype",
    }),
    s.db.query({
      table: eligibilityRules,
      where: and(
        expr(col("permit_type_id"), "=", ref("app.permit_type_id")),
        expr(col("active"), "=", c.bool(true)),
      ),
      sort: [{ sortBy: "created_at", dir: "asc" }],
      as: "rules",
    }),
    s.db.query({
      table: reviewActions,
      where: expr(col("application_id"), "=", inp("application_id")),
      bind: [
        {
          table: users,
          as: "actor",
          join: "left",
          where: expr(col("actor_id"), "=", col("actor.id")),
        },
      ],
      eval: [{ name: "actor.name", as: "actor_name" }],
      sort: [{ sortBy: "created_at", dir: "asc" }],
      as: "actions",
    }),
  ],
  response: obj({
    application: ref("app"),
    permit_type: ref("ptype"),
    rules: ref("rules"),
    actions: ref("actions"),
  }),
});
