import { apiGroup } from "@xanots/sdk";

/**
 * The API groups. Each pins a `canonical` slug so the public path is stable and
 * `getPath()` resolves in the browser bundle without a lock file. The slugs are
 * prefixed with `permit_` because a canonical is unique across the whole Xano
 * instance, and these apps share one.
 */
export const authGroup = apiGroup({ name: "auth", canonical: "permit_auth" });
export const catalogGroup = apiGroup({ name: "catalog", canonical: "permit_catalog" });
export const applicationsGroup = apiGroup({
  name: "applications",
  canonical: "permit_apps",
});
export const reviewGroup = apiGroup({ name: "review", canonical: "permit_review" });
export const seedGroup = apiGroup({ name: "seed", canonical: "permit_seed" });
