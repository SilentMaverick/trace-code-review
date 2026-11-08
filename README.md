# Trace

Trace is a local-first codebase review app. It runs in a browser with no build step or application backend. Uploaded text files stay in the browser unless you explicitly connect GitHub and choose to push them.

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
- Select a finding to see its explanation and line location. **Open source & edit** opens a local editor; applying a change updates the in-browser review.
- **Download codebase** saves the reviewed files as a ZIP, preserving their folder paths. **Export report** saves a JSON summary.
- **Connect GitHub** accepts a fine-grained personal access token, lists repositories the token can access, and can import source files. Choose a destination repository and use **Push N files** to create a commit on that repository's default branch. Matching files in a destination repository are replaced after an in-app confirmation; other repository files are preserved.

## Scope

The GitHub token remains in tab memory only and is cleared on reload or disconnect. Use a fine-grained token limited to selected repositories with Metadata read and Contents read/write. When GitHub is connected, the token is sent to `api.github.com` for repository reads and the explicit push action; Trace does not store it or send it to an application server.

This app uses small JavaScript heuristics and regular expressions. It does not parse every language, resolve all imports, execute code, run tests, or prove that a flagged pattern is a bug. Map lines are inferred source references (imports or recognizable calls); they do not represent code that ran or a measured runtime path. Click a line to inspect its destination. “Supported files scanned” means every loaded supported file was passed through those heuristics; it does not measure bug detection coverage. Review every finding in context. Edits update the current browser review; download a ZIP or explicitly push to a selected GitHub branch to save changes outside the tab.

The initial sample code is fictional and exists to demonstrate the interface.
