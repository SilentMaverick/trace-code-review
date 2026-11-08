# Trace

Trace is a local-first codebase review prototype. It runs in a browser with no build step or backend. Uploaded text files are read in your browser and are not sent to a server.

## Run it

Open `index.html` directly, or serve the folder locally:

```powershell
python -m http.server 8765
```

Then open `http://127.0.0.1:8765`.

## Use it

- Upload a source folder using **Upload codebase**. The browser accepts supported source files up to 2 MB each.
- Select a file node to inspect functions, detected comments, and inferred connections. Drag nodes to arrange the map; drag the background to pan and use the controls or scroll to zoom.
- Switch between **Files** and **Functions** to see file imports or individual function call references. Click a line or function node to inspect the linked source and callers/callees.
- **Browse files & functions** opens a searchable index. Expand a file to inspect its functions, open the whole file, jump to a function, or open its source at the detected line.
- Use the moon/sun control to switch between light and dark themes. Your theme preference is saved in this browser.
- Select a finding to see its explanation and line location. **Open source & edit** opens a local editor; applying a change updates this review and downloads the changed file.
- **Export report** downloads a JSON summary.

## Scope

This prototype uses small JavaScript heuristics and regular expressions. It does not parse every language, resolve all imports, execute code, run tests, or prove that a flagged pattern is a bug. Map lines are inferred source references (imports or recognizable calls); they do not represent code that ran or a measured runtime path. Click a line to inspect its destination. “Supported files scanned” means every loaded supported file was passed through those heuristics; it does not measure bug detection coverage. Review every finding in context. Edits update the current browser review and download an individual file; they do not write directly into the original folder.

The initial sample code is fictional and exists to demonstrate the interface.
