# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

EPUB Manga Creator V3 is a browser-based single-page app that packages manga/comic images into EPUB 3.0 (fixed-layout, Japanese manga format). The EPUB is generated entirely client-side without any backend server.

- **Homepage**: `https://viel0320.github.io/epub-manga-creator/`
- **Tech stack**: React 19, TypeScript, MobX 6, Vite 8, Bootstrap Dark 5
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
- **Direct Images**: PNG, JPEG, WebP, AVIF, GIF. Image types are identified via magic bytes (`detectImageMime` in `src/utils/epub-parser.ts`, used by the ZIP import in `components/header.tsx`).
- **Archive Packages**: ZIP archives (decompressed via `JSZip`, auto-detecting image MIME types).
- **EPUB Re-import & Parser**: Full dual EPUB 2 & EPUB 3 parser (`src/utils/epub-parser.ts`). Compatible with EPUB 3 HTML Nav (`<nav epub:type="toc">`) and `properties="cover-image"` as well as EPUB 2 NCX (`toc.ncx` / `<navMap>`) and `<meta name="cover">` / `<guide>` legacy references.

### EPUB 3.0 Output Compliance
- **Specification**: EPUB 3.0 Fixed-Layout (Japanese manga standard).
- **Metadata**: Embedded `fixed-layout-jp:viewport`, `rendition:viewport`, and `RegionMagnification` tags (`opf-builder.ts`).
- **ZIP OCF Compliance**: Strictly uncompressed `mimetype` as the very first ZIP entry to pass standard EPUB validators.
- **Rendering Modes**:
  - SVG Image Tag: `<svg><image/></svg>` (default)
  - HTML Image Tag: `<img/>`
- **Page Fit Modes**: `contain` (fit), `cover` (crop), `fill` (stretch). Controls SVG `preserveAspectRatio` and CSS `object-fit`.

## Architecture & Code Structure

### Dependencies
- **UI & State**: React 19, MobX 6, MobX React 9.
- **Build & Utility**: Vite 8, TypeScript 7, JSZip (zip creation/extract), Native IndexedDB (`src/utils/db.ts`).

### Directory Structure & Responsibilities

```
src/
├── components/          # React UI Components
│   ├── header.tsx       # Top navbar (import, export, modal toggles, language)
│   ├── main.tsx         # Page grid viewer & double-page spread layout
│   ├── lightbox.tsx     # Fullscreen interactive reader & preview modal
│   ├── toast.tsx        # Toast notification system
│   └── modal/           # Form modals (ModalBook, ModalContents, ModalPage)
├── services/            # Core Business Services
│   ├── epub-builder/    # Modular EPUB Generation Engine
│   │   ├── index.ts     # Main packager orchestrator
│   │   ├── opf-builder.ts # Standard OPF manifest generator
│   │   ├── page-builder.ts# XHTML page renderer
│   │   ├── toc-builder.ts # Navigation XHTML generator
│   │   └── types.ts     # EPUB Builder domain interfaces
│   └── workspace-persistence.ts # IndexedDB workspace snapshot saver/restorer
├── store/               # MobX State Management Stores
│   ├── main.ts          # Central orchestrator singleton (StoreMain)
│   ├── book.ts          # Metadata & page list store
│   ├── contents.ts      # Table of contents store
│   ├── blobs.ts         # Image Blob & memory URL store
│   └── ui.ts            # UI states & modal visibilities
├── template/            # EPUB XHTML, OPF, and CSS Templates
├── utils/               # Helper Utilities
│   ├── epub-parser.ts   # EPUB import & extraction parser
│   ├── toc-generator.ts # Auto TOC generation algorithms
│   ├── page-layout.ts   # Spread calculation & alignment layout math
│   ├── db.ts            # Raw IndexedDB wrapper
│   └── date-normalizer.ts # Date format normalization
```

### State Management & Persistence (MobX + IndexedDB)
- `store/main.ts` (`storeMain`) is the primary orchestrator that coordinates cross-store mutations.
- **Auto Workspace Recovery**: `src/services/workspace-persistence.ts` automatically saves current workspace state and image Blobs to IndexedDB (`src/utils/db.ts`), restoring them upon app startup.
- `localStorage` handles persistent UI settings (`EPUB_CREATOR_SAVED_SETS_BOOK`, `EPUB_CREATOR_LANG`, etc.).

### Internationalization (i18n)
- `src/i18n/index.tsx` provides `I18nProvider` and `useI18n()` hook.
- Locale definitions in `en.ts` (source of truth) and `zh.ts`.

### Path Resolution
- `tsconfig.json` specifies `paths: { "*": ["./src/*"] }` (resolved by Vite via `resolve.tsconfigPaths`). Module paths like `'store/main'` resolve to `src/store/main.ts`.
