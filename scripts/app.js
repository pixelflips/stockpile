// ---------------------------------------------------------
// Theme initialisation
// Read the saved preference (default: dark).
// Applied synchronously before paint to avoid FOUT.
// ---------------------------------------------------------
const saved = localStorage.getItem('stockpile-theme');
const initial = saved === 'light' ? 'light' : 'dark';

/**
 * setTheme — apply a theme and persist the choice.
 * @param {string} t - 'dark' | 'light'
 */
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('stockpile-theme', t);
}

setTheme(initial);

document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

// ── Data ──────────────────────────────────────────────
// SCAN_DATA is replaced by the stockpile scanner script on each run.
// When null, the empty state is shown.
// Do not edit the line below — the scanner targets it by exact match.
const SCAN_DATA = null;

// ── Package Manager Info ──────────────────────────────
// Shown in the grid heading when a type filter is active.

const MANAGER_INFO = {
  brew:  { name: 'Homebrew',        desc: 'The missing package manager for macOS — installs CLI tools and libraries.',         url: 'https://brew.sh' },
  cask:  { name: 'Homebrew Cask',   desc: 'Extends Homebrew to install macOS apps, fonts, and browser plugins.',              url: 'https://brew.sh' },
  npm:   { name: 'npm',             desc: 'The Node.js package manager. Global installs make CLI tools available system-wide.', url: 'https://www.npmjs.com' },
  pip:   { name: 'pip / PyPI',      desc: 'The Python package installer. Pulls libraries from the Python Package Index.',      url: 'https://pypi.org' },
  gem:   { name: 'RubyGems',        desc: 'The Ruby package manager. Gems are libraries and programs distributed for Ruby.',   url: 'https://rubygems.org' },
  cargo: { name: 'Cargo / crates.io', desc: 'The Rust package manager and build tool. Installs compiled Rust binaries.',      url: 'https://crates.io' },
  mas:   { name: 'Mac App Store',   desc: 'Apple\'s app distribution platform for macOS and iOS applications.',               url: 'https://apps.apple.com/us/genre/mac/id39' },
};
// ── State ─────────────────────────────────────────────
// Single source of truth for the application.
// All UI renders read from this object.
const state = {
  packages: [],      // full list from the loaded data envelope
  filtered: [],      // subset after filters + sort are applied
  selected: null,    // the currently selected package object (or null)
  activeType: null,      // active type pill, or null = show all (single-select)
  hideDefaults: true,    // when true, hides packages that ship with macOS
  query: '',         // current search string
  sort: 'az',        // 'az' | 'za'
};

// ── Data Loading ──────────────────────────────────────

/**
 * loadData — load a data envelope into state and trigger a full render.
 * Accepts { generated, host, packages[] }.
 * Gracefully handles missing or malformed fields.
 * @param {object} raw - The raw data envelope to load.
 */
function loadData(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.packages)) {
    state.packages = [];
    showEmptyState();
    return;
  }
  // Filter out entries missing a name
  state.packages = raw.packages.filter(p => p && p.name);
  hideEmptyState();
  applyFilters();
}

// ── Filtering & Sorting ───────────────────────────────

/**
 * applyFilters — filter and sort state.packages based on the current
 * query, activeType, hideDefaults, and sort order.
 * Updates state.filtered, then calls all render functions.
 */
function applyFilters() {
  let result = state.packages;

  // Hide system-default packages when the checkbox is checked
  if (state.hideDefaults) {
    result = result.filter(pkg => !pkg.default);
  }

  // Filter by active type (null = show all)
  if (state.activeType !== null) {
    result = result.filter(pkg => pkg.type === state.activeType);
  }

  // Filter by search query (case-insensitive substring on name + desc)
  if (state.query) {
    const q = state.query.toLowerCase();
    result = result.filter(pkg =>
      (pkg.name || '').toLowerCase().includes(q) ||
      (pkg.desc || '').toLowerCase().includes(q)
    );
  }

  // Sort — copy before sorting in place to avoid mutating upstream array
  result = [...result];
  if (state.sort === 'az') {
    result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (state.sort === 'za') {
    result.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  }

  state.filtered = result;

  // Clear selection if the selected package is no longer visible
  if (state.selected && !result.includes(state.selected)) {
    state.selected = null;
  }

  render();
  renderFilters();
  renderStats();
  renderDetail();
}

// ── Empty State Helpers ───────────────────────────────

/**
 * showEmptyState — reveal the empty-state panel and hide main content areas.
 * Called when no data is loaded or the data envelope is invalid.
 */
function showEmptyState() {
  const emptyState = document.getElementById('empty-state');
  const content = document.querySelector('.content');
  const filters = document.getElementById('filters');
  const headingRow = document.querySelector('.grid-heading-row');
  if (emptyState)  emptyState.removeAttribute('hidden');
  if (content)     content.setAttribute('hidden', '');
  if (filters)     filters.setAttribute('hidden', '');
  if (headingRow)  headingRow.setAttribute('hidden', '');
}

/**
 * hideEmptyState — hide the empty-state panel and show main content areas.
 * Called when a valid data envelope has been loaded.
 */
function hideEmptyState() {
  const emptyState = document.getElementById('empty-state');
  const content = document.querySelector('.content');
  const filters = document.getElementById('filters');
  const headingRow = document.querySelector('.grid-heading-row');
  if (emptyState)  emptyState.setAttribute('hidden', '');
  if (content)     content.removeAttribute('hidden');
  if (filters)     filters.removeAttribute('hidden');
  if (headingRow)  headingRow.removeAttribute('hidden');
}

// ── Render Helpers ────────────────────────────────────

/** Escape a string for safe HTML insertion. Prevents XSS from package descriptions. */
function esc(str) {
  if (!str) return '';
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

/**
 * setSelected — toggle the currently selected package.
 * Re-clicking the same card deselects it. Triggers grid + detail re-render.
 */
function setSelected(pkg) {
  state.selected = (state.selected === pkg) ? null : pkg;
  render();
  renderDetail();
}

/**
 * setQuery — update the search query and re-filter.
 * Called from the debounced search input handler.
 * @param {string} q - The new search string.
 */
function setQuery(q) {
  state.query = q;
  applyFilters();
}

/**
 * setSort — update the sort order and re-filter.
 * Accepts 'az' or 'za'.
 * @param {string} s - The sort key to apply.
 */
function setSort(s) {
  state.sort = s;
  applyFilters();
}

/**
 * setFilter — select a single package type filter.
 * Clicking the active type or 'all' clears the filter (shows everything).
 * @param {string} type - A type string (e.g. 'brew') or 'all'.
 */
function setFilter(type) {
  if (type === 'all' || state.activeType === type) {
    state.activeType = null;
  } else {
    state.activeType = type;
  }
  applyFilters();
}

/**
 * render — rebuild the package card grid from state.filtered.
 * Creates a card element for each package with click/keyboard handlers.
 * Shows "No packages match" if filters yield zero results.
 */
function render() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  if (state.filtered.length === 0 && state.packages.length > 0) {
    grid.innerHTML = '<p class="grid__empty">No packages match</p>';
    return;
  }

  state.filtered.forEach(pkg => {
    const card = document.createElement('article');
    card.className = 'card' + (pkg === state.selected ? ' card--selected' : '');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${pkg.name} — ${pkg.type}`);

    card.innerHTML = `
      <div class="card__header">
        <span class="card__name">${esc(pkg.name)}</span>
        <span class="badge badge--${esc(pkg.type)}">${esc(pkg.type)}</span>
        ${pkg.default ? '<span class="card__system">system</span>' : ''}
      </div>
      ${pkg.version ? `<div class="card__version">${esc(pkg.version)}</div>` : ''}
      ${pkg.desc ? `<div class="card__desc">${esc(pkg.desc)}</div>` : ''}
    `;

    card.addEventListener('click', () => setSelected(pkg));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSelected(pkg);
      }
    });

    grid.appendChild(card);
  });
}

/**
 * renderFilters — rebuild the type-filter pill row and source toggle.
 * Pills act as single-select tabs: clicking a type selects only that type;
 * clicking it again (or "all") clears the filter. Followed by a separator
 * and a hide-system-defaults toggle if any defaults are present.
 */
function renderFilters() {
  const container = document.getElementById('filters');
  container.innerHTML = '';

  // Count packages per type from the full (unfiltered) list
  const counts = {};
  let defaultCount = 0;
  state.packages.forEach(pkg => {
    counts[pkg.type] = (counts[pkg.type] || 0) + 1;
    if (pkg.default) defaultCount++;
  });

  const types = Object.keys(counts).sort();
  const total = state.packages.length;
  const allActive = state.activeType === null;
  // "all" pill
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-pill' + (allActive ? ' filter-pill--active' : '');
  allBtn.textContent = `all (${total})`;
  allBtn.setAttribute('aria-label', `Show all packages (${total})`);
  allBtn.setAttribute('aria-pressed', String(allActive));
  allBtn.addEventListener('click', () => setFilter('all'));
  container.appendChild(allBtn);

  // Per-type pills
  types.forEach(type => {
    const isActive = state.activeType === type;
    const btn = document.createElement('button');
    btn.className = 'filter-pill' + (isActive ? ' filter-pill--active' : '');
    btn.textContent = `${type} (${counts[type]})`;
    btn.setAttribute('aria-label', `Filter by ${type} (${counts[type]} packages)`);
    btn.setAttribute('aria-pressed', String(isActive));
    btn.addEventListener('click', () => setFilter(type));
    container.appendChild(btn);
  });

  // Update the heading above the grid
  const heading = document.getElementById('grid-heading');
  const activeInfo = state.activeType ? MANAGER_INFO[state.activeType] : null;
  if (activeInfo) {
    heading.innerHTML =
      `<span class="grid-heading__name">${activeInfo.name}</span>` +
      `<span class="grid-heading__desc">${activeInfo.desc}</span>` +
      `<a class="grid-heading__link" href="${activeInfo.url}" target="_blank" rel="noopener">↗ ${new URL(activeInfo.url).hostname}</a>`;
  } else {
    const total = state.filtered.length;
    const label = total === 1 ? 'package' : 'packages';
    heading.innerHTML =
      `<span class="grid-heading__name">Field report — your machine</span>` +
      `<span class="grid-heading__desc">${total} ${label} catalogued — select one to view details</span>`;
  }

  // Only show the "hide defaults" toggle if there are any default packages
  if (defaultCount > 0) {
    const sep = document.createElement('span');
    sep.className = 'filter-separator';
    sep.setAttribute('aria-hidden', 'true');
    container.appendChild(sep);

    const toggle = document.createElement('label');
    toggle.className = 'filter-toggle' + (state.hideDefaults ? ' filter-toggle--active' : '');
    toggle.setAttribute('aria-label', `Hide ${defaultCount} system defaults`);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.hideDefaults;
    checkbox.addEventListener('change', () => {
      state.hideDefaults = checkbox.checked;
      applyFilters();
    });

    const track = document.createElement('span');
    track.className = 'filter-toggle__track';

    toggle.appendChild(checkbox);
    toggle.appendChild(track);
    toggle.appendChild(document.createTextNode(`hide macOS defaults`));
    container.appendChild(toggle);
  }
}

/**
 * renderStats — update the header stats summary.
 * Shows "N packages · M managers" in the header.
 */
function renderStats() {
  const el = document.getElementById('stats');
  const total = state.packages.length;
  const types = new Set(state.packages.map(p => p.type)).size;
  el.textContent = total > 0
    ? `${total} packages · ${types} manager${types !== 1 ? 's' : ''}`
    : '';
}

// ── Detail Panel Helpers ──────────────────────────────

/**
 * getTypeNote — return educational context about a package type.
 * Explains where the package came from, how the manager works,
 * and practical tips for working with it.
 * @param {string} type - Package type key (e.g. 'brew', 'npm').
 * @returns {string} Explanation string, or empty string if type is unknown.
 */
function getTypeNote(type) {
  const notes = {
    brew: 'Installed via Homebrew, the most popular macOS package manager. Homebrew downloads source or pre-built bottles and symlinks binaries into /usr/local/bin (Intel) or /opt/homebrew/bin (Apple Silicon). Run "brew update && brew upgrade" periodically to keep everything current.',
    cask: 'Installed via Homebrew Cask, which extends Homebrew to manage macOS desktop apps. Casks install .app bundles into /Applications just like drag-and-drop installs, but let you manage them from the terminal. Unlike formulae, casks do not auto-update — run "brew upgrade --cask" to check for new versions.',
    npm: 'Installed globally via npm, the Node.js package manager. Global packages provide CLI commands available anywhere in your terminal. They live in a shared directory alongside your Node installation. Tip: most npm packages work better installed locally per-project (npm install --save-dev) to avoid version conflicts.',
    pip: 'Installed via pip, the Python package manager. Global pip packages are available to any Python script on your system. For project work, use virtual environments (python3 -m venv .venv) to isolate dependencies — this prevents one project\'s packages from breaking another.',
    gem: 'A Ruby gem installed on your system. macOS ships with a built-in Ruby and a set of default gems. Gems you install yourself go into the system gem directory. For project work, use Bundler (bundle install) to manage gems per-project and avoid version conflicts with the system Ruby.',
    cargo: 'Installed via Cargo, the Rust package manager and build tool. "cargo install" compiles Rust packages from source and places the binaries in ~/.cargo/bin. These are standalone executables with no runtime dependencies. Update with "cargo install" again — it will rebuild from the latest version.',
    mas: 'Installed from the Mac App Store. The "mas" CLI lets you manage App Store apps from the terminal — useful for scripting your setup or keeping a record of what you\'ve installed. Updates are handled by macOS automatically, or you can run "mas upgrade" to check manually.'
  };
  return notes[type] || '';
}

/**
 * getInstallPath — return the filesystem install path for a package.
 * Paths for brew/cask show both Apple Silicon and Intel variants.
 * @param {object} pkg - Package object with at least { name, type }.
 * @returns {string} Path string (may contain newlines), or empty string.
 */
function getInstallPath(pkg) {
  const paths = {
    brew: `/opt/homebrew/Cellar/${pkg.name}   (Apple Silicon)\n/usr/local/Cellar/${pkg.name}   (Intel)`,
    cask: `/opt/homebrew/Caskroom/${pkg.name}   (Apple Silicon)\n/usr/local/Caskroom/${pkg.name}   (Intel)`,
    npm: `$(npm root -g)/${pkg.name}`,
    pip: `$(python3 -m pip show ${pkg.name} | grep Location)`,
    gem: `$(gem environment gemdir)/gems/${pkg.name}`,
    cargo: `~/.cargo/bin/${pkg.name}`,
    mas: '/Applications/'
  };
  return paths[pkg.type] || '';
}

/**
 * getBinaryPath — return the binary/executable path for a package.
 * Only applicable to types that install CLI tools (not cask or mas).
 * @param {object} pkg - Package object with at least { name, type }.
 * @returns {string} Path string (may contain newlines), or empty string.
 */
function getBinaryPath(pkg) {
  const paths = {
    brew: `/opt/homebrew/bin/${pkg.name}  (Apple Silicon)\n/usr/local/bin/${pkg.name}  (Intel)`,
    npm: `$(npm bin -g)/${pkg.name}`,
    pip: `$(python3 -m pip show ${pkg.name} | grep Location)/bin/${pkg.name}`,
    gem: `$(gem environment gemdir)/bin/${pkg.name}`,
    cargo: `~/.cargo/bin/${pkg.name}`,
  };
  return paths[pkg.type] || '';
}

/**
 * getCommands — return the list of common CLI commands for a package.
 * Each entry has a label (e.g. 'upgrade') and a cmd string.
 * Optional note provides additional context for unusual commands.
 * @param {object} pkg - Package object with at least { name, type }.
 * @returns {Array<{label: string, cmd: string, note?: string}>}
 */
function getCommands(pkg) {
  const n = pkg.name;
  const commands = {
    brew: [
      { label: 'info', cmd: `brew info ${n}` },
      { label: 'upgrade', cmd: `brew upgrade ${n}` },
      { label: 'uninstall', cmd: `brew uninstall ${n}` },
      { label: 'deps', cmd: `brew deps ${n}` },
    ],
    cask: [
      { label: 'info', cmd: `brew info --cask ${n}` },
      { label: 'upgrade', cmd: `brew upgrade --cask ${n}` },
      { label: 'uninstall', cmd: `brew uninstall --cask ${n}` },
    ],
    npm: [
      { label: 'info', cmd: `npm info ${n}` },
      { label: 'update', cmd: `npm update -g ${n}` },
      { label: 'uninstall', cmd: `npm uninstall -g ${n}` },
    ],
    pip: [
      { label: 'info', cmd: `pip3 show ${n}` },
      { label: 'upgrade', cmd: `pip3 install --upgrade ${n}` },
      { label: 'uninstall', cmd: `pip3 uninstall ${n}` },
    ],
    gem: [
      { label: 'info', cmd: `gem info ${n}` },
      { label: 'update', cmd: `gem update ${n}` },
      { label: 'uninstall', cmd: `gem uninstall ${n}` },
    ],
    cargo: [
      { label: 'update', cmd: `cargo install ${n}`, note: 'Reinstalls latest version' },
      { label: 'uninstall', cmd: `cargo uninstall ${n}` },
    ],
    mas: [
      { label: 'search', cmd: `mas search ${n}` },
      { label: 'upgrade all', cmd: 'mas upgrade' },
    ],
  };
  return commands[pkg.type] || [];
}

/**
 * getHelpLinks — return an array of relevant documentation links for a package.
 * Each entry has a label and url. mas packages have no registry links.
 * @param {object} pkg - Package object with at least { name, type }.
 * @returns {Array<{label: string, url: string}>}
 */
function getHelpLinks(pkg) {
  const n = pkg.name;
  const links = {
    brew: [{ label: 'Homebrew Formulae', url: `https://formulae.brew.sh/formula/${n}` }],
    cask: [{ label: 'Homebrew Casks', url: `https://formulae.brew.sh/cask/${n}` }],
    npm: [{ label: 'npm', url: `https://www.npmjs.com/package/${n}` }],
    pip: [{ label: 'PyPI', url: `https://pypi.org/project/${n}` }],
    gem: [{ label: 'RubyGems', url: `https://rubygems.org/gems/${n}` }],
    cargo: [{ label: 'crates.io', url: `https://crates.io/crates/${n}` }],
    mas: [],
  };
  return links[pkg.type] || [];
}

/**
 * closeDetail — animate the dialog out then close it natively.
 * The dialog's CSS plays `detail-out` while the class is present,
 * then `dialog.close()` removes the [open] attribute.
 */
function closeDetail() {
  const dialog = document.getElementById('detail');
  if (!dialog.open) return;
  dialog.classList.add('detail--closing');
  dialog.addEventListener('animationend', () => {
    dialog.classList.remove('detail--closing');
    dialog.close();
    state.selected = null;
    render(); // deselect the active card highlight
  }, { once: true });
}

/**
 * renderDetail — update the detail dialog for the currently selected package.
 * Renders name, type badge, version, description, type explanation,
 * install/binary paths, commands table, help links, and action buttons.
 * Opens the dialog if not already open; updates content in place when switching packages.
 */
function renderDetail() {
  const dialog = document.getElementById('detail');
  if (!state.selected) { if (dialog.open) closeDetail(); return; }

  const pkg = state.selected;
  const installPath = getInstallPath(pkg);
  const binaryPath = getBinaryPath(pkg);
  const commands = getCommands(pkg);
  const links = getHelpLinks(pkg);
  const typeNote = getTypeNote(pkg.type);

  const commandRows = commands.map(c =>
    `<tr><td class="detail__cmd-label">${esc(c.label)}</td><td class="detail__cmd-code"><code>${esc(c.cmd)}</code></td></tr>${c.note ? `<tr><td colspan="2" class="detail__cmd-note">${esc(c.note)}</td></tr>` : ''}`
  ).join('');

  const linkItems = links.map(l =>
    `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="detail__link">${esc(l.label)}</a>`
  ).join('');

  dialog.innerHTML = `
    <button class="detail__close" aria-label="Close">✕</button>
    <div class="detail__section detail__header">
      <div class="detail__title-row">
        <span class="detail__name">${esc(pkg.name)}</span>
        <span class="badge badge--${esc(pkg.type)}">${esc(pkg.type)}</span>
        ${pkg.default ? '<span class="card__system">system</span>' : ''}
      </div>
      ${pkg.version ? `<div class="detail__version">${esc(pkg.version)}</div>` : ''}
      ${pkg.desc ? `<div class="detail__desc">${esc(pkg.desc)}</div>` : ''}
    </div>
    ${typeNote ? `<div class="detail__section"><h3 class="detail__section-title">What is this?</h3><p class="detail__text">${esc(typeNote)}</p></div>` : ''}
    ${installPath ? `<div class="detail__section"><h3 class="detail__section-title">Install location</h3><pre class="detail__path">${esc(installPath)}</pre></div>` : ''}
    ${binaryPath ? `<div class="detail__section"><h3 class="detail__section-title">Binary</h3><pre class="detail__path">${esc(binaryPath)}</pre></div>` : ''}
    ${commands.length ? `<div class="detail__section"><h3 class="detail__section-title">Commands</h3><table class="detail__commands">${commandRows}</table></div>` : ''}
    ${links.length ? `<div class="detail__section"><h3 class="detail__section-title">Help & docs</h3><div class="detail__links">${linkItems}</div></div>` : ''}
    <div class="detail__section detail__footer">
      <button class="detail__copy-btn detail__copy-name" aria-label="Copy package name">copy name</button>
    </div>
  `;

  // Open the dialog if it isn't already (switching packages updates content in place)
  if (!dialog.open) dialog.showModal();

  dialog.querySelector('.detail__close').addEventListener('click', closeDetail);
  dialog.querySelector('.detail__copy-name').addEventListener('click', () => copyToClipboard(pkg.name));
}

/**
 * copyToClipboard — write text to the system clipboard.
 * On success, triggers the visual copy feedback toast.
 * Silently ignores clipboard permission errors.
 * @param {string} text - The text to copy.
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showCopyFeedback()).catch(() => {});
}

/**
 * showCopyFeedback — display a brief "Copied!" toast notification.
 * Creates the toast element on first call and reuses it thereafter.
 * The toast auto-hides after 1500ms. Rapid successive calls reset the timer.
 */
function showCopyFeedback() {
  let toast = document.getElementById('copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copy-toast';
    toast.className = 'copy-toast';
    toast.textContent = 'Copied!';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.classList.remove('copy-toast--visible');
  void toast.offsetWidth;
  toast.classList.add('copy-toast--visible');
  clearTimeout(showCopyFeedback._timer);
  showCopyFeedback._timer = setTimeout(() => {
    toast.classList.remove('copy-toast--visible');
  }, 1500);
}

// ── Init ──────────────────────────────────────────────

/**
 * init — entry point called once the DOM is ready.
 * Loads SCAN_DATA if present, otherwise shows the empty state.
 */
function init() {
  if (SCAN_DATA && typeof SCAN_DATA === 'object' && Array.isArray(SCAN_DATA.packages)) {
    loadData(SCAN_DATA);
  } else {
    showEmptyState();
  }

  // Search input — debounced at 150ms
  const searchInput = document.getElementById('search-input');
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      setQuery(searchInput.value.trim());
    }, 150);
  });

  // Sort select
  document.getElementById('sort-select').addEventListener('change', (e) => {
    setSort(e.target.value);
  });

  const dialog = document.getElementById('detail');

  // Escape key — intercept native cancel so we can animate out first
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDetail();
  });

  // Click on ::backdrop — fires on the dialog element when outside content bounds
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDetail();
  });
}

document.addEventListener('DOMContentLoaded', init);
