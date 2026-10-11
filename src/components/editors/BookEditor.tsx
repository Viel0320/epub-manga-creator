import { FormEvent, useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { toJS } from 'mobx';
import { useStore } from 'store/main';
import Icon from 'components/icon';
import Select from 'components/ui/select';
import Combobox from 'components/ui/combobox';
import { useI18n } from 'i18n';
import { normalizeDateString } from 'utils/date-normalizer';
import { StoreBook } from 'store/book';

/** Presets for the space-separated multi-entry fields; typed segments stay free-form. */
const SUBJECT_SUGGESTIONS = ['少年', '少女', '青年', '同人誌', '漫画', '成年コミック'];
const PUBLISHER_SUGGESTIONS = ['KADOKAWA', '講談社', '集英社', '小学館', '小学館集英社プロダクション', '少年画報社', '松文館', '日本文芸社', '白泉社', '芳文社', 'ワニマガジン社', 'FAKKU'];

const KeywordPicker = function(props: { keywords: string[], onClick: (str: string) => void }) {
  const onClick = useCallback((e: FormEvent<HTMLButtonElement>) => {
    const index = e.currentTarget.dataset.index as string;
    props.onClick(props.keywords[+index]);
  }, [props]);

  return (
    <>
      {
        props.keywords.map((str, index) =>
          <button
            type="button"
            key={index}
            data-index={index}
            className="btn btn-outline-primary btn-sm me-2"
            onClick={onClick}
          >{str}</button>
        )
      }
    </>
  );
};

/** Keep metadata fields, analysis keywords, and preset selection alive between work-page switches. */
const BookEditor = observer(function BookEditor() {
  const { ui: storeUI, book: storeBook } = useStore();
  const t = useI18n();

  const [fileName, setFileName] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedSetIndex, setSelectedSetIndex] = useState(-1);

  const keywordsLength = keywords.length;

  const onClickAnalyze = useCallback(() => {
    const reg = [
      /\[.*?\(.*\)\]/, // [xxx(xxx)]
      /\[.*?\]\s?\[.*?\]/, // [xxx][xxx]
      /\[.*?\]/, // [xxx]
      /\(.*?\)/, // (xxx)
      /\([^[\]()]*?\)|\[[^[\]()]*?\]/g,
    ];

    let suffix0 = reg[0].exec(fileName);
    let suffix1 = reg[1].exec(fileName);
    let suffix2 = reg[2].exec(fileName);
    let suffix3 = reg[3].exec(fileName);

    if (suffix0) {
      let suffix = suffix0[0];
      let author = Array.from(suffix.match(/\(.*?\)/g) || []).pop();
      const i = fileName.indexOf(suffix);
      const titleAndPrefix = fileName.slice(i === 0 ? suffix.length : i + suffix.length).trim();

      storeBook.updateBookPageProperty('bookTitle', titleAndPrefix);
      storeBook.updateBookPageProperty('bookAuthors', [author?.slice(1, -1)?.trim() || '']);
      setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
      return;
    }

    if (suffix1) {
      let suffix = suffix1[0];
      let author = Array.from(suffix.match(/\[.*?\]/g) || []).pop();
      const i = fileName.indexOf(suffix);
      const titleAndPrefix = fileName.slice(i === 0 ? suffix.length : i + suffix.length).trim();

      storeBook.updateBookPageProperty('bookTitle', titleAndPrefix);
      storeBook.updateBookPageProperty('bookAuthors', [author?.slice(1, -1)?.trim() || '']);
      setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
      return;
    }

    if (suffix2) {
      let suffix = suffix2[0];
      let author = suffix.slice(1, -1);
      const i = fileName.indexOf(suffix);
      const titleAndPrefix = fileName.slice(i === 0 ? suffix.length : i + suffix.length).trim();

      storeBook.updateBookPageProperty('bookTitle', titleAndPrefix);
      storeBook.updateBookPageProperty('bookAuthors', [author]);
      setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
      return;
    }

    if (suffix3) {
      let suffix = suffix3[0];
      let author = suffix.slice(1, -1);
      const i = fileName.indexOf(suffix);
      const titleAndPrefix = fileName.slice(i === 0 ? suffix.length : i + suffix.length).trim();

      storeBook.updateBookPageProperty('bookTitle', titleAndPrefix);
      storeBook.updateBookPageProperty('bookAuthors', [author]);
      setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
      return;
    }

    storeBook.updateBookPageProperty('bookTitle', fileName);
    setKeywords(Array.from(fileName.match(reg[4]) || []).map(str => str.slice(1, -1)));
  }, [storeBook, fileName]);

  const onChangeFileName = useCallback((e: FormEvent<HTMLInputElement>) => {
    setFileName(e.currentTarget.value);
  }, []);
  const onChangeBookID = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    storeBook.updateBookPageProperty('bookID', eventTarget.value);
  }, [storeBook]);
  const onChangeBookISBN = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    storeBook.updateBookPageProperty('bookISBN', eventTarget.value);
  }, [storeBook]);
  const onChangeBookTitle = useCallback((e: FormEvent<HTMLInputElement>) => {
    storeBook.updateBookPageProperty('bookTitle', e.currentTarget.value);
  }, [storeBook]);
  const onAddAuthor = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    const index = eventTarget.dataset.index as string;
    const newValue = [...toJS(storeBook.bookAuthors)];
    newValue.splice(+index, 1, newValue[+index], '');
    storeBook.updateBookPageProperty('bookAuthors', newValue);
  }, [storeBook]);
  const onRemoveAuthor = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    const index = eventTarget.dataset.index as string;
    const newValue = [...toJS(storeBook.bookAuthors)];
    newValue.splice(+index, 1);
    storeBook.updateBookPageProperty('bookAuthors', newValue);
  }, [storeBook]);
  const onChangeBookAuthors = useCallback((e: FormEvent) => {
    const eventTarget = e.currentTarget as HTMLInputElement;
    const index = eventTarget.dataset.index as string;
    const newValue = [...toJS(storeBook.bookAuthors)];
    newValue.splice(+index, 1, eventTarget.value);
    storeBook.updateBookPageProperty('bookAuthors', newValue);
  }, [storeBook]);
  const onChangeBookSubject = useCallback((value: string) => {
    storeBook.updateBookPageProperty('bookSubject', value);
  }, [storeBook]);
  const onChangeBookPublisher = useCallback((value: string) => {
    storeBook.updateBookPageProperty('bookPublisher', value);
  }, [storeBook]);

  const onChangeBookLanguage = useCallback((language: string) => {
    storeBook.updateBookPageProperty('bookLanguage', language);
  }, [storeBook]);

  const onChangeBookSeriesName = useCallback((e: FormEvent<HTMLInputElement>) => {
    storeBook.updateBookPageProperty('bookSeriesName', e.currentTarget.value);
  }, [storeBook]);

  const onChangeBookSeriesVolume = useCallback((e: FormEvent<HTMLInputElement>) => {
    storeBook.updateBookPageProperty('bookSeriesVolume', e.currentTarget.value);
  }, [storeBook]);

  const onChangeBookDescription = useCallback((e: FormEvent<HTMLTextAreaElement>) => {
    storeBook.updateBookPageProperty('bookDescription', e.currentTarget.value);
  }, [storeBook]);

  const onChangeDateText = useCallback((e: FormEvent<HTMLInputElement>) => {
    storeBook.updateBookPageProperty('bookDate', e.currentTarget.value);
  }, [storeBook]);

  const onBlurDateText = useCallback(() => {
    if (storeBook.bookDate) {
      const normalized = normalizeDateString(storeBook.bookDate);
      if (normalized !== storeBook.bookDate) {
        storeBook.updateBookPageProperty('bookDate', normalized);
      }
    }
  }, [storeBook]);

  const onChangeDatePicker = useCallback((e: FormEvent<HTMLInputElement>) => {
    storeBook.updateBookPageProperty('bookDate', e.currentTarget.value);
  }, [storeBook]);

  const onAddContributor = useCallback(() => {
    const list = [...toJS(storeBook.bookContributors || [])];
    list.push({ name: '', role: 'ill' });
    storeBook.updateBookPageProperty('bookContributors', list);
  }, [storeBook]);

  const onRemoveContributor = useCallback((index: number) => {
    const list = [...toJS(storeBook.bookContributors || [])];
    list.splice(index, 1);
    storeBook.updateBookPageProperty('bookContributors', list);
  }, [storeBook]);

  const onChangeContributorName = useCallback((index: number, name: string) => {
    const list = [...toJS(storeBook.bookContributors || [])];
    if (list[index]) {
      list[index].name = name;
      storeBook.updateBookPageProperty('bookContributors', list);
    }
  }, [storeBook]);

  const onChangeContributorRole = useCallback((index: number, role: 'ill' | 'trl' | 'edt') => {
    const list = [...toJS(storeBook.bookContributors || [])];
    if (list[index]) {
      list[index].role = role;
      storeBook.updateBookPageProperty('bookContributors', list);
    }
  }, [storeBook]);

  const onChangeTitleFromPicker = useCallback((value: string) => {
    storeBook.updateBookPageProperty('bookTitle', value);
  }, [storeBook]);
  const onChangeAuthorsFromPicker = useCallback((value: string) => {
    const authors = toJS(storeBook.bookAuthors);

    if (authors.slice(-1)[0] === '') {
      authors[authors.length - 1] = value;
    } else {
      authors.push(value);
    }

    storeBook.updateBookPageProperty('bookAuthors', authors);
  }, [storeBook]);
  const onChangePublisherFromPicker = useCallback((value: string) => {
    storeBook.updateBookPageProperty('bookPublisher', value);
  }, [storeBook]);

  const onClickSaveSet = useCallback(() => {
    storeBook.saveBookInfoToSet();
    setSelectedSetIndex(-1);
  }, [storeBook]);

  const onClickRemoveSet = useCallback(() => {
    storeBook.removeBookInfoSet(selectedSetIndex);
    setSelectedSetIndex(-1);
  }, [selectedSetIndex, storeBook]);

  const onApplySet = useCallback((value: string) => {
    const index = +value;
    setSelectedSetIndex(index);
    storeBook.applySet(index);
  }, [storeBook]);

  useEffect(() => {
    setFileName(storeUI.fileName);
  }, [storeUI.fileName]);

  /** Defer first-import analysis until metadata is active so hidden editors never rewrite a book. */
  useEffect(() => {
    if (fileName && storeUI.firstImport && storeUI.workspacePage === 'book') {
      onClickAnalyze();
      storeUI.firstUploaded();
    }
  }, [fileName, onClickAnalyze, storeUI.firstImport, storeUI.workspacePage]);

  return (
    <div className="editor-form editor-book">
      <div className="editor-content">
        <div className="editor-header">
          <h1>{t.book.editorTitle}</h1>
        </div>
        <div className="editor-body">
          {/* 1. 文件名 */}
          <div className="mb-3 row">
            <label htmlFor="input-filename" className="col-md-3 col-form-label text-md-end">{t.book.filename}</label>
            <div className="col-md-9">
              <div className="input-group">
                <input type="text" className="form-control" id="input-filename" value={fileName} onInput={onChangeFileName}/>
                <button
                  className="btn btn-outline-secondary d-flex justify-content-center align-items-center"
                  type="button"
                  title={t.book.analyze}
                  aria-label={t.book.analyze}
                  onClick={onClickAnalyze}
                >
                  <Icon name="rocket"></Icon>
                </button>
              </div>
            </div>
          </div>

          {/* 2. ID & ISBN 双列并排 */}
          <div className="mb-3 row">
            <label htmlFor="input-book-id" className="col-md-3 col-form-label text-md-end">{t.book.id}</label>
            <div className="col-md-3">
              <input type="text" className="form-control" id="input-book-id" value={storeBook.bookID} onInput={onChangeBookID}/>
            </div>
            <label htmlFor="input-book-isbn" className="col-md-3 col-form-label text-md-end">{t.book.isbn}</label>
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                id="input-book-isbn"
                spellCheck={false}
                value={storeBook.bookISBN || ''}
                onInput={onChangeBookISBN}
              />
            </div>
          </div>

          {/* 3. 标题 */}
          <div className="mb-3 row">
            <label htmlFor="input-book-title" className="col-md-3 col-form-label text-md-end">{t.book.title}</label>
            <div className="col-md-9">
              <input type="text" className="form-control" id="input-book-title" value={storeBook.bookTitle} onInput={onChangeBookTitle}/>
              <div className={keywordsLength ? "mt-3" : ''}>
                <KeywordPicker keywords={keywords} onClick={onChangeTitleFromPicker}/>
              </div>
            </div>
          </div>

          {/* 4. 作者 */}
          <div className="mb-3 row">
            <label htmlFor="input-book-author" className="col-md-3 col-form-label text-md-end">{t.book.author}</label>
            <div className="col-md-9">
              {
                storeBook.bookAuthors.map((name: string, index: number) => (
                  <div key={index} className={"input-group" + ((index + 1) === storeBook.bookAuthors.length ? '' : ' mb-3')}>
                    <input type="text" className="form-control" data-index={index} value={name} onInput={onChangeBookAuthors}/>
                    <button
                      className="btn btn-outline-secondary d-flex justify-content-center align-items-center"
                      type="button"
                      data-index={index}
                      onClick={onAddAuthor}
                    >
                      <Icon name="plus"></Icon>
                    </button>
                    <button
                      className="btn btn-outline-secondary d-flex justify-content-center align-items-center"
                      type="button"
                      data-index={index}
                      disabled={storeBook.bookAuthors.length === 1}
                      onClick={onRemoveAuthor}
                    >
                      <Icon name="minus"></Icon>
                    </button>
                  </div>
                ))
              }
              <div className={keywordsLength ? "mt-3" : ''}>
                <KeywordPicker keywords={keywords} onClick={onChangeAuthorsFromPicker}/>
              </div>
            </div>
          </div>

          {/* 5. 出版商 & 出版日期 双列并排 */}
          <div className="mb-3 row">
            <label htmlFor="input-book-publisher" className="col-md-3 col-form-label text-md-end">{t.book.publisher}</label>
            <div className="col-md-3">
              <Combobox
                id="input-book-publisher"
                ariaLabel={t.book.publisher}
                value={storeBook.bookPublisher}
                onChange={onChangeBookPublisher}
                suggestions={PUBLISHER_SUGGESTIONS}
              />
            </div>
            <label htmlFor="input-book-date" className="col-md-3 col-form-label text-md-end">{t.book.date}</label>
            <div className="col-md-3">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  id="input-book-date"
                  value={storeBook.bookDate || ''}
                  onInput={onChangeDateText}
                  onBlur={onBlurDateText}
                />
                <div
                  className="btn btn-outline-secondary position-relative d-flex justify-content-center align-items-center"
                  style={{ width: '42px', padding: 0 }}
                  title={t.book.chooseDate}
                >
                  <Icon name="calendar" />
                  <input
                    type="date"
                    className="position-absolute w-100 h-100 top-0 start-0 opacity-0"
                    style={{ cursor: 'pointer' }}
                    value={/^\d{4}-\d{2}-\d{2}$/.test(storeBook.bookDate) ? storeBook.bookDate : ''}
                    onChange={onChangeDatePicker}
                  />
                </div>
              </div>
            </div>
          </div>
          {keywordsLength ? (
            <div className="mb-3 row">
              <div className="col-md-9 offset-md-3">
                <KeywordPicker keywords={keywords} onClick={onChangePublisherFromPicker}/>
              </div>
            </div>
          ) : null}

          {/* 6. 语言 & 主题/分类 双列并排 */}
          <div className="mb-3 row">
            <label htmlFor="select-book-language" className="col-md-3 col-form-label text-md-end">{t.book.language}</label>
            <div className="col-md-3">
              <Select
                id="select-book-language"
                ariaLabel={t.book.language}
                value={storeBook.bookLanguage || 'ja'}
                onChange={onChangeBookLanguage}
                options={[
                  { value: 'ja', label: '日本語 (ja)' },
                  { value: 'zh-CN', label: '简体中文 (zh-CN)' },
                  { value: 'zh-TW', label: '繁體中文 (zh-TW)' },
                  { value: 'zh-HK', label: '繁體中文 - 香港 (zh-HK)' },
                  { value: 'en', label: 'English (en)' },
                  { value: 'ko', label: '한국어 (ko)' },
                  { value: 'fr', label: 'Français (fr)' },
                  { value: 'de', label: 'Deutsch (de)' },
                  { value: 'es', label: 'Español (es)' },
                  { value: 'it', label: 'Italiano (it)' },
                  { value: 'ru', label: 'Русский (ru)' },
                  { value: 'pt', label: 'Português (pt)' },
                ]}
              />
            </div>
            <label htmlFor="input-book-subject" className="col-md-3 col-form-label text-md-end">{t.book.subject}</label>
            <div className="col-md-3">
              <Combobox
                id="input-book-subject"
                ariaLabel={t.book.subject}
                value={storeBook.bookSubject}
                onChange={onChangeBookSubject}
                suggestions={SUBJECT_SUGGESTIONS}
              />
            </div>
          </div>

          {/* 7. 系列名称 & 卷号 双列并排 */}
          <div className="mb-3 row">
            <label htmlFor="input-book-series" className="col-md-3 col-form-label text-md-end">{t.book.seriesName}</label>
            <div className="col-md-3">
              <input type="text" className="form-control" id="input-book-series" value={storeBook.bookSeriesName || ''} onInput={onChangeBookSeriesName}/>
            </div>
            <label htmlFor="input-book-volume" className="col-md-3 col-form-label text-md-end">{t.book.seriesVolume}</label>
            <div className="col-md-3">
              <input type="text" className="form-control" id="input-book-volume" value={storeBook.bookSeriesVolume || ''} onInput={onChangeBookSeriesVolume}/>
            </div>
          </div>

          {/* 8. 贡献者列表 */}
          <div className="mb-3 row">
            <label className="col-md-3 col-form-label text-md-end">{t.book.contributor}</label>
            <div className="col-md-9">
              {
                (storeBook.bookContributors || []).map((item, index) => (
                  <div key={index} className="input-group mb-2">
                    <Select
                      ariaLabel={t.book.contributor}
                      value={item.role}
                      onChange={(role) => onChangeContributorRole(index, role as 'ill' | 'trl' | 'edt')}
                      options={[
                        { value: 'ill', label: t.book.roleIll },
                        { value: 'trl', label: t.book.roleTrl },
                        { value: 'edt', label: t.book.roleEdt },
                      ]}
                    />
                    <input
                      type="text"
                      className="form-control"
                      value={item.name}
                      onInput={(e) => onChangeContributorName(index, (e.target as HTMLInputElement).value)}
                    />
                    <button
                      className="btn btn-outline-secondary d-flex justify-content-center align-items-center"
                      type="button"
                      onClick={() => onRemoveContributor(index)}
                    >
                      <Icon name="minus"></Icon>
                    </button>
                  </div>
                ))
              }
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onAddContributor}>
                <Icon name="plus" /> <span className="ms-1">{t.book.addContributor}</span>
              </button>
            </div>
          </div>

          {/* 9. 内容简介 */}
          <div className="mb-3 row">
            <label htmlFor="input-book-desc" className="col-md-3 col-form-label text-md-end">{t.book.description}</label>
            <div className="col-md-9">
              <textarea
                className="form-control"
                id="input-book-desc"
                rows={3}
                value={storeBook.bookDescription || ''}
                onInput={onChangeBookDescription}
              />
            </div>
          </div>
        </div>
        <div className="editor-footer justify-content-start">
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={onClickSaveSet}>{t.book.saveSet}</button>
          <Select
            className="set-select"
            size="sm"
            ariaLabel={t.book.saveSet}
            value={selectedSetIndex + ''}
            onChange={onApplySet}
            options={[{ value: '-1', label: '--', disabled: true }, ...storeBook.savedSets.map((set, index) => ({ value: index + '', label: `title: ${set.bookTitle}, author: ${set.bookAuthors[0]}, subject: ${set.bookSubject}` }))]}
          />
          <button type="button" disabled={selectedSetIndex === -1} className="btn btn-sm btn-outline-danger" onClick={onClickRemoveSet}>{t.book.removeSet}</button>
        </div>
      </div>
    </div>
  );
});

export default BookEditor;
