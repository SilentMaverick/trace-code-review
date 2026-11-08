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
- Select a finding to see its explanation and line location. **Open source & edit** opens a local editor; applying a change updates this review and downloads the changed file.
- **Export report** downloads a JSON summary.

## Scope

This prototype uses small JavaScript heuristics and regular expressions. It does not parse every language, resolve all imports, execute code, run tests, or prove that a flagged pattern is a bug. The relationship map is inferred from recognizable imports and function calls. “Supported files scanned” means every loaded supported file was passed through those heuristics; it does not measure bug detection coverage. Review every finding in context. Edits update the current browser review and download an individual file; they do not write directly into the original folder.

The initial sample code is fictional and exists to demonstrate the interface.
