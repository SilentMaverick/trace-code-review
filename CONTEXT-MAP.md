# Context map

Trace is a local-first browser app with two useful areas of domain context:

- [Interface context](docs/contexts/ui/CONTEXT.md): upload and browsing flows, map interactions, theme, source editing, and report export.
- [Review analysis context](docs/contexts/review-analysis/CONTEXT.md): source ingestion, function recognition, inferred references, findings, and analyzer limits.

The current implementation is a small static app, so these are conceptual boundaries within the same codebase rather than separate packages. Read both when a change crosses the UI and review behavior. Read `docs/adr/` for system-wide decisions and context-specific `docs/adr/` folders if they are added later.
