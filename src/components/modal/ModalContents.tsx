import React, { FormEvent, useCallback, useContext, useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { toJS } from 'mobx';
import { StoreContext } from 'store/main';
import storeBlobs from 'store/blobs';
import Icon from 'components/icon';
import { useI18n } from 'i18n';
import { generateTOC, PageImageInfo, TOCGenerateMode } from 'utils/toc-generator';
import VirtualList from 'components/common/VirtualList';

interface ModalContentRowProps {
  index: number;
  contentItem: { pageIndex: number | null; title: string };
  onInputPageIndex: (index: number, value: string) => void;
  onInputTitle: (index: number, value: string) => void;
  onFocusNumberInput: (e: React.FocusEvent<HTMLInputElement>) => void;
  onClickAdd: (index: number) => void;
  onClickRemove: (index: number) => void;
}

const ModalContentRow = React.memo(function ModalContentRow({
  index,
  contentItem,
  onInputPageIndex,
  onInputTitle,
  onFocusNumberInput,
  onClickAdd,
  onClickRemove
}: ModalContentRowProps) {
  return (
    <div className="row mx-0 g-2 align-items-stretch mb-4">
      <div className="col-2">
        <input
          type="number"
          className="form-control"
          value={contentItem.pageIndex === null ? '' : contentItem.pageIndex + 1}
          onFocus={onFocusNumberInput}
          onChange={(e) => onInputPageIndex(index, e.target.value)}
        />
      </div>
      <div className="col-8">
        <input
          type="text"
          className="form-control"
          value={contentItem.title}
          onChange={(e) => onInputTitle(index, e.target.value)}
        />
      </div>
      <div className="col-auto d-flex">
        <div className="btn-group h-100" role="group" aria-label="Basic example">
          <button
            type="button"
            className="btn btn-secondary d-flex justify-content-center align-items-center h-100"
            onClick={() => onClickAdd(index)}
          >
            <Icon name="plus" />
          </button>
          <button
            type="button"
            className="btn btn-secondary d-flex justify-content-center align-items-center h-100"
            onClick={() => onClickRemove(index)}
          >
            <Icon name="minus" />
          </button>
        </div>
      </div>
    </div>
  );
});

const ModalContents = observer(function ModalContents() {
  const storeMain = useContext(StoreContext);
  const { ui: store, contents: storeContents, book: storeBook } = storeMain;
  const t = useI18n();
  const setsSeletRef = React.useRef<HTMLSelectElement>(null);
  const [plainMode, setPlainMode] = useState(false);
  const [tempList, setTempList] = useState<typeof storeContents.list>([]);
  const [textAreaInput, setTextAreaInput] = useState('');
  const [selectedSetIndex, setSelectedSetIndex] = useState(-1);
  const [autoDropdownOpen, setAutoDropdownOpen] = useState(false);

  const onClickModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAutoDropdownOpen(false);
  }, []);

  const onClickClose = useCallback(() => {
    store.toggleContentVisible();
  }, [store]);

  const toggleAutoDropdown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAutoDropdownOpen(prev => !prev);
  }, []);

  const onAutoGenerate = useCallback((mode: TOCGenerateMode) => {
    if (!storeBook.pages.length) {
      alert(t.contents.noPages);
      return;
    }

    let interval = 10;
    if (mode === 'interval') {
      const val = window.prompt(t.contents.intervalPrompt, '10');
      const parsed = parseInt(val || '', 10);
      if (isNaN(parsed) || parsed <= 0) return;
      interval = parsed;
    }

    const pagesInfo: PageImageInfo[] = storeBook.pages.map((p, i) => ({
      index: i,
      blobID: p.blobID,
      blank: p.blank,
      fileName: p.blobID && storeBlobs.blobs[p.blobID] ? storeBlobs.blobs[p.blobID].name : ''
    }));

    const generated = generateTOC(pagesInfo, { mode, interval });

    if (plainMode) {
      const textVal = generated.map(item => {
        return item.pageIndex === null
          ? item.title
          : (item.pageIndex + 1) + '. ' + item.title;
      }).join('\n');
      setTextAreaInput(textVal);
    } else {
      setTempList(generated);
    }
  }, [storeBook, plainMode, t]);

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
          list.push({
            pageIndex: null,
            title: item.trim()
          });
        }
      });

      setTempList(list);
    } else {
      const value = tempList.map(contentItem => {
        return contentItem.pageIndex === null
          ? contentItem.title
          : (contentItem.pageIndex + 1) + '. ' + contentItem.title;
      }).join('\n');

      setTextAreaInput(value);
    }

    setPlainMode(!plainMode);
  }, [tempList, plainMode, textAreaInput]);

  const onInputPageIndex = useCallback((index: number, value: string) => {
    const num = parseInt(value, 10);
    const pageIndex = isNaN(num) ? null : Math.max(0, num - 1);
    setTempList(prev => {
      if (prev[index]?.pageIndex === pageIndex) return prev;
      const next = [...prev];
      next[index] = { ...next[index], pageIndex };
      return next;
    });
  }, []);

  const onInputTitle = useCallback((index: number, value: string) => {
    setTempList(prev => {
      if (prev[index]?.title === value) return prev;
      const next = [...prev];
      next[index] = { ...next[index], title: value };
      return next;
    });
  }, []);

  const onClickAdd = useCallback((index: number) => {
    setTempList(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, {
        pageIndex: 0,
        title: ''
      });
      return next;
    });
  }, []);

  const onClickRemove = useCallback((index: number) => {
    setTempList(prev => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }, []);

  const onSortList = useCallback(() => {
    setTempList(prev => {
      const next = [...prev];
      next.sort((a, b) => {
        if (a.pageIndex === null) {
          return 1;
        }
        if (b.pageIndex === null) {
          return -1;
        }
        return a.pageIndex - b.pageIndex;
      });
      return next;
    });
  }, []);

  const onRemoveExceptCover = useCallback(() => {
    setTempList(prev => {
      const coverItems = prev.filter(item =>
        item.pageIndex === 0 || /封面|Cover|表紙/i.test(item.title)
      );

      if (coverItems.length > 0) {
        return coverItems;
      }

      if (prev.length > 0) {
        return [{ ...prev[0], pageIndex: prev[0].pageIndex ?? 0 }];
      }

      return [{ pageIndex: 0, title: '封面' }];
    });
  }, []);

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
    setAutoDropdownOpen(false);
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
                placeholder={t.contents.placeholder}
                className="form-control"
                style={{ resize: 'none', height: 'clamp(300px, 55vh, 600px)' }}
                value={textAreaInput}
                onInput={onTextareaInput}
              />
            ) : (
              <>
                <div className="row mx-0 mb-2">
                  <div className="col-2">
                    <h6>{t.contents.colIndex}</h6>
                  </div>
                  <div className="col-6">
                    <h6>{t.contents.colTitle}</h6>
                  </div>
                  <div className="col-auto"></div>
                </div>
                <VirtualList
                  items={tempList}
                  itemHeight={62}
                  containerHeight="clamp(300px, 55vh, 600px)"
                  renderItem={(contentItem, index) => (
                    <ModalContentRow
                      key={index}
                      index={index}
                      contentItem={contentItem}
                      onInputPageIndex={onInputPageIndex}
                      onInputTitle={onInputTitle}
                      onFocusNumberInput={onFocusNumberInput}
                      onClickAdd={onClickAdd}
                      onClickRemove={onClickRemove}
                    />
                  )}
                />
              </>
            )
          }
        </div>
        {
          plainMode ? null : (
            <div className="modal-footer justify-content-start">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={onClickSaveSet}>{t.contents.saveSet}</button>
              <select className="form-select form-select-sm" key={selectedSetIndex} value={selectedSetIndex + ''} defaultChecked={false} ref={setsSeletRef} style={{ width: '200px' }} onChange={onApplySet}>
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
        <div className="modal-footer justify-content-start gap-2">
          <button type="button" className="btn btn-outline-primary" onClick={togglePlainMode}>
            {plainMode ? t.contents.formMode : t.contents.plainMode}
          </button>
          <div className="dropdown position-relative d-inline-block">
            <button
              type="button"
              className="btn btn-outline-primary dropdown-toggle"
              onClick={toggleAutoDropdown}
            >
              {t.contents.autoGenerate}
            </button>
            {autoDropdownOpen && (
              <ul className="dropdown-menu show" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '6px' }}>
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setAutoDropdownOpen(false);
                      onAutoGenerate('smart');
                    }}
                  >
                    {t.contents.autoSmart}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setAutoDropdownOpen(false);
                      onAutoGenerate('folder');
                    }}
                  >
                    {t.contents.autoFolder}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setAutoDropdownOpen(false);
                      onAutoGenerate('interval');
                    }}
                  >
                    {t.contents.autoInterval}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setAutoDropdownOpen(false);
                      onAutoGenerate('filename');
                    }}
                  >
                    {t.contents.autoFilename}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setAutoDropdownOpen(false);
                      onAutoGenerate('page');
                    }}
                  >
                    {t.contents.autoPage}
                  </button>
                </li>
              </ul>
            )}
          </div>
          <button type="button" disabled={plainMode} className="btn btn-outline-primary" onClick={onSortList}>
            {t.contents.sort}
          </button>
          <button type="button" disabled={plainMode || tempList.length <= 1} className="btn btn-outline-danger me-auto" onClick={onRemoveExceptCover}>
            {t.contents.removeExceptCover}
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
