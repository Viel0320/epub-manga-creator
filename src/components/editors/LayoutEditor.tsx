import { FormEvent, useCallback } from 'react';
import { observer } from 'mobx-react';
import { useStore } from 'store/main';
import Icon from 'components/icon';
import { useI18n } from 'i18n';
import { PAGE_SIZE_PRESETS, matchPageSizePreset } from 'utils/page-size';

const isAutoMode = (mode: 'manual' | 'auto') => mode === 'auto';

const ButtonRadio = function(props: { value: any; current: any; label: string; onClick: (val: any) => void }) {
  const onClick = useCallback(() => {
    props.onClick(props.value);
  }, [props]);

  const selected = props.value === props.current;
  const className = selected
    ? 'btn btn-sm btn-primary'
    : 'btn btn-sm btn-outline-primary';

  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      onClick={onClick}
    >{props.label}</button>
  );
};

/** Render the complete existing layout controls as a persistent workspace page. */
const LayoutEditor = observer(function LayoutEditor() {
  const { ui: store, book: storeBook, displayPageSize: displaySize } = useStore();
  const t = useI18n();
  const autoMode = isAutoMode(storeBook.pageSizeMode);
  // one selected entry per option group: Auto while in auto mode,
  // otherwise the preset the current size belongs to (either orientation)
  const activeSizeKey = autoMode ? 'Auto' : (matchPageSizePreset(storeBook.pageSizeMode, storeBook.pageSize) || '');

  const onChangePageWidth = useCallback((e: FormEvent<HTMLInputElement>) => {
    storeBook.updateBookPageProperty('pageSizeMode', 'manual');
    const val = +e.currentTarget.value;
    storeBook.updateBookPageProperty('pageSize', [
      val > 0 ? val : 1200,
      storeBook.pageSize[1] || 1600
    ]);
  }, [storeBook]);
  const onChangePageHeight = useCallback((e: FormEvent<HTMLInputElement>) => {
    storeBook.updateBookPageProperty('pageSizeMode', 'manual');
    const val = +e.currentTarget.value;
    storeBook.updateBookPageProperty('pageSize', [
      storeBook.pageSize[0] || 1200,
      val > 0 ? val : 1600
    ]);
  }, [storeBook]);
  const onSwitchPageSize = useCallback(() => {
    if (isAutoMode(storeBook.pageSizeMode)) return;
    storeBook.updateBookPageProperty('pageSize', [
      storeBook.pageSize[1],
      storeBook.pageSize[0]
    ]);
  }, [storeBook]);
  const onChangeSizeWithDefaultValue = useCallback((name: string) => {
    const preset = PAGE_SIZE_PRESETS.find((item) => item.name === name);
    if (!preset) return;
    storeBook.updateBookPageProperty('pageSizeMode', 'manual');
    storeBook.updateBookPageProperty('pageSize', [...preset.size] as [number, number]);
  }, [storeBook]);
  const onSetAutoPageSize = useCallback(() => {
    storeBook.updateBookPageProperty('pageSizeMode', 'auto');
  }, [storeBook]);
  const onChangePageShow = useCallback((value: 'two' | 'one') => {
    storeBook.updateBookPageProperty('pageShow', value);
  }, [storeBook]);
  const onChangePageFit = useCallback((value: 'contain' | 'cover' | 'fill') => {
    storeBook.updateBookPageProperty('pageFit', value);
  }, [storeBook]);
  const onChangePageDirection = useCallback((value: 'right' | 'left') => {
    storeBook.updateBookPageProperty('pageDirection', value);
  }, [storeBook]);
  const onChangeCoverPosition = useCallback((value: 'first-page' | 'alone') => {
    storeBook.updateBookPageProperty('coverPosition', value);
  }, [storeBook]);
  const onChangeImageTag = useCallback((value: 'svg' | 'img') => {
    storeBook.updateBookPageProperty('imgTag', value);
  }, [storeBook]);
  const onChangePreviewBackground = useCallback((value: 'none' | 'white') => {
    store.setContainerBgFilled(value === 'white');
  }, [store]);

  return (
    <div className="editor-form editor-layout">
      <div className="editor-content">
        <div className="editor-header">
          <h1>{t.page.editorTitle}</h1>
        </div>
        <div className="editor-body">
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.size}</label>
            <div className="col-md-9">
              <div className="d-flex align-items-center flex-wrap gap-1" style={{ marginBottom: 10 }}>
                <div className="input-group input-group-sm size-field">
                  <span className="input-group-text">w</span>
                  <input
                    type={autoMode ? 'text' : 'number'}
                    className="form-control"
                    min="1"
                    max="9999"
                    value={autoMode ? 'auto' : displaySize[0]}
                    onChange={onChangePageWidth}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary size-swap-btn d-flex justify-content-center align-items-center"
                  title={t.page.swapSize}
                  aria-label={t.page.swapSize}
                  disabled={autoMode}
                  onClick={onSwitchPageSize}
                >
                  <Icon name="cycle"/>
                </button>
                <div className="input-group input-group-sm size-field">
                  <span className="input-group-text">h</span>
                  <input
                    type={autoMode ? 'text' : 'number'}
                    className="form-control"
                    min="1"
                    max="9999"
                    value={autoMode ? 'auto' : displaySize[1]}
                    onChange={onChangePageHeight}
                  />
                </div>
              </div>
              <div className="btn-group flex-wrap row-gap-2" role="group" aria-label={t.page.size}>
                <ButtonRadio current={activeSizeKey} value="Auto" label="Auto" onClick={onSetAutoPageSize}/>
                {PAGE_SIZE_PRESETS.map(({ name }) => (
                  <ButtonRadio key={name} current={activeSizeKey} value={name} label={name} onClick={onChangeSizeWithDefaultValue}/>
                ))}
              </div>
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.show}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <div className="btn-group" role="group" aria-label={t.page.show}>
                <ButtonRadio current={storeBook.pageShow} value="two" label={t.option.twoPages} onClick={onChangePageShow} />
                <ButtonRadio current={storeBook.pageShow} value="one" label={t.option.onePage} onClick={onChangePageShow} />
              </div>
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.fit}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <div className="btn-group" role="group" aria-label={t.page.fit}>
                <ButtonRadio current={storeBook.pageFit} value="contain" label={t.option.contain} onClick={onChangePageFit} />
                <ButtonRadio current={storeBook.pageFit} value="cover" label={t.option.cover} onClick={onChangePageFit} />
                <ButtonRadio current={storeBook.pageFit} value="fill" label={t.option.fill} onClick={onChangePageFit} />
              </div>
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.direction}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <div className="btn-group" role="group" aria-label={t.page.direction}>
                <ButtonRadio current={storeBook.pageDirection} value="right" label={t.option.rightJP} onClick={onChangePageDirection} />
                <ButtonRadio current={storeBook.pageDirection} value="left" label={t.option.left} onClick={onChangePageDirection} />
              </div>
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.cover}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <div className="btn-group" role="group" aria-label={t.page.cover}>
                <ButtonRadio current={storeBook.coverPosition} value="first-page" label={t.option.firstPage} onClick={onChangeCoverPosition} />
                <ButtonRadio current={storeBook.coverPosition} value="alone" label={t.option.alone} onClick={onChangeCoverPosition} />
              </div>
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.imageTag}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <div className="btn-group" role="group" aria-label={t.page.imageTag}>
                <ButtonRadio current={storeBook.imgTag} value="svg" label="<svg />" onClick={onChangeImageTag} />
                <ButtonRadio current={storeBook.imgTag} value="img" label="<img />" onClick={onChangeImageTag} />
              </div>
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.background}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <div className="btn-group" role="group" aria-label={t.page.background}>
                <ButtonRadio current={store.containerBgFilled ? 'white' : 'none'} value="none" label={t.option.noFill} onClick={onChangePreviewBackground} />
                <ButtonRadio current={store.containerBgFilled ? 'white' : 'none'} value="white" label={t.option.whiteFill} onClick={onChangePreviewBackground} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default LayoutEditor;
