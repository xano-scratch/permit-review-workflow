import { table, f } from "@xanots/sdk";

/**
 * The kinds of permit a resident can apply for. `required_fields` is the list
 * of form_data keys an application must fill in, which the submit endpoint uses
 * for its completeness check and the apply screen uses to render the form.
 */
export const permitTypes = table({
  name: "permit_types",
  schema: {
    code: f.text({ required: true }),
    name: f.text({ required: true }),
    description: f.text(),
    // A json array of field keys, e.g. ["event_date","street","cleanup_plan"].
    required_fields: f.json(),
    active: f.bool({ required: true, default: true }),
  },
  index: [{ type: "unique", fields: [{ name: "code" }] }],
});
