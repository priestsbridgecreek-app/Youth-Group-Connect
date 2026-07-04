---
  name: React Hook Form watch() vs coerce schemas
  description: form.watch() returns raw uncoerced field values, not the zod-coerced type — comparing against a typed source (e.g. numeric IDs) needs explicit normalization.
  ---

  When a Zod schema uses `z.coerce.number()` on a field but the underlying input (e.g. a shadcn Select) sets the raw string value via `field.onChange(val)`, `form.watch("field")` returns the raw string, NOT the coerced number — coercion only happens at submit/validation time via the resolver.

  **Why:** Led to a silent bug where `activities?.find(a => a.id === watchedId)` never matched (number !== string), causing a derived "selected activity" reference panel to never render, even though the underlying form value was otherwise correct.

  **How to apply:** When deriving UI state from a watched field that will later be coerced by a Zod resolver, normalize both sides for comparison, e.g. `a.id.toString() === watchedId?.toString()`, rather than assuming `form.watch` matches the resolved type.
  