# stockpile

Know what's in your arsenal.

Every package you've ever installed, catalogued in a browser-based dossier you can search, filter, and interrogate. No more jumping between package managers to find something your AI agent quietly installed three deploys ago.

One command. No server. Runs entirely on your machine.

<!-- screenshot goes here -->

## Quick start

```bash
git clone https://github.com/pixelflips/stockpile
cd stockpile
./stockpile
```

Your dossier opens automatically in the browser.

## Flags

| Flag     | Description                                      |
|----------|--------------------------------------------------|
| `--fast` | Skip package description lookups for a faster scan. |

## Package types

| Type    | Source                |
|---------|-----------------------|
| `brew`  | Homebrew formulae     |
| `cask`  | Homebrew casks        |
| `npm`   | Global npm packages   |
| `pip`   | Python packages       |
| `gem`   | Ruby gems             |
| `cargo` | Rust binaries         |
| `mas`   | Mac App Store apps    |

## Requirements

- macOS
- python3 (ships with Xcode Command Line Tools — install via `xcode-select --install`)

**Optional — install these to include their packages in your inventory:**

- `cargo` — install via [rustup](https://rustup.rs/) for Rust binaries
- `mas` — install via `brew install mas` for Mac App Store apps. You must also be signed into the App Store. Without it, the MAS section is skipped silently.

## Sample data

Open `index.html` directly in a browser (without running the script) to see 47 built-in sample packages. Useful for previewing the UI or working on the frontend.

## System gems

The scanner detects which Ruby gems shipped with macOS and marks them with a "system" label on their cards. When default gems are present, a **hide macOS defaults** checkbox appears in the filter bar to remove them from view.

## How it works

The `stockpile` bash script scans each package manager, assembles the results into a JSON array, and injects it into `scripts/app.js`. Then it opens `index.html` in your default browser. No server, no build step.

## Contributing

Open an issue or submit a pull request. Keep changes focused and minimal.

## License

MIT
