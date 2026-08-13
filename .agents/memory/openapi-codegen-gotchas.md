---
name: OpenAPI codegen gotchas
description: Constraints on lib/api-spec/openapi.yaml to keep Orval/zod codegen working
---

- Never use `type: integer` in request bodies or responses. It generates `zod.int()`, which only exists in zod v4; with zod 3.x installed the generated code fails to compile. Use `type: number` everywhere.
  **Why:** the generator targets zod v4 APIs regardless of the installed zod version.
  **How to apply:** whenever editing the OpenAPI spec, before running codegen.
- Avoid path params whose generated param-type name collides with a query-param type (duplicate `*Params` exports → TS2308). Prefer query params.
