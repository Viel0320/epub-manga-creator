import React, { FormEvent, useCallback, useContext } from 'react';
import { observer } from 'mobx-react';
import { StoreContext } from 'store/main';
import Icon from 'components/icon';
import { useI18n } from 'i18n';
import storeMain from 'store/main';

const PAGE_SIZE: { [name: string]: () => [number, number] } = {
  'Kindle': () => [1200, 1600],
  'B4': () => [1250, 1765],
  'B5': () => [880, 1250],
  'A4': () => [1050, 1485],
  'A5': () => [1480, 2100],
  'CG 16:9': () => [1600, 900],
  'CG 16:10': () => [1600, 1000],
};

const ButtonRadio = function(props: { value: any; current: any; label: string; onClick: (val: any) => void }) {
  const onClick = useCallback(() => {
    props.onClick(props.value);
  }, [props]);

  const className = props.value === props.current
    ? 'btn btn-sm btn-primary me-2'
    : 'btn btn-sm btn-outline-primary me-2';

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
    >{props.label}</button>
  );
};

const ModalPage = observer(function() {
  const { ui: store, book: storeBook } = useContext(StoreContext);
  const t = useI18n();

  const displaySize = storeMain.displayPageSize;

  const onClickModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    return;
  }, []);

  const onClickClose = useCallback(() => {
    store.togglePageVisible();
  }, [store]);

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
    storeBook.updateBookPageProperty('pageSizeMode', 'manual');
    storeBook.updateBookPageProperty('pageSize', [
      storeBook.pageSize[1],
      storeBook.pageSize[0]
    ]);
  }, [storeBook]);
  const onChangeSizeWithDefaultValue = useCallback((key: string) => {
    let func = PAGE_SIZE[key];
    storeBook.updateBookPageProperty('pageSizeMode', 'manual');
    storeBook.updateBookPageProperty('pageSize', func());
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

  return (
    <div className="modal-dialog modal-md" onClick={onClickModal}>
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">{t.page.modalTitle}</h5>
          <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={onClickClose}></button>
        </div>
        <div className="modal-body">
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.size}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <div className="row justify-content-between">
                <div className="col-5 d-flex align-items-center">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">w</span>
                    <input
                      type={storeBook.pageSizeMode === 'auto' ? 'text' : 'number'}
                      className="form-control"
                      min="1"
                      max="9999"
                      value={storeBook.pageSizeMode === 'auto' ? 'auto' : displaySize[0]}
                      onChange={onChangePageWidth}
                    />
                  </div>
                </div>
                <div className="col-2 d-flex justify-content-center">
                  <button type="button" className="btn btn-sm btn-secondary d-flex justify-content-center align-items-center" onClick={onSwitchPageSize}>
                    <Icon name="cycle"/>
                  </button>
                </div>
                <div className="col-5 d-flex align-items-center">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text">h</span>
                    <input
                      type={storeBook.pageSizeMode === 'auto' ? 'text' : 'number'}
                      className="form-control"
                      min="1"
                      max="9999"
                      value={storeBook.pageSizeMode === 'auto' ? 'auto' : displaySize[1]}
                      onChange={onChangePageHeight}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mb-2 row">
            <div className="col-md-3 d-none d-md-block"></div>
            <div className="col-md-9 d-flex align-items-center flex-wrap gap-1">
              <ButtonRadio current={storeBook.pageSizeMode === 'auto' ? 'Auto' : 'x'} value="Auto" label="Auto" onClick={onSetAutoPageSize}/>
              <ButtonRadio current="x" value="Kindle" label="Kindle" onClick={onChangeSizeWithDefaultValue}/>
              <ButtonRadio current="x" value="B4" label="B4" onClick={onChangeSizeWithDefaultValue}/>
              <ButtonRadio current="x" value="B5" label="B5" onClick={onChangeSizeWithDefaultValue}/>
              <ButtonRadio current="x" value="A4" label="A4" onClick={onChangeSizeWithDefaultValue}/>
              <ButtonRadio current="x" value="A5" label="A5" onClick={onChangeSizeWithDefaultValue}/>
              <ButtonRadio current="x" value="CG 16:9" label="CG 16:9" onClick={onChangeSizeWithDefaultValue}/>
              <ButtonRadio current="x" value="CG 16:10" label="CG 16:10" onClick={onChangeSizeWithDefaultValue}/>
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.show}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <ButtonRadio current={storeBook.pageShow} value="two" label={t.option.twoPages} onClick={onChangePageShow} />
              <ButtonRadio current={storeBook.pageShow} value="one" label={t.option.onePage} onClick={onChangePageShow} />
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.fit}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <ButtonRadio current={storeBook.pageFit} value="contain" label={t.option.contain} onClick={onChangePageFit} />
              <ButtonRadio current={storeBook.pageFit} value="cover" label={t.option.cover} onClick={onChangePageFit} />
              <ButtonRadio current={storeBook.pageFit} value="fill" label={t.option.fill} onClick={onChangePageFit} />
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.direction}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <ButtonRadio current={storeBook.pageDirection} value="right" label={t.option.rightJP} onClick={onChangePageDirection} />
              <ButtonRadio current={storeBook.pageDirection} value="left" label={t.option.left} onClick={onChangePageDirection} />
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.cover}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <ButtonRadio current={storeBook.coverPosition} value="first-page" label={t.option.firstPage} onClick={onChangeCoverPosition} />
              <ButtonRadio current={storeBook.coverPosition} value="alone" label={t.option.alone} onClick={onChangeCoverPosition} />
            </div>
          </div>
          <div className="mb-2 row">
            <label className="col-md-3 col-form-label text-md-end">{t.page.imageTag}</label>
            <div className="col-md-9 d-flex align-items-center flex-wrap row-gap-2">
              <ButtonRadio current={storeBook.imgTag} value="svg" label="<svg />" onClick={onChangeImageTag} />
              <ButtonRadio current={storeBook.imgTag} value="img" label="<img />" onClick={onChangeImageTag} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ModalPage;
