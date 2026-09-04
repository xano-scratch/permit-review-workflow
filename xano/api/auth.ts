import { query, input, s, ref, inp, auth, expr, c } from "@xanots/sdk";
import { authGroup } from "./groups.js";
import { users } from "../tables/users.js";

/**
 * Self-serve registration. The role is FORCED to `applicant` in the stack, so a
 * resident signing up can never mint a reviewer or admin account — staff roles
 * are assigned out of band (in the seed here). The password comes in as text and
 * the f.password() column hashes it on write.
 */
export const signupQuery = query({
  name: "signup",
  verb: "POST",
  apiGroup: authGroup,
  input: {
    email: input.email({ required: true, methods: ["lower"] }),
    password: input.text({ required: true }),
    name: input.text({ required: true }),
  },
  stack: [
    s.db.has({ table: users, fieldName: "email", fieldValue: inp("email"), as: "taken" }),
    s.precondition({
      expr: expr(ref("taken"), "=", c.bool(false)),
      error: c.text("That email is already registered."),
      error_type: "badrequest",
    }),
    s.db.add({
      table: users,
      row: {
        email: inp("email"),
        password: inp("password"),
        name: inp("name"),
        role: "applicant", // forced — never trust a client-supplied role
      },
      as: "u",
    }),
    s.security.create_auth_token({ table: users, id: ref("u.id"), as: "token" }),
  ],
  response: {
    token: ref("token"),
    id: ref("u.id"),
    name: ref("u.name"),
    role: ref("u.role"),
  },
});

/**
 * Verify credentials and mint a token. The password column is access:"internal",
 * so the read names it in `output` to pull the hash; check_password compares the
 * submitted plaintext against it.
 */
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: authGroup,
  input: {
    email: input.email({ required: true, methods: ["lower"] }),
    password: input.text({ required: true }),
  },
  stack: [
    s.db.get({
      table: users,
      fieldName: "email",
      fieldValue: inp("email"),
      output: ["id", "email", "name", "role", "password"],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u", { safe: true }), "!=", c.null()),
      error: c.text("No account with that email."),
      error_type: "notfound",
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error: c.text("Incorrect password."),
      error_type: "unauthorized",
    }),
    s.security.create_auth_token({ table: users, id: ref("u.id"), as: "token" }),
  ],
  response: {
    token: ref("token"),
    id: ref("u.id"),
    name: ref("u.name"),
    role: ref("u.role"),
  },
});

/**
 * The current user, read from the auth token. The frontend derives what it may
 * show (the review queue, the action buttons) from `role` here, but the API
 * enforces it again on every protected endpoint regardless.
 */
export const meQuery = query({
  name: "me",
  verb: "GET",
  apiGroup: authGroup,
  auth: users,
  stack: [
    s.db.get({ table: users, fieldName: "id", fieldValue: auth("id"), as: "u" }),
  ],
  response: {
    id: ref("u.id"),
    name: ref("u.name"),
    email: ref("u.email"),
    role: ref("u.role"),
  },
});
