import { query, s, ref, obj, c } from "@xanots/sdk";
import { seedGroup } from "./groups.js";
import { users } from "../tables/users.js";
import { permitTypes } from "../tables/permit_types.js";
import { eligibilityRules } from "../tables/eligibility_rules.js";
import { permitApplications } from "../tables/permit_applications.js";
import { reviewActions } from "../tables/review_actions.js";
import { evaluateApplication } from "../functions/evaluate.js";

/**
 * Idempotent demo seed. It truncates every table (resetting the id sequences),
 * then inserts a program admin, two reviewers, four applicants, three permit
 * types with a versioned rule set each, and a spread of applications across
 * every status, so the ephemeral is browsable on first load. The checked
 * applications are evaluated with the same evaluate_application function the live
 * endpoints use, so the seeded check results match what a reviewer would get by
 * running the checks by hand.
 *
 * It is intentionally open (no auth) so a reviewer opening a fresh ephemeral can
 * reload the demo data with one call. The environment is disposable.
 */
export const seedQuery = query({
  name: "run",
  verb: "POST",
  apiGroup: seedGroup,
  stack: [
    // Wipe child -> parent, resetting the id sequences so FKs are predictable.
    s.db.truncate({ table: reviewActions, reset: true }),
    s.db.truncate({ table: permitApplications, reset: true }),
    s.db.truncate({ table: eligibilityRules, reset: true }),
    s.db.truncate({ table: permitTypes, reset: true }),
    s.db.truncate({ table: users, reset: true }),

    // ── People ────────────────────────────────────────────────────────────
    s.db.add({ table: users, row: { email: "admin@city.gov", password: "password123", name: "Dana Reyes", role: "program_admin" }, as: "admin" }),
    s.db.add({ table: users, row: { email: "priya@city.gov", password: "password123", name: "Priya Shah", role: "reviewer" }, as: "rev1" }),
    s.db.add({ table: users, row: { email: "marco@city.gov", password: "password123", name: "Marco Diaz", role: "reviewer" }, as: "rev2" }),
    s.db.add({ table: users, row: { email: "alice@example.com", password: "password123", name: "Alice Nguyen", role: "applicant" }, as: "alice" }),
    s.db.add({ table: users, row: { email: "bob@example.com", password: "password123", name: "Bob Turner", role: "applicant" }, as: "bob" }),
    s.db.add({ table: users, row: { email: "carol@example.com", password: "password123", name: "Carol White", role: "applicant" }, as: "carol" }),
    s.db.add({ table: users, row: { email: "dave@example.com", password: "password123", name: "Dave Kim", role: "applicant" }, as: "dave" }),

    // ── Permit types ──────────────────────────────────────────────────────
    s.db.add({ table: permitTypes, row: { code: "block_party", name: "Block Party Permit", description: "Close a residential street for a neighborhood event.", required_fields: c.array(["event_date", "street", "expected_attendance", "cleanup_plan"]), active: true }, as: "bp" }),
    s.db.add({ table: permitTypes, row: { code: "home_solar", name: "Home Solar Installation", description: "Install rooftop solar on a single-family home.", required_fields: c.array(["property_address", "system_size_kw", "roof_type", "contractor_license"]), active: true }, as: "hs" }),
    s.db.add({ table: permitTypes, row: { code: "food_vendor", name: "Food Vendor Permit", description: "Operate a food cart or stand in a public zone.", required_fields: c.array(["business_name", "food_type", "location_zone", "health_cert_number"]), active: true }, as: "fv" }),

    // ── Eligibility rules (block party: a versioned attendance cap) ────────
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("bp.id"), version: 1, active: true, effective_from: c.now(), key: "event_date_present", label: "An event date is provided", check_type: "field_present", field: "event_date" } }),
    // v1 of the attendance cap is RETIRED (active:false) — kept for the audit history.
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("bp.id"), version: 1, active: false, effective_from: c.now(), key: "attendance_max", label: "Expected attendance is 300 or fewer", check_type: "max", field: "expected_attendance", config: c.obj({ value: 300 }) } }),
    // v2 is the ACTIVE attendance cap.
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("bp.id"), version: 2, active: true, effective_from: c.now(), key: "attendance_max", label: "Expected attendance is 500 or fewer", check_type: "max", field: "expected_attendance", config: c.obj({ value: 500 }) } }),
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("bp.id"), version: 1, active: true, effective_from: c.now(), key: "cleanup_plan_present", label: "A cleanup plan is described", check_type: "field_present", field: "cleanup_plan" } }),

    // ── Eligibility rules (home solar) ────────────────────────────────────
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("hs.id"), version: 1, active: true, effective_from: c.now(), key: "system_size_min", label: "System size is at least 1 kW", check_type: "min", field: "system_size_kw", config: c.obj({ value: 1 }) } }),
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("hs.id"), version: 1, active: true, effective_from: c.now(), key: "system_size_max", label: "System size is 20 kW or less", check_type: "max", field: "system_size_kw", config: c.obj({ value: 20 }) } }),
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("hs.id"), version: 1, active: true, effective_from: c.now(), key: "roof_type_allowed", label: "Roof type is supported", check_type: "in_set", field: "roof_type", config: c.obj({ values: ["asphalt", "metal", "tile"] }) } }),
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("hs.id"), version: 1, active: true, effective_from: c.now(), key: "contractor_license_present", label: "A contractor license number is provided", check_type: "field_present", field: "contractor_license" } }),

    // ── Eligibility rules (food vendor) ───────────────────────────────────
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("fv.id"), version: 1, active: true, effective_from: c.now(), key: "business_name_present", label: "A business name is provided", check_type: "field_present", field: "business_name" } }),
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("fv.id"), version: 1, active: true, effective_from: c.now(), key: "zone_allowed", label: "Location zone is permitted", check_type: "in_set", field: "location_zone", config: c.obj({ values: ["downtown", "park", "waterfront"] }) } }),
    s.db.add({ table: eligibilityRules, row: { permit_type_id: ref("fv.id"), version: 1, active: true, effective_from: c.now(), key: "health_cert_present", label: "A health certificate number is provided", check_type: "field_present", field: "health_cert_number" } }),

    // ── Application 1: DRAFT (alice, block party, still incomplete) ────────
    s.db.add({ table: permitApplications, row: { applicant_id: ref("alice.id"), permit_type_id: ref("bp.id"), status: "draft", form_data: c.obj({ event_date: "2026-09-12", street: "Maple Ave" }) } }),

    // ── Application 2: SUBMITTED (bob, home solar, complete & passing) ─────
    s.db.add({ table: permitApplications, row: { applicant_id: ref("bob.id"), permit_type_id: ref("hs.id"), status: "submitted", submitted_at: c.now(), form_data: c.obj({ property_address: "14 Oak St", system_size_kw: 8, roof_type: "asphalt", contractor_license: "CL-88213" }) }, as: "app_sub" }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_sub.id"), actor_id: ref("bob.id"), action: "submit", note: "Application submitted by the applicant." } }),

    // ── Application 3: UNDER_REVIEW, blocked (carol, food vendor, bad zone) ─
    s.db.add({ table: permitApplications, row: { applicant_id: ref("carol.id"), permit_type_id: ref("fv.id"), status: "under_review", submitted_at: c.now(), form_data: c.obj({ business_name: "Carol's Tacos", food_type: "tacos", location_zone: "suburb", health_cert_number: "HC-5521" }) }, as: "app_ur" }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_ur.id"), actor_id: ref("carol.id"), action: "submit", note: "Application submitted by the applicant." } }),
    s.function.run({ fn: evaluateApplication, input: { application_id: ref("app_ur.id") }, as: "eval_ur" }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_ur.id"), actor_id: ref("rev1.id"), action: "run_checks", rule_results: ref("eval_ur.results"), note: "Eligibility checks run by the reviewer." } }),

    // ── Application 4: NEEDS_CHANGES (dave, block party, over attendance) ──
    s.db.add({ table: permitApplications, row: { applicant_id: ref("dave.id"), permit_type_id: ref("bp.id"), status: "needs_changes", submitted_at: c.now(), form_data: c.obj({ event_date: "2026-10-03", street: "Cedar Rd", expected_attendance: 800, cleanup_plan: "Volunteers sweep the street and haul trash to the depot." }) }, as: "app_nc" }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_nc.id"), actor_id: ref("dave.id"), action: "submit", note: "Application submitted by the applicant." } }),
    s.function.run({ fn: evaluateApplication, input: { application_id: ref("app_nc.id") }, as: "eval_nc" }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_nc.id"), actor_id: ref("rev2.id"), action: "run_checks", rule_results: ref("eval_nc.results"), note: "Eligibility checks run by the reviewer." } }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_nc.id"), actor_id: ref("rev2.id"), action: "request_changes", note: "Expected attendance is over the cap. Please lower it or split the event." } }),

    // ── Application 5: APPROVED (bob, home solar, all passing) ─────────────
    s.db.add({ table: permitApplications, row: { applicant_id: ref("bob.id"), permit_type_id: ref("hs.id"), status: "approved", submitted_at: c.now(), decided_by: ref("rev1.id"), decided_at: c.now(), form_data: c.obj({ property_address: "9 Pine Ln", system_size_kw: 6, roof_type: "metal", contractor_license: "CL-90011" }) }, as: "app_ap" }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_ap.id"), actor_id: ref("bob.id"), action: "submit", note: "Application submitted by the applicant." } }),
    s.function.run({ fn: evaluateApplication, input: { application_id: ref("app_ap.id") }, as: "eval_ap" }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_ap.id"), actor_id: ref("rev1.id"), action: "run_checks", rule_results: ref("eval_ap.results"), note: "Eligibility checks run by the reviewer." } }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_ap.id"), actor_id: ref("rev1.id"), action: "approve", note: "All eligibility rules pass. Permit approved." } }),

    // ── Application 6: DENIED (carol, food vendor, passes but denied) ──────
    s.db.add({ table: permitApplications, row: { applicant_id: ref("carol.id"), permit_type_id: ref("fv.id"), status: "denied", submitted_at: c.now(), decided_by: ref("rev2.id"), decided_at: c.now(), form_data: c.obj({ business_name: "Downtown Dogs", food_type: "hot dogs", location_zone: "downtown", health_cert_number: "HC-3300" }) }, as: "app_dn" }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_dn.id"), actor_id: ref("carol.id"), action: "submit", note: "Application submitted by the applicant." } }),
    s.function.run({ fn: evaluateApplication, input: { application_id: ref("app_dn.id") }, as: "eval_dn" }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_dn.id"), actor_id: ref("rev2.id"), action: "run_checks", rule_results: ref("eval_dn.results"), note: "Eligibility checks run by the reviewer." } }),
    s.db.add({ table: reviewActions, row: { application_id: ref("app_dn.id"), actor_id: ref("rev2.id"), action: "deny", note: "The downtown zone is at vendor capacity for the season." } }),
  ],
  response: obj({
    ok: c.bool(true),
    message: c.text("Seed complete. Sign in with any seeded account; the password is password123."),
  }),
});
