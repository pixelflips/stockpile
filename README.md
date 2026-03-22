# stockpile

A local-first macOS package explorer. Scans installed packages across 7 managers and displays them in a visual dashboard. Built for developers who want a quick inventory of everything installed on their machine.

<!-- screenshot goes here -->

## Quick start

1. Clone the repo
2. Run `./stockpile`
3. Done -- your browser opens with the dashboard

## Flags

| Flag     | Description                                      |
|----------|--------------------------------------------------|
| `--fast` | Skip brew description lookups for a faster scan. |

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

## Sample data

Open `index.html` directly in a browser (without running the script) to see 47 built-in sample packages. Useful for previewing the UI or working on the frontend.

## Mine vs system

The scanner detects which Ruby gems shipped with macOS and which you installed yourself. Default gems are marked with a "system" label on their cards, and you can filter by source using the "mine / system" toggle in the filter bar.

## How it works

The `stockpile` bash script scans each package manager, collects the results into a JSON array, injects that JSON into `scripts/app.js`, and opens `index.html` in your default browser. No server, no build step.

## Requirements

- macOS
- python3 (ships with Xcode Command Line Tools -- install via `xcode-select --install`)
- Optional: `mas` (Mac App Store CLI), `cargo` (Rust toolchain)

## Contributing

Contributions are welcome. Open an issue or submit a pull request. Keep changes focused and minimal.

## License

MIT
