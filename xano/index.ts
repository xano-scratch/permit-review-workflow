import { workspace } from "@xanots/sdk";

import { users } from "./tables/users.js";
import { permitTypes } from "./tables/permit_types.js";
import { eligibilityRules } from "./tables/eligibility_rules.js";
import { permitApplications } from "./tables/permit_applications.js";
import { reviewActions } from "./tables/review_actions.js";

import {
  authGroup,
  catalogGroup,
  applicationsGroup,
  reviewGroup,
  seedGroup,
} from "./api/groups.js";

import { evaluateApplication } from "./functions/evaluate.js";

import { signupQuery, loginQuery, meQuery } from "./api/auth.js";
import { permitTypesQuery } from "./api/catalog.js";
import { saveQuery, submitQuery, mineQuery, getQuery } from "./api/applications.js";
import { runChecksQuery, decideQuery, queueQuery } from "./api/review.js";
import { seedQuery } from "./api/seed.js";

/**
 * The Permit Review Workflow backend.
 *
 * The governed backend under a public permit intake tool. Residents apply for a
 * permit and staff review it, but the completeness check, the versioned
 * eligibility rules, and the review-routing (role) rules all live here, in one
 * versioned API layer, with API-layer RBAC. A fast-built government frontend
 * cannot skip a required check or let the wrong reviewer decide, because those
 * rules are enforced in the endpoints, not in the UI.
 */
export default workspace("permit-review-workflow")
  .registerTables([
    users,
    permitTypes,
    eligibilityRules,
    permitApplications,
    reviewActions,
  ])
  .registerApiGroups([
    authGroup,
    catalogGroup,
    applicationsGroup,
    reviewGroup,
    seedGroup,
  ])
  .registerFunctions([evaluateApplication])
  .registerQueries([
    signupQuery,
    loginQuery,
    meQuery,
    permitTypesQuery,
    saveQuery,
    submitQuery,
    mineQuery,
    getQuery,
    runChecksQuery,
    decideQuery,
    queueQuery,
    seedQuery,
  ]);
