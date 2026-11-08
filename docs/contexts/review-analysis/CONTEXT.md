# Review analysis context

The review analysis currently runs in `app.js` in the browser. It recognizes a subset of function declarations and uses regular-expression heuristics to find selected risk and maintainability patterns.

## Relationship map

Function call links are inferred by matching recognizable names in a function's source section. File links are inferred from recognizable imports. These edges describe possible source references; they do not execute code or prove a runtime path. The current parser is not language-complete, and matches can be missed or be false positives.

## Findings

Findings are potential issues with a severity, category, source path, line, and explanation. They are triage leads, not confirmed defects. Always inspect the surrounding source and verify behavior before changing code. The app does not run tests, type-checkers, a compiler, or the uploaded program.

When extending the analyzer, keep its limits visible, tie findings to source locations, and avoid implying measured coverage or runtime verification.
