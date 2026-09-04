import { defineFunction, input, s, ref, inp, and, expr, col, c } from "@xanots/sdk";
import { permitApplications } from "../tables/permit_applications.js";
import { eligibilityRules } from "../tables/eligibility_rules.js";

/**
 * The one eligibility engine. Given an application id, it loads the ACTIVE
 * eligibility rules for the application's permit type and evaluates each one
 * against the free-form `form_data`. Both `review/run-checks` and
 * `review/decide` call this through `s.function.run`, so the rule set that gates
 * an approval is the exact same code a reviewer sees on a check run. Centralizing
 * this is the whole point: the rule lives in one governed place, not copied into
 * a frontend that an AI builder regenerated.
 *
 * The evaluation itself is a single JavaScript body. A rule names its `field`
 * key at runtime and applies one of five operators to the value at that key,
 * which the typed statement surface cannot express, so this is a legitimate
 * lambda escape hatch. The body is written defensively so it can never throw (a
 * throwing lambda would return its error text with HTTP 200).
 *
 * Callers MUST confirm the application exists before calling this (they all load
 * and precondition the app first), so `ref("app.permit_type_id")` is safe.
 */
export const evaluateApplication = defineFunction({
  name: "evaluate_application",
  input: { application_id: input.int({ required: true }) },
  stack: [
    s.db.get({
      table: permitApplications,
      fieldName: "id",
      fieldValue: inp("application_id"),
      as: "app",
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
    s.lambda({
      as: "evaluation",
      code: ({ $var }) => {
        const v: any = $var;
        const form: any = (v.app && v.app.form_data) || {};
        const rules: any[] = v.rules || [];
        const results = rules.map((r: any) => {
          const cfg: any = r.config || {};
          const raw = form[r.field];
          const present = raw !== undefined && raw !== null && raw !== "";
          let passed = false;
          switch (r.check_type) {
            case "field_present":
              passed = present;
              break;
            case "min":
              passed = present && Number(raw) >= Number(cfg.value);
              break;
            case "max":
              passed = present && Number(raw) <= Number(cfg.value);
              break;
            case "equals":
              passed = present && String(raw) === String(cfg.value);
              break;
            case "in_set":
              passed =
                present &&
                Array.isArray(cfg.values) &&
                cfg.values.map(String).includes(String(raw));
              break;
            default:
              passed = false;
          }
          return {
            key: r.key,
            version: r.version,
            label: r.label,
            check_type: r.check_type,
            field: r.field,
            config: cfg,
            value: present ? raw : null,
            passed,
          };
        });
        const failed = results.filter((x: any) => !x.passed);
        return {
          results,
          checked: results.length,
          failed_count: failed.length,
          all_passed: failed.length === 0,
          // "attendance_max v2, zone_allowed v1" — the failing rules, named with
          // their version, for the approve-gate error message.
          failed_text: failed.map((x: any) => `${x.key} v${x.version}`).join(", "),
        };
      },
    }),
  ],
  response: ref("evaluation"),
});
