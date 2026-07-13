import React, { FormEvent, useCallback, useContext, useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { toJS } from 'mobx';
import { StoreContext } from 'store/main';
import Icon from 'components/icon';
import { useI18n } from 'i18n';

const ModalContents = observer(function() {
  const storeMain = useContext(StoreContext);
  const { ui: store, contents: storeContents, book: storeBook } = storeMain;
  const t = useI18n();
  const setsSeletRef = React.useRef<HTMLSelectElement>(null);
  const [plainMode, setPlainMode] = useState(false);
  const [tempList, setTempList] = useState<typeof storeContents.list>([]);
  const [textAreaInput, setTextAreaInput] = useState('');
  const [selectedSetIndex, setSelectedSetIndex] = useState(-1);
  const maxIndex = tempList.length - 1;

  const onClickModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    return;
  }, []);

  const onClickClose = useCallback(() => {
    store.toggleContentVisible();
  }, [store]);

  const togglePlainMode = useCallback(() => {
    if (plainMode) {
      const list: typeof storeContents.list = [];
      const items = textAreaInput.split('\n');
      items.forEach(item => {
        if (!item.trim()) {
          return;
        }

        const [pageIndex, ...title] = item.split('. ');

        if (pageIndex.trim() !== '' && !isNaN(pageIndex as any) && title.length) {
          list.push({
            pageIndex: Math.max(0, +pageIndex - 1),
            title: title.join('. ')
          });
        } else {
          // line without a leading "n. " — keep the title, leave it unassigned
          list.push({
            pageIndex: null,
            title: item.trim()
          });
        }
      });

      setTempList(list);
    } else {
      let value = tempList.map(contentItem => {
        return contentItem.pageIndex === null
          ? contentItem.title
          : (contentItem.pageIndex + 1) + '. ' + contentItem.title;
      }).join('\n');

      setTextAreaInput(value);
    }

    setPlainMode(!plainMode);
  }, [tempList, plainMode, textAreaInput]);

  const onInputPageIndex = useCallback((e: FormEvent<HTMLInputElement>) => {
    const listIndex = +(e.currentTarget.dataset.index as string);
    const value = e.currentTarget.value as string;
    const newList = structuredClone(tempList) as typeof storeContents.list;
    const item = newList[listIndex];
    const num = parseInt(value);
    item.pageIndex = isNaN(num) ? null : Math.max(0, num - 1);
    setTempList(newList);
  }, [tempList]);

  const onInputTitle = useCallback((e: FormEvent<HTMLInputElement>) => {
    const listIndex = +(e.currentTarget.dataset.index as string);
    const value = e.currentTarget.value as string;
    const newList = structuredClone(tempList) as typeof storeContents.list;
    const item = newList[listIndex];
    item.title = value;
    setTempList(newList);
  }, [tempList]);

  const onClickAdd = useCallback((e: FormEvent<HTMLButtonElement>) => {
    const listIndex = +(e.currentTarget.dataset.index as string);
    const list = structuredClone(tempList) as typeof storeContents.list;
    const item = list[listIndex];
    list.splice(listIndex, 1, item, {
      pageIndex: 0,
      title: ''
    });
    setTempList(list);
  }, [tempList]);

  const onClickRemove = useCallback((e: FormEvent<HTMLButtonElement>) => {
    const listIndex = +(e.currentTarget.dataset.index as string);
    const list = structuredClone(tempList) as typeof storeContents.list;
    list.splice(listIndex, 1);
    setTempList(list);
  }, [tempList]);

  const onSortList = useCallback(() => {
    const list = structuredClone(tempList) as typeof storeContents.list;

    // entries without a page number sort to the end
    list.sort((a, b) => {
      if (a.pageIndex === null) {
        return 1;
      }
      if (b.pageIndex === null) {
        return -1;
      }
      return a.pageIndex - b.pageIndex;
    });

    setTempList(list);
  }, [tempList]);

  const onFocusNumberInput = useCallback((e: FormEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  }, []);

  const onTextareaInput = useCallback((e: FormEvent<HTMLTextAreaElement>) => {
    setTextAreaInput(e.currentTarget.value);
  }, []);

  const onSave = useCallback(() => {
    storeContents.updateList(tempList);
    store.toggleContentVisible();
  }, [store, storeContents, tempList]);

  const onClickSaveSet = useCallback(() => {
    storeContents.saveSet(storeBook.bookTitle);
    setSelectedSetIndex(-1);
    setTimeout(() => {
      if (setsSeletRef.current) {
        setsSeletRef.current.value = '-1';
      }
    }, 0);
  }, [storeBook, storeContents]);

  const onClickRemoveSet = useCallback(() => {
    storeContents.removeSet(selectedSetIndex);
    setSelectedSetIndex(-1);
    setTimeout(() => {
      if (setsSeletRef.current) {
        setsSeletRef.current.value = '-1';
      }
    }, 0);
  }, [selectedSetIndex, storeContents]);

  const onApplySet = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = +e.currentTarget.value;
    setSelectedSetIndex(index);
    setTempList(toJS(storeContents.savedSets[index].list));
  }, [storeContents]);

  const onClickModalBody = useCallback(() => {
    setSelectedSetIndex(-1);
  }, []);

  useEffect(() => {
    if (selectedSetIndex !== -1) {
      return;
    }
    setTimeout(() => {
      if (setsSeletRef.current) {
        setsSeletRef.current.value = selectedSetIndex + '';
      }
    }, 0);
  });

  useEffect(() => {
    if (store.modalContentVisible) {
      setTempList(toJS(storeContents.list));
    }
  }, [store.modalContentVisible, storeContents.list]);

  return (
    <div className="modal-dialog modal-lg" onClick={onClickModal}>
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">{t.contents.modalTitle}</h5>
          <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={onClickClose}></button>
        </div>
        <div className="modal-body" onClick={onClickModalBody}>
          {
            plainMode ? (
              <textarea
                cols={30}
                rows={10}
                placeholder={t.contents.placeholder}
                className="form-control"
                style={{resize: 'none'}}
                value={textAreaInput}
                onInput={onTextareaInput}
              />
            ) : (
              <>
                <div className="row mb-2">
                  <div className="col-2">
                    <h6>{t.contents.colIndex}</h6>
                  </div>
                  <div className="col-6">
                    <h6>{t.contents.colTitle}</h6>
                  </div>
                  <div className="col-auto"></div>
                </div>
                {
                  tempList.map((contentItem, index) => (
                    <div className={'row mb-' + (index === maxIndex ? '2' : '4')} key={index}>
                      <div className="col-2">
                        <input
                          type="number"
                          className="form-control"
                          data-index={index}
                          value={contentItem.pageIndex === null ? '' : contentItem.pageIndex + 1}
                          onFocus={onFocusNumberInput}
                          onInput={onInputPageIndex}
                        />
                      </div>
                      <div className="col-8">
                        <input type="text" className="form-control" data-index={index} value={contentItem.title} onInput={onInputTitle}/>
                      </div>
                      <div className="col-auto">
                        <div className="btn-group" role="group" aria-label="Basic example">
                          <button type="button" className="btn btn btn-secondary d-flex justify-content-center align-items-center" data-index={index} onClick={onClickAdd}>
                            <Icon name="plus"></Icon>
                          </button>
                          <button type="button" className="btn btn btn-secondary d-flex justify-content-center align-items-center" data-index={index} onClick={onClickRemove}>
                            <Icon name="minus"></Icon>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </>
            )
          }
        </div>
        {
          plainMode ? null : (
            <div className="modal-footer justify-content-start">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={onClickSaveSet}>{t.contents.saveSet}</button>
              <select className="form-select form-select-sm" key={selectedSetIndex} value={selectedSetIndex + ''} defaultChecked={false} ref={setsSeletRef} style={{width: '200px'}} onChange={onApplySet}>
                {
                  storeContents.savedSets.map((set, index) =>
                    <option defaultChecked={false} key={index} value={index}>{set.title}</option>
                  )
                }
              </select>
              <button type="button" disabled={selectedSetIndex === -1} className="btn btn-sm btn-outline-danger" onClick={onClickRemoveSet}>{t.contents.removeSet}</button>
            </div>
          )
        }
        <div className="modal-footer justify-content-start">
          <button type="button" className="btn btn-outline-primary" onClick={togglePlainMode}>
            {plainMode ? t.contents.formMode : t.contents.plainMode}
          </button>
          <button type="button" disabled={plainMode} className="btn btn-outline-primary me-auto" onClick={onSortList}>
            {t.contents.sort}
          </button>
          <button type="button" disabled={plainMode} className="btn btn-primary" onClick={onSave}>
            {t.contents.save}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ModalContents;
