import { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { useStore } from 'store/main';
import { useI18n } from 'i18n';
import { useNavActions } from 'components/nav/actions';
import Icon from 'components/icon';
import Main from 'components/main';
import BookEditor from 'components/editors/BookEditor';
import ContentsEditor from 'components/editors/ContentsEditor';
import LayoutEditor from 'components/editors/LayoutEditor';
import PageInspector from './PageInspector';

/**
 * All four work pages occupy the same grid cell and stay mounted at a stable
 * size. Visibility plus inert preserves DOM scroll, caret, and component state
 * while removing inactive pages from pointer, keyboard, and accessibility flows.
 */
const WorkspacePanels = observer(function WorkspacePanels() {
  const { book, ui } = useStore();
  const t = useI18n();
  const actions = useNavActions();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const page = ui.workspacePage;

  useEffect(() => {
    if (page !== 'pages') {
      setInspectorOpen(false);
    }
  }, [page]);

  return <div className="workspace-panels">
    <section id="workspace-panel-pages" role="tabpanel" aria-labelledby="workspace-tab-pages" className="workspace-panel workspace-page-panel" aria-hidden={page !== 'pages'} inert={page !== 'pages'}>
      <div className="workspace-canvas">
        <div className="workspace-canvas-header">
        <h1>{t.workspace.pages}<span>{book.pages.length}</span></h1>
        <div className="workspace-canvas-actions">
          <button type="button" className="workspace-button" disabled={!actions.canUndo} onClick={actions.undo}>
            <Icon name="undo" />{t.nav.undo}
          </button>
          <button
            type="button"
            className="workspace-button workspace-inspector-trigger"
            aria-controls="workspace-inspector"
            aria-expanded={inspectorOpen}
            onClick={() => setInspectorOpen(true)}
          >
            <Icon name="tools" />{t.workspace.properties}
          </button>
        </div>
      </div>
        <Main />
      </div>
      <PageInspector open={inspectorOpen && page === 'pages'} onClose={() => setInspectorOpen(false)} />
    </section>
    <section id="workspace-panel-book" role="tabpanel" aria-labelledby="workspace-tab-book" className="workspace-panel workspace-editor-panel" aria-hidden={page !== 'book'} inert={page !== 'book'}><BookEditor /></section>
    <section id="workspace-panel-contents" role="tabpanel" aria-labelledby="workspace-tab-contents" className="workspace-panel workspace-editor-panel" aria-hidden={page !== 'contents'} inert={page !== 'contents'}><ContentsEditor /></section>
    <section id="workspace-panel-layout" role="tabpanel" aria-labelledby="workspace-tab-layout" className="workspace-panel workspace-editor-panel" aria-hidden={page !== 'layout'} inert={page !== 'layout'}><LayoutEditor /></section>
  </div>;
});

export default WorkspacePanels;
