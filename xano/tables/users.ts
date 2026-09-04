import { table, f } from "@xanots/sdk";

/**
 * The single auth-table. One account per person, with a `role` column that
 * drives every access decision. There is no row-level security here: the role
 * is read inside each protected endpoint and checked with `s.precondition`, so
 * authorization lives in the API layer where a reviewer can read it.
 */
export const users = table({
  name: "users",
  auth: true, // backs authentication (Authorization: Bearer <token>)
  schema: {
    email: f.email({ required: true }),
    // Password hashes on write. Take the submission as input.text on signup AND
    // login so it is not double-hashed (see the auth endpoints).
    password: f.password({ required: true }),
    name: f.text({ required: true }),
    role: f.enum(["applicant", "reviewer", "program_admin"], {
      required: true,
      default: "applicant",
    }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
});
