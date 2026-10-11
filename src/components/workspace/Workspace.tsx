import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { observer } from 'mobx-react';
import { useStore } from 'store/main';
import { useI18n } from 'i18n';
import { useImportControl, useNavActions } from 'components/nav/actions';
import Icon, { type IconName } from 'components/icon';
import WorkspacePanels from './WorkspacePanels';
import { GITHUB_URL, WorkspaceThemeLang } from './WorkspaceControls';
import './workspace.css';

/**
 * Native disclosure menus support keyboard activation without another UI library.
 * Outside clicks and Escape dismiss them; action buttons close their own menu
 * after running synchronously so file pickers retain the browser's user gesture.
 */
function WorkspaceMenu({ label, icon, children, className = '', primary = false }: {
  label: string; icon: IconName; children: ReactNode; className?: string; primary?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  /** Remove document listeners with the menu to avoid stale targets after unmount. */
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  return <details ref={ref} className={`workspace-menu${primary ? ' workspace-menu-primary' : ''} ${className}`} onClick={event => {
    if ((event.target as Element).closest('button') && ref.current) ref.current.open = false;
  }}>
    <summary><Icon name={icon} /><span>{label}</span><Icon name="chevron-down" /></summary>
    <div className="workspace-menu-content">{children}</div>
  </details>;
}

/** Small viewports reuse a compact brand inside the header title row; the
    sidebar renders the full-size one on wide screens. The brand links to the
    GitHub repository. */
function WorkspaceBrand({ compact = false }: { compact?: boolean }) {
  return <a
    className={`workspace-brand${compact ? ' workspace-brand-compact' : ''}`}
    href={GITHUB_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="MANGA EPUB CREATOR – GitHub"
  ><span><Icon name="book" /></span><div>MANGA<small>EPUB CREATOR</small></div></a>;
}

/**
 * Replace navigation chrome while retaining the original import pipeline, page
 * renderer, stores, persistent editor pages, undo stack, and EPUB builder.
 * Each publication-level action has one visible entry point at every viewport.
 */
const Workspace = observer(function Workspace() {
  const { book, ui } = useStore();
  const t = useI18n();
  const actions = useNavActions();
  const { fileInput, requestImport } = useImportControl();
  const hasPages = book.pages.length > 0;

  /** Open the existing full-resolution reader from the current selection or cover. */
  function openReader() {
    ui.openPreview(ui.selectedPageIndex ?? 0);
  }

  /** Support both sidebar and mobile tab orientations, plus Home/End, without losing editor state. */
  function navigateTabs(event: ReactKeyboardEvent<HTMLElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = tabs.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1) + tabs.length) % tabs.length;
    tabs[next].click();
    tabs[next].focus();
  }

  return <div className="publishing-workspace">
    <aside className="workspace-sidebar">
      <WorkspaceBrand />
      <div className="workspace-nav" role="tablist" aria-label={t.workspace.navigation} onKeyDown={navigateTabs}>
        <button id="workspace-tab-pages" role="tab" type="button" aria-controls="workspace-panel-pages" aria-selected={ui.workspacePage === 'pages'} tabIndex={ui.workspacePage === 'pages' ? 0 : -1} onClick={() => ui.setWorkspacePage('pages')}><Icon name="document" />{t.workspace.pages}</button>
        <button id="workspace-tab-book" role="tab" type="button" aria-controls="workspace-panel-book" aria-selected={ui.workspacePage === 'book'} tabIndex={ui.workspacePage === 'book' ? 0 : -1} onClick={() => ui.setWorkspacePage('book')}><Icon name="book" />{t.book.editorTitle}</button>
        <button id="workspace-tab-contents" role="tab" type="button" aria-controls="workspace-panel-contents" aria-selected={ui.workspacePage === 'contents'} tabIndex={ui.workspacePage === 'contents' ? 0 : -1} onClick={() => ui.setWorkspacePage('contents')}><Icon name="list" />{t.contents.editorTitle}</button>
        <button id="workspace-tab-layout" role="tab" type="button" aria-controls="workspace-panel-layout" aria-selected={ui.workspacePage === 'layout'} tabIndex={ui.workspacePage === 'layout' ? 0 : -1} onClick={() => ui.setWorkspacePage('layout')}><Icon name="tools" />{t.page.editorTitle}</button>
      </div>
    </aside>

    <header className="workspace-header">
      <div className="workspace-title-wrap">
        <WorkspaceBrand compact />
        <strong className="workspace-book-title" title={book.bookTitle || ui.fileName}>{book.bookTitle || ui.fileName || t.workspace.untitled}</strong>
        <button type="button" className="workspace-reset-btn" disabled={!hasPages} onClick={actions.reset} title={t.nav.reset} aria-label={t.nav.reset}><Icon name="trash" /></button>
        <div className="workspace-header-tools"><WorkspaceThemeLang /></div>
      </div>
      <div className="workspace-primary-actions">
        <WorkspaceMenu label={t.nav.import} icon="upload" primary={!hasPages} className="workspace-import-menu">
          <button type="button" onClick={() => requestImport('image')}><Icon name="document" />{t.nav.importImage}</button>
          <button type="button" onClick={() => requestImport('zip')}><Icon name="save" />{t.nav.importZip}</button>
          <button type="button" onClick={() => requestImport('epub')}><Icon name="book" />{t.nav.importEpub}</button>
        </WorkspaceMenu>
        <button type="button" className="workspace-button" disabled={!hasPages} onClick={openReader}><Icon name="bookmarks" /><span>{t.workspace.preview}</span></button>
        <button type="button" className="workspace-button workspace-primary" disabled={!hasPages || ui.isLoading} onClick={actions.generate}><Icon name="install" /><span>{t.workspace.export}</span></button>
      </div>
    </header>

    <WorkspacePanels key={ui.workspaceRevision} />
    {fileInput}
  </div>;
});

export default Workspace;
