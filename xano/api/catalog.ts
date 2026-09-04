import { query, s, ref, expr, col, c } from "@xanots/sdk";
import { catalogGroup } from "./groups.js";
import { permitTypes } from "../tables/permit_types.js";

/**
 * List the active permit types with their required fields, so the apply screen
 * can render the right form. Public: a resident browses what they can apply for
 * before signing in.
 */
export const permitTypesQuery = query({
  name: "permit-types",
  verb: "GET",
  apiGroup: catalogGroup,
  stack: [
    s.db.query({
      table: permitTypes,
      where: expr(col("active"), "=", c.bool(true)),
      sort: [{ sortBy: "name", dir: "asc" }],
      as: "rows",
    }),
  ],
  response: ref("rows"),
});
