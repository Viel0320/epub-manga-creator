import { useEffect, useRef, type ChangeEvent } from 'react';
import { observer } from 'mobx-react';
import { useStore } from 'store/main';
import { useI18n } from 'i18n';
import { IMAGE_ACCEPT, useNavActions } from 'components/nav/actions';
import Icon from 'components/icon';
import Select from 'components/ui/select';
import { getPageEffectiveSize } from 'utils/page-size';

/**
 * Selected-page controls delegate to existing actions so cover offsets, directory
 * links, spread constraints, confirmation prompts, and undo records stay intact.
 * Desktop and mobile render the same inspector instead of duplicate toolbars.
 */
const PageInspector = observer(function PageInspector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { book, blobs, ui, modePageSize } = useStore();
  const actions = useNavActions();
  const t = useI18n();
  const ref = useRef<HTMLElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const index = ui.selectedPageIndex;
  const page = index === null ? null : book.pages[index];
  const blob = page ? blobs.blobs[page.blobID] : undefined;
  const size = getPageEffectiveSize(page, blob, book.pageSizeMode, book.pageSize, modePageSize);
  const spread = actions.spreadState;
  const bookmark = index === null ? undefined : actions.contentsIndexMap[index];
  const title = index === null ? t.workspace.noSelection : index === 0 && book.coverPosition === 'alone'
    ? t.page.coverPage : `${t.lightbox.page} ${index + 1 - (book.coverPosition === 'alone' ? 1 : 0)}`;

  /** Focus only after React makes the mobile sheet visible; hidden elements cannot receive focus. */
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  /** Restore the single toolbar trigger after dismissing the shared mobile inspector. */
  function closeInspector() {
    onClose();
    document.querySelector<HTMLButtonElement>('.workspace-inspector-trigger')?.focus();
  }

  /** Reset the picker value so choosing the same file again still fires onChange. */
  async function onReplaceFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) await actions.replacePageImage(file);
  }

  return <aside id="workspace-inspector" className={`workspace-inspector${open ? ' is-open' : ''}`} tabIndex={-1} ref={ref} aria-label={t.workspace.properties} onKeyDown={event => {
    if (event.key === 'Escape') closeInspector();
  }}>
    <header><h2>{t.workspace.properties}</h2><button type="button" className="workspace-inspector-close workspace-button" onClick={closeInspector} aria-label={t.lightbox.close}><Icon name="cross" /></button></header>
    {!page && book.pages.length === 0 && <div className="workspace-no-selection"><p>{t.workspace.emptyImport}</p></div>}
    {!page && book.pages.length > 0 && <>
      <div className="workspace-no-selection"><Icon name="document" /><p>{t.workspace.noSelection}</p></div>
      <button type="button" className="workspace-button" onClick={actions.insertBlankPage}><Icon name="notification" />{t.nav.insertBlankPage}</button>
    </>}
    {page && <>
      <div className="workspace-page-proof">
        {blob ? <>
          <img src={blob.thumbnailURL} alt={blob.name} />
          <button type="button" className="workspace-proof-replace" onClick={() => replaceInputRef.current?.click()}>
            <Icon name="image-plus" />{t.workspace.replaceImage}
          </button>
        </> : <span>{t.lightbox.blankPage}</span>}
      </div>
      <input ref={replaceInputRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={onReplaceFile} />
      <div className="workspace-page-name"><strong>{title}</strong>{blob?.name ? <span title={blob.name}>{blob.name}</span> : !blob && <span>{t.lightbox.blankPage}</span>}</div>
      <dl className="workspace-page-facts">
        {blob && <>
          <dt>{t.lightbox.originImage}</dt><dd>{blob.width} × {blob.height}</dd>
        </>}
        <dt>{t.page.size}</dt><dd>{size.join(' × ')}</dd>
      </dl>
      <div className="workspace-inspector-section workspace-spread-actions">
        <h3>{t.workspace.pageTools}</h3>
        <button type="button" className="workspace-button" onClick={actions.movePagePrompt}><Icon name="swap" />{t.nav.move}</button>
        <button type="button" className="workspace-button" onClick={actions.insertBlankPage}><Icon name="notification" />{t.nav.insertBlankPage}</button>
        <button type="button" className="workspace-button" disabled={page.blank} onClick={actions.splitPage}><Icon name="scissors" />{t.nav.split}</button>
      </div>
      <div className="workspace-inspector-section">
        <label className="workspace-field">
          {t.nav.bookmark}
          <Select
            ariaLabel={t.nav.bookmark}
            value={bookmark === undefined || bookmark === null ? '' : String(bookmark)}
            onChange={value => actions.setBookmark(Number(value))}
            options={[
              { value: '', label: t.workspace.noBookmark, disabled: true },
              ...actions.contentsList.map((item, itemIndex) => ({ value: String(itemIndex), label: item.title })),
            ]}
          />
        </label>
      </div>
      {spread.available && (
        <div className="workspace-inspector-section workspace-spread-actions">
          <h3>{t.workspace.spread}</h3>
          <button type="button" className="workspace-button" aria-pressed={spread.isCentered} onClick={actions.toggleSpreadCenter}>
            <Icon name="document" />{spread.isCentered ? t.option.removeSingle : t.option.setSingle}
          </button>
          {spread.canBindPrev && (
            <button type="button" className="workspace-button" aria-pressed={spread.isBoundPrev} onClick={actions.toggleSpreadBindPrev}>
              <Icon name="swap" />{spread.isBoundPrev ? t.option.removeBindPrev : t.option.bindPrev}
            </button>
          )}
          {spread.canBindNext && (
            <button type="button" className="workspace-button" aria-pressed={spread.isBoundNext} onClick={actions.toggleSpreadBindNext}>
              <Icon name="swap" />{spread.isBoundNext ? t.option.removeBindNext : t.option.bindNext}
            </button>
          )}
        </div>
      )}
      <div className="workspace-inspector-section"><button type="button" className="workspace-button workspace-danger" onClick={actions.removePage}><Icon name="trash" />{t.nav.delete}</button></div>
    </>}
  </aside>;
});

export default PageInspector;
