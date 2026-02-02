# EPUB Manga Creator V2 - Project Context

This document provides essential context and instructions for AI agents (like Gemini) interacting with the `epub-manga-creator-v2` codebase.

## Project Overview
`epub-manga-creator-v2` is a React-based web application designed to package manga/comic images into high-quality EPUB 3 files. It strictly adheres to the **Digital Comic Association (Japan)** standards for fixed-layout EPUBs.

- **Primary Goal:** Provide a user-friendly Web GUI for converting image sets into valid EPUB files.
- **Architecture:** Client-side heavy application. All EPUB generation, including ZIP compression and image processing (splitting, thumbnailing), happens directly in the browser.

## Core Technology Stack
- **Frontend Framework:** React 17
- **State Management:** MobX 6 (using `makeAutoObservable` and decorators)
- **Programming Language:** TypeScript
- **Build Tool:** Create React App (react-scripts)
- **Key Libraries:**
  - `jszip`: Core library for creating the EPUB container.
  - `mobx` & `mobx-react`: For reactive state management.
  - `web-vitals`: For performance monitoring.

## Key Directories and Files
- `src/store/`: The heart of the application's logic.
  - `main.ts`: Orchestrates all stores and contains the `generateBook` logic which assembles the EPUB.
  - `book.ts`: Manages book metadata (title, author, publisher) and page order.
  - `blobs.ts`: Handles image processing, including thumbnail generation and original blob storage.
  - `contents.ts`: Manages the Table of Contents (TOC).
  - `ui.ts`: Manages UI state (selection, modal visibility).
- `src/template/`: Contains ES6 module templates for EPUB components:
  - `standard.opf.js`: The package document template.
  - `page.xhtml.js`: XHTML template for SVG-based pages.
  - `page_img.xhtml.js`: XHTML template for `<img>` tag-based pages.
  - `navigation-documents.xhtml.js`: TOC template.
  - `container.xml.js`, `fixed-layout-jp.css.js`, `mimetype`.
- `src/components/`: React functional components.
- `src/utils/`: Shared utility functions.

## Development Workflows

### Building and Running
The project uses standard `npm`/`yarn` scripts provided by Create React App:

- **Start Development Server:**
  ```bash
  yarn start
  ```
- **Build for Production:**
  ```bash
  yarn build
  ```
- **Run Tests:**
  ```bash
  yarn test
  ```

### Key Logic: EPUB Generation
The generation process in `src/store/main.ts` follows these steps:
1. Initialize `JSZip`.
2. Create standard EPUB directory structure (`META-INF`, `OEBPS/image`, `OEBPS/text`, `OEBPS/style`).
3. Iterate through `book.pages` to:
   - Generate XHTML for each page (SVG or IMG tag).
   - Add image blobs to the ZIP.
   - Generate manifest and spine entries.
4. Assemble `standard.opf` with metadata and TOC.
5. Generate the final blob and trigger a browser download.

## Development Conventions
- **MobX:** Prefer using `makeAutoObservable` in store constructors. Use `@observable` and `@action` decorators consistently where they exist.
- **Type Safety:** Ensure all new stores or components are fully typed with TypeScript.
- **Templates:** EPUB templates are currently functions that return strings. When modifying templates, ensure the placeholders (e.g., `{{title}}`) match the replacement logic in `main.ts`.
- **EPUB Standards:** Always refer to the [Digital Comic Association](http://www.digital-comic.jp/) specifications when modifying the EPUB structure.
