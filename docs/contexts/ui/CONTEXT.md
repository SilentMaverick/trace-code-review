# Interface context

Trace's interface is a static browser app. The primary user flow is to load supported text files or import a GitHub repository, browse the file and function map, inspect a finding and its source, edit in the browser, then download a ZIP or explicitly push to GitHub.

## User-facing concepts

- The **Files** map groups detected source files and import relationships. The full-page map adds room to inspect and reposition nodes, open source for editing, and record workspace notes.
- The **Functions** map shows detected functions and statically inferred call references. Scroll pans the map, Ctrl+scroll zooms, and dragging moves the canvas or a node.
- **Browse files & functions** searches the loaded file list and opens a file or function source location in a wider, consistently indented tree.
- The source editor changes only the in-memory review. The user can download the reviewed project as a ZIP or explicitly push changed files to a selected GitHub repository.

Local uploads are read in the browser; there is no application backend or upload endpoint. GitHub access is an explicit connection using a fine-grained token held only in tab memory. GitHub reads and pushes go directly from the browser to GitHub's API. Theme preference and full-map notes are stored in browser local storage, with notes scoped to the current workspace. Keep privacy, token handling, and the distinction between local edits and synced files clear in interface copy.
