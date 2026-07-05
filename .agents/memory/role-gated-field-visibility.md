---
name: Role-gated field visibility pattern
description: How to add a user-record field that only certain roles (e.g. leader/presidency) may see or edit, never the record owner or plain members.
---

When a field must be invisible to the record's own owner (not just to other roles), don't rely on the UI alone.

**Rule:** Strip the field server-side from JSON responses based on the *viewer's* role (not the target user's), in both list and single-item GET handlers. Only allow the PATCH/update handler to write the field when the viewer role is in the allowed set — this is independent from whatever self-vs-other edit rules exist for other fields.

**Why:** A UI-only hide can still leak the value via API inspection (network tab), and "leader can edit own record" logic conflicts with "leader must never see this field on their own profile" — so gating must be by (viewer role) x (whose profile is being viewed is irrelevant), enforced at the API layer.

**How to apply:** In the youth-group app pattern, this meant adding a `sanitizeUserForViewer(user, viewerRole)` helper applied to every GET response, plus a separate permission check in PATCH restricted to presidency/leader for that one field, while leaving name-edit permissions untouched. On the frontend, the shared profile-card component takes an explicit `viewerCanManageSacramentExclusion` boolean prop passed by the parent page (never inferred inside the component), and the "own settings" page always passes `false` regardless of the viewer's actual role.
