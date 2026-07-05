---
name: Session store in autoscale deployments
description: express-session MemoryStore silently breaks login in autoscale deploys; use a DB-backed store, but connect-pg-simple's auto table creation doesn't survive esbuild bundling.
---

`express-session`'s default `MemoryStore` is per-process. On `autoscale` deployment targets, requests can land on different instances/replicas than the one that created the session, so a login can succeed (200) while the very next authenticated request (e.g. `/me`) returns 401 as if the session never existed. `MemoryStore` also logs a production warning about leaking memory, which is a strong signal to check for this pattern.

**Why:** Autoscale can run multiple instances; server memory is not shared across them. Any stateful in-process store (sessions, caches, rate limiters) will behave inconsistently in production even though it works fine in the single dev workflow process.

**How to apply:** Back sessions with a shared store (e.g. the existing Postgres DB via `connect-pg-simple`) instead of the default MemoryStore whenever the app deploys to autoscale.

**Bundling gotcha:** `connect-pg-simple`'s `createTableIfMissing: true` reads a `table.sql` file from disk at runtime relative to its own module — this file is not included when the server is bundled into a single file via esbuild, causing a silent `ENOENT` error on every session write (session never persists, but login endpoint still returns 200). Fix: create the session table manually via SQL once, and set `createTableIfMissing: false`.
