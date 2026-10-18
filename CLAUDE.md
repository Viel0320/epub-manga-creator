# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

EPUB Manga Creator V3 is a browser-based single-page app that packages manga/comic images into EPUB 3.0 (fixed-layout, Japanese manga format). The EPUB is generated entirely client-side without any backend server.

- **Homepage**: `https://viel0320.github.io/epub-manga-creator/`
- **Tech stack**: React 19, TypeScript, MobX 6, Vite 8, Bootstrap 5.3 (CDN), light/dark themes (follows system by default)
- **Package Manager**: pnpm (`pnpm@11.18.0`)

## Commands

```bash
pnpm start          # Vite dev server
pnpm build          # tsc type-check then vite build
pnpm preview        # Vite preview of production build
```

There is no test runner configured.

## Format & Standard Support

### Import Capabilities
- **Direct Images**: PNG, JPEG, WebP, AVIF, GIF. Image types are identified via magic bytes (`detectImageMime` in `src/utils/epub-parser.ts`, used by the ZIP import in `components/nav/actions.tsx`).
- **Archive Packages**: ZIP archives (decompressed via `JSZip`, auto-detecting image MIME types).
- **EPUB Re-import & Parser**: Full dual EPUB 2 & EPUB 3 parser (`src/utils/epub-parser.ts`). Compatible with EPUB 3 HTML Nav (`<nav epub:type="toc">`) and `properties="cover-image"` as well as EPUB 2 NCX (`toc.ncx` / `<navMap>`) and `<meta name="cover">` / `<guide>` legacy references. Re-importing an EPUB replaces the whole workspace and asks for confirmation first (`confirm.importEpubReplace`).

### EPUB 3.0 Output Compliance
- **Specification**: EPUB 3.0 Fixed-Layout (Japanese manga standard).
- **Metadata**: Embedded `fixed-layout-jp:viewport`, `rendition:viewport`, and `RegionMagnification` tags (`template/standard.opf.ts`, width/height filled by `opf-builder.ts`).
- **ZIP OCF Compliance**: Strictly uncompressed `mimetype` as the very first ZIP entry to pass standard EPUB validators.
- **Rendering Modes**:
  - SVG Image Tag: `<svg><image/></svg>` (default)
  - HTML Image Tag: `<img/>`
- **Page Fit Modes**: `contain` (fit), `cover` (crop), `fill` (stretch). Controls SVG `preserveAspectRatio` and CSS `object-fit`.

## Architecture & Code Structure

### Dependencies
- **UI & State**: React 19, MobX 6, MobX React 9, lucide-react (icons).
- **Build & Utility**: Vite 8, TypeScript 7, JSZip (zip creation/extract), Native IndexedDB (`src/utils/db.ts`), PostCSS + Autoprefixer (`postcss.config.js`).
- `pnpm-workspace.yaml` carries `allowBuilds: esbuild: true`; keep it when copying install inputs (e.g. Docker builds).

### Directory Structure & Responsibilities

```
src/
├── index.tsx            # Entry: renders App lazy-loaded under Suspense (code splitting)
├── App.tsx              # Root composition: I18nProvider + Workspace/Lightbox/Overlay/Toast/Loading
├── components/          # React UI Components
│   ├── workspace/       # Publishing workspace shell (replaces former header + modals)
│   │   ├── Workspace.tsx          # App shell: sidebar tabs, import menu, primary actions
│   │   ├── WorkspacePanels.tsx    # Four tab panels; pages panel embeds the main grid
│   │   ├── PageInspector.tsx      # Selected-page tools drawer (pages panel)
│   │   └── WorkspaceControls.tsx  # Theme & language toggles (header tools)
│   ├── editors/         # Tabbed metadata forms (migrated from former modal/)
│   │   ├── BookEditor.tsx       # Book metadata & presets (was ModalBook)
│   │   ├── ContentsEditor.tsx   # TOC rows, generation & presets (was ModalContents)
│   │   └── LayoutEditor.tsx     # Page size, fit, direction (was ModalPage)
│   ├── ui/              # Shared UI primitives
│   │   ├── select.tsx   # Themed listbox dropdown (replaces native <select>)
│   │   ├── combobox.tsx # Themed editable dropdown; value is a space-separated multi-entry list
│   │   └── overlay.tsx  # OverlayContainer: themed confirm/prompt/alert (replaces window dialogs)
│   ├── main.tsx         # Page grid viewer & double-page spread layout (pages panel canvas)
│   ├── lightbox.tsx     # Fullscreen interactive reader & preview overlay
│   ├── toast.tsx        # Toast notification system
│   ├── icon.tsx         # lucide-react registry (name → LucideIcon map)
│   ├── common/          # Shared generic components
│   │   └── VirtualList.tsx # Windowed list (ContentsEditor's TOC rows)
│   └── nav/actions.tsx  # Shared import pipeline + single source of nav actions
├── hooks/               # React hooks
│   └── usePageDrag.ts   # Pointer drag & drop for page cards (mouse + touch, edge auto-scroll)
├── services/            # Core Business Services
│   ├── epub-builder/    # Modular EPUB Generation Engine
│   │   ├── index.ts     # Main packager orchestrator
│   │   ├── opf-builder.ts # Standard OPF manifest generator
│   │   ├── page-builder.ts# XHTML page renderer
│   │   ├── toc-builder.ts # Navigation XHTML generator
│   │   ├── types.ts     # EPUB Builder domain interfaces
│   │   └── utils.ts     # XML/HTML escaping (htmlToEscape) & template interpolation (fillTemplate)
│   └── workspace-persistence.ts # IndexedDB workspace snapshot saver/restorer
├── store/               # MobX State Management Stores
│   ├── main.ts          # Central orchestrator singleton (StoreMain)
│   ├── book.ts          # Metadata & page list store
│   ├── contents.ts      # Table of contents store
│   ├── blobs.ts         # Image Blob & memory URL store
│   ├── ui.ts            # UI states: workspace tabs, theme, toasts, reader & overlay state
│   └── undo.ts          # Single-level undo snapshot (pages, contents, pageSize, blobs)
├── template/            # EPUB XHTML, OPF, and CSS Templates
├── utils/               # Helper Utilities
│   ├── epub-parser.ts   # EPUB import & extraction parser
│   ├── toc-generator.ts # Auto TOC generation algorithms
│   ├── page-layout.ts   # Spread calculation & alignment layout math
│   ├── page-size.ts     # Shared page-size presets & effective size math (A5 = A4 × 1/√2)
│   ├── db.ts            # Raw IndexedDB wrapper
│   ├── date-normalizer.ts # Date format normalization
│   ├── version.ts       # APP_VERSION read from package.json
│   └── get-uuid.ts      # crypto.randomUUID with RFC 4122 v4 fallback
```

### State Management & Persistence (MobX + IndexedDB)
- `store/main.ts` (`storeMain`) is the primary orchestrator that coordinates cross-store mutations.
- **Auto Workspace Recovery**: `src/services/workspace-persistence.ts` automatically saves current workspace state and image Blobs to IndexedDB (`src/utils/db.ts`), restoring them upon app startup.
- **Restore banner** (`RestorePrompt` in `main.tsx`): when an unsaved backup exists on startup, one full-width action offers to restore it. There is deliberately no dismiss-only button — the backup is consumed by restoring, or the banner disappears on its own once a new import activates auto-save.
- `localStorage` handles persistent UI settings (`EPUB_CREATOR_SAVED_SETS_BOOK`, `EPUB_CREATOR_LANG`, etc.).

### Pages Panel & Reader Interaction
- Page cards (`components/main.tsx`) are accessible buttons: single click selects, double click or Enter/Space opens the fullscreen reader, dragging reorders pages, and the context menu sets custom spreads through the same spread helpers in `nav/actions.tsx` that back the inspector's toggles (the menu passes the right-clicked index, the inspector the selection — right-clicking never changes the selection).
- **Replace page image**: the inspector's replace button feeds a picked file through `storeMain.replacePageImage` — the replacement is MIME-checked and decoded before the page is mutated, and the old blob stays recoverable through the undo snapshot.
- Closing the reader (`store/ui.ts` `closePreview`) re-selects the page reading stopped on so the grid and inspector resume there. The reset path uses `dismissPreview` instead, which never touches the selection.
- The former per-page "use image size as page size" action (`useImageSizeToPage`) was removed deliberately: page size is a book-level Layout-tab setting, not a per-page one. Don't reintroduce it.

### Theming & App Shell Assets
- Themes cycle light → dark → auto (`WorkspaceControls`); `auto` follows the OS via `prefers-color-scheme` and is the default.
- Design tokens live only in `workspace.css` (`:root` / `html.dark-theme`). At runtime `applyTheme` writes the active `--bg` token into every `<meta name="theme-color">` tag, so whichever media-scoped meta the browser honors (chosen by OS scheme) always carries the app's active surface color; the distinct per-scheme values in `index.html` only matter before JS first runs.
- Brand assets: `public/favicon.svg` (primary icon) with `favicon.ico` fallback, PWA icons `logo192.png`/`logo512.png`, and `manifest.json` (`theme_color` = accent blue, `background_color` = light `--bg`).

### Internationalization (i18n)
- `src/i18n/index.tsx` provides `I18nProvider` and `useI18n()` hook.
- Locale definitions in `en.ts` (source of truth) and `zh.ts`.

### Path Resolution
- `tsconfig.json` specifies `paths: { "*": ["./src/*"] }` (resolved by Vite via `resolve.tsconfigPaths`). Module paths like `'store/main'` resolve to `src/store/main.ts`.
