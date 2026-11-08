# Interface context

Trace's interface is a static browser app. The primary user flow is to load supported text files or import a GitHub repository, browse the file and function map, inspect a finding and its source, edit in the browser, then download a ZIP or explicitly push to GitHub.

## User-facing concepts

- The **Files** map groups detected source files and import relationships.
- The **Functions** map shows detected functions and statically inferred call references.
- **Browse files & functions** searches the loaded file list and opens a file or function source location.
- The source editor changes only the in-memory review. The user can download the reviewed project as a ZIP or explicitly push changed files to a selected GitHub repository.

Local uploads are read in the browser; there is no application backend or upload endpoint. GitHub access is an explicit connection using a fine-grained token held only in tab memory. GitHub reads and pushes go directly from the browser to GitHub's API. Theme preference is stored in browser local storage. Keep privacy, token handling, and the distinction between local edits and synced files clear in interface copy.
