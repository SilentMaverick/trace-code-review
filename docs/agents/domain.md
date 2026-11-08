# Domain docs

Trace uses a multi-context layout. Before exploring a change, read `CONTEXT-MAP.md` and the context documents relevant to the code path. If a change crosses both areas, read both context documents.

Check `docs/adr/` for system-wide decisions and a context-specific `docs/adr/` folder if one exists. No ADRs are recorded yet. If a change resolves a durable architectural choice, propose an ADR rather than silently treating the implementation as a settled decision.

Use the terms and limits defined in the context documents. In particular, distinguish statically inferred references from runtime behavior: the map does not execute code.
