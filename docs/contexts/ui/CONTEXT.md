# Interface context

Trace's interface is a static browser app. The primary user flow is to load supported text files, browse the file and function map, inspect a finding and its source, edit in the browser, and download the changed file or a JSON report.

## User-facing concepts

- The **Files** map groups detected source files and import relationships.
- The **Functions** map shows detected functions and statically inferred call references.
- **Browse files & functions** searches the loaded file list and opens a file or function source location.
- The source editor changes only the in-memory review, then downloads the selected file. It does not write back into the uploaded directory.

Uploads are read in the browser; there is no application backend or upload endpoint. Theme preference is stored in browser local storage. Keep privacy and the distinction between local edits and downloaded files clear in interface copy.
