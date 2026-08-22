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
  contentItem: { pageIndex: number | null; title: string; level: number };
  /** 独立封面模式下卡片编号不含封面，页码列必须显示同样的编号 */
  coverOffset: number;
  onInputPageIndex: (index: number, value: string) => void;
  onInputTitle: (index: number, value: string) => void;
  onFocusNumberInput: (e: React.FocusEvent<HTMLInputElement>) => void;
  onClickAdd: (index: number) => void;
  onClickRemove: (index: number) => void;
  onIndent: (index: number) => void;
  onOutdent: (index: number) => void;
}

const ModalContentRow = React.memo(function ModalContentRow({
  index,
  contentItem,
  coverOffset,
  onInputPageIndex,
  onInputTitle,
  onFocusNumberInput,
  onClickAdd,
  onClickRemove,
  onIndent,
  onOutdent
}: ModalContentRowProps) {
  const level = contentItem.level || 0;
  const isUnlinked = contentItem.pageIndex === null
    || (coverOffset === 1 && contentItem.pageIndex === 0);
  return (
    <div className="row mx-0 g-2 align-items-stretch mb-4" style={{ paddingLeft: level * 24 }}>
      <div className="col-3 col-md-2">
        <input
          type="number"
          className="form-control"
          value={isUnlinked ? '' : contentItem.pageIndex! + 1 - coverOffset}
          onFocus={onFocusNumberInput}
          onChange={(e) => onInputPageIndex(index, e.target.value)}
        />
      </div>
      <div className="col">
        <input
          type="text"
          className="form-control"
          value={contentItem.title}
          onChange={(e) => onInputTitle(index, e.target.value)}
        />
      </div>
      <div className="col-auto d-flex">
        <div className="btn-group h-100" role="group">
          <button
            type="button"
            className="btn btn-outline-secondary d-flex justify-content-center align-items-center h-100"
            disabled={level >= 3}
            onClick={() => onIndent(index)}
            title="Indent"
          >
            <Icon name="chevron-right" />
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary d-flex justify-content-center align-items-center h-100"
            disabled={level <= 0}
            onClick={() => onOutdent(index)}
            title="Outdent"
          >
            <Icon name="chevron-left" />
          </button>
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
  // 目录编辑器显示/输入的页码与卡片编号一致：独立封面模式下不含封面。
  // 封面无独立页面文件，条目不可指向它——一律视为未关联。
  const coverOffset = storeBook.coverPosition === 'alone' ? 1 : 0;
  const isUnlinkedPage = useCallback((pageIndex: number | null) =>
    pageIndex === null || (coverOffset === 1 && pageIndex === 0)
  , [coverOffset]);
  const [plainMode, setPlainMode] = useState(false);
  const [tempList, setTempList] = useState<typeof storeContents.list>([]);
  const [textAreaInput, setTextAreaInput] = useState('');
  const [selectedSetIndex, setSelectedSetIndex] = useState(-1);
  const [autoDropdownOpen, setAutoDropdownOpen] = useState(false);
  const [autoGenSuccessCount, setAutoGenSuccessCount] = useState<number | null>(null);

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

    const generated = generateTOC(pagesInfo, {
      mode,
      interval,
      coverPosition: storeBook.coverPosition,
      labels: {
        cover: t.contents.tocCover,
        chapter: t.contents.tocChapter,
        page: t.contents.tocPage,
      }
    });

    if (plainMode) {
      const textVal = generated.map(item => {
        const indent = '  '.repeat(item.level || 0);
        return isUnlinkedPage(item.pageIndex)
          ? indent + item.title
          : indent + (item.pageIndex! + 1 - coverOffset) + '. ' + item.title;
      }).join('\n');
      setTextAreaInput(textVal);
    } else {
      setTempList(generated);
    }

    setAutoGenSuccessCount(generated.length);
  }, [storeBook, plainMode, t, coverOffset, isUnlinkedPage]);

  const togglePlainMode = useCallback(() => {
    if (plainMode) {
      const list: typeof storeContents.list = [];
      const items = textAreaInput.split('\n');
      items.forEach(item => {
        if (!item.trim()) {
          return;
        }

        const leadingSpaces = item.match(/^( *)/)?.[1].length || 0;
        const level = Math.min(3, Math.floor(leadingSpaces / 2));
        const trimmed = item.trim();
        const [pageIndex, ...title] = trimmed.split('. ');

        if (pageIndex.trim() !== '' && !isNaN(pageIndex as any) && title.length) {
          const parsed = Math.max(0, +pageIndex - 1 + coverOffset);
          list.push({
            pageIndex: coverOffset === 1 && parsed === 0 ? null : parsed,
            title: title.join('. '),
            level
          });
        } else {
          list.push({
            pageIndex: null,
            title: trimmed,
            level
          });
        }
      });

      setTempList(list);
    } else {
      const value = tempList.map(contentItem => {
        const indent = '  '.repeat(contentItem.level || 0);
        return isUnlinkedPage(contentItem.pageIndex)
          ? indent + contentItem.title
          : indent + (contentItem.pageIndex! + 1 - coverOffset) + '. ' + contentItem.title;
      }).join('\n');

      setTextAreaInput(value);
    }

    setPlainMode(!plainMode);
  }, [tempList, plainMode, textAreaInput, coverOffset, isUnlinkedPage]);

  const onInputPageIndex = useCallback((index: number, value: string) => {
    const num = parseInt(value, 10);
    const clamped = isNaN(num) ? null : Math.max(0, num - 1 + coverOffset);
    const pageIndex = coverOffset === 1 && clamped === 0 ? null : clamped;
    setTempList(prev => {
      if (prev[index]?.pageIndex === pageIndex) return prev;
      const next = [...prev];
      next[index] = { ...next[index], pageIndex };
      return next;
    });
  }, [coverOffset]);

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
        title: '',
        level: 0
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

  const onIndent = useCallback((index: number) => {
    setTempList(prev => {
      const item = prev[index];
      if (!item || (item.level || 0) >= 3) return prev;
      const next = [...prev];
      next[index] = { ...item, level: (item.level || 0) + 1 };
      return next;
    });
  }, []);

  const onOutdent = useCallback((index: number) => {
    setTempList(prev => {
      const item = prev[index];
      if (!item || (item.level || 0) <= 0) return prev;
      const next = [...prev];
      next[index] = { ...item, level: (item.level || 0) - 1 };
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
        (!coverOffset && item.pageIndex === 0) || /封面|Cover|表紙/i.test(item.title)
      );

      if (coverItems.length > 0) {
        return coverItems;
      }

      if (prev.length > 0) {
        // 找不到封面条目时保留第一行原样：独立封面模式的封面不可被目录指向
        return [prev[0]];
      }

      return coverOffset ? [] : [{ pageIndex: 0, title: t.contents.tocCover, level: 0 }];
    });
  }, [t, coverOffset]);

  const onFocusNumberInput = useCallback((e: FormEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  }, []);

  const onTextareaInput = useCallback((e: FormEvent<HTMLTextAreaElement>) => {
    setTextAreaInput(e.currentTarget.value);
  }, []);

  const onSave = useCallback(() => {
    // clamp page numbers to the actual page count so the exported TOC
    // never links to a page file that does not exist
    const maxPage = storeBook.pages.length;
    const cleaned = tempList.map(item => {
      if (item.pageIndex === null) return item;
      // normalize legacy entries still pointing at a standalone cover
      if (coverOffset === 1 && item.pageIndex === 0) return { ...item, pageIndex: null };
      if (maxPage === 0) return { ...item, pageIndex: null };
      return { ...item, pageIndex: Math.min(Math.max(0, item.pageIndex), maxPage - 1) };
    });
    storeContents.updateList(cleaned);
    store.toggleContentVisible();
  }, [store, storeContents, storeBook, tempList, coverOffset]);

  const onClickSaveSet = useCallback(() => {
    storeContents.saveSet(storeBook.bookTitle);
    setSelectedSetIndex(-1);
  }, [storeBook, storeContents]);

  const onClickRemoveSet = useCallback(() => {
    storeContents.removeSet(selectedSetIndex);
    setSelectedSetIndex(-1);
  }, [selectedSetIndex, storeContents]);

  const onApplySet = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = +e.currentTarget.value;
    const selectedSet = storeContents.savedSets[index];
    // some browsers still render the hidden placeholder option (value -1)
    if (!selectedSet) {
      setSelectedSetIndex(-1);
      return;
    }
    setSelectedSetIndex(index);
    setTempList(toJS(selectedSet.list));
  }, [storeContents]);

  const onClickModalBody = useCallback(() => {
    setSelectedSetIndex(-1);
    setAutoDropdownOpen(false);
  }, []);

  useEffect(() => {
    if (store.modalContentVisible) {
      setTempList(toJS(storeContents.list));
      setAutoGenSuccessCount(null);
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
                  <div className="col-3 col-md-2">
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
                      coverOffset={coverOffset}
                      onInputPageIndex={onInputPageIndex}
                      onInputTitle={onInputTitle}
                      onFocusNumberInput={onFocusNumberInput}
                      onClickAdd={onClickAdd}
                      onClickRemove={onClickRemove}
                      onIndent={onIndent}
                      onOutdent={onOutdent}
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
              <select className="form-select form-select-sm modal-set-select" value={selectedSetIndex + ''} onChange={onApplySet}>
                <option value="-1" hidden>--</option>
                {
                  storeContents.savedSets.map((set, index) =>
                    <option key={index} value={index}>{set.title}</option>
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
          {autoGenSuccessCount !== null && (
            <span className="text-success small fw-medium align-self-center me-1">
              {t.contents.autoSuccess(autoGenSuccessCount)}
            </span>
          )}
          <button type="button" disabled={plainMode} className="btn btn-primary" onClick={onSave}>
            {t.contents.save}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ModalContents;
