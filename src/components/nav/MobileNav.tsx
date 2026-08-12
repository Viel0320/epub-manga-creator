import React, { useCallback, useState } from 'react'
import { observer } from 'mobx-react'
import Icon from 'components/icon'
import { useI18n } from 'i18n'
import { useNavActions, ImportType } from './actions'

type GroupKey = 'import' | 'book' | 'page' | 'more'

const SheetItem = function(props: {
  icon: string
  label: string
  disabled?: boolean
  active?: boolean
  danger?: boolean
  trailing?: React.ReactNode
  onClick: () => void
}) {
  const className = 'mnav-sheet-item'
    + (props.active ? ' active' : '')
    + (props.danger ? ' danger' : '')

  return (
    <button type="button" className={className} disabled={props.disabled} onClick={props.onClick}>
      <Icon name={props.icon}/>
      <span className="mnav-sheet-item-label">{props.label}</span>
      {props.active ? <span className="mnav-sheet-check">✓</span> : null}
      {props.trailing}
    </button>
  )
}

const MobileNav = function(props: { requestImport: (type: ImportType) => void }) {
  const actions = useNavActions()
  const t = useI18n()
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null)
  const [bookmarkOpen, setBookmarkOpen] = useState(false)

  const {
    hasPages, selectedPageIndex, selectedPageBlank, canUndo,
    containerBgFilled, theme, lang, contentsList, spreadState,
    toggleBook, toggleContents, togglePage, generate,
    toggleContainerBg, cycleTheme, reset, toggleLang,
    useImageSize, movePagePrompt, insertBlankPage, setBookmark, splitPage, removePage, undo,
    toggleSpreadCenter, toggleSpreadBindPrev, toggleSpreadBindNext,
  } = actions

  const close = useCallback(() => {
    setOpenGroup(null)
    setBookmarkOpen(false)
  }, [])

  const toggleGroup = useCallback((group: GroupKey) => {
    setBookmarkOpen(false)
    setOpenGroup(prev => (prev === group ? null : group))
  }, [])

  // run the action synchronously (file-input clicks need the user gesture),
  // then dismiss the sheet
  const run = (fn: () => void) => () => {
    fn()
    close()
  }

  const noSelection = selectedPageIndex === null

  const barButton = (group: GroupKey, icon: string, label: string, badge?: boolean) => (
    <button
      type="button"
      className={`mnav-btn${openGroup === group ? ' open' : ''}`}
      onClick={() => toggleGroup(group)}
    >
      <span className="mnav-icon-box">
        <Icon name={icon}/>
        {badge ? <span className="mnav-badge"/> : null}
      </span>
      <span className="mnav-label">{label}</span>
    </button>
  )

  return (
    <>
      {openGroup !== null && <div className="mnav-sheet-backdrop" onClick={close}/>}

      {openGroup === 'import' && (
        <div className="mnav-sheet">
          <SheetItem icon="upload" label={t.nav.importImage} onClick={run(() => props.requestImport('image'))}/>
          <SheetItem icon="save" label={t.nav.importZip} onClick={run(() => props.requestImport('zip'))}/>
          <SheetItem icon="book" label={t.nav.importEpub} onClick={run(() => props.requestImport('epub'))}/>
        </div>
      )}

      {openGroup === 'book' && (
        <div className="mnav-sheet">
          <SheetItem icon="book" label={t.book.modalTitle} onClick={run(toggleBook)}/>
          <SheetItem icon="list" label={t.contents.modalTitle} onClick={run(toggleContents)}/>
          <SheetItem icon="tools" label={t.page.modalTitle} onClick={run(togglePage)}/>
        </div>
      )}

      {openGroup === 'page' && (
        <div className="mnav-sheet">
          {noSelection ? <div className="mnav-sheet-hint">{t.nav.selectPageHint}</div> : null}
          <SheetItem icon="ruler" label={t.nav.ruler} disabled={noSelection || selectedPageBlank} onClick={run(useImageSize)}/>
          <SheetItem icon="menu" label={t.nav.move} disabled={noSelection} onClick={run(movePagePrompt)}/>
          <SheetItem icon="notification" label={t.nav.insertBlankPage} disabled={!hasPages} onClick={run(insertBlankPage)}/>
          <SheetItem
            icon="bookmark"
            label={t.nav.bookmark}
            disabled={noSelection}
            trailing={<span className={`mnav-sheet-arrow${bookmarkOpen ? ' up' : ''}`}>▾</span>}
            onClick={() => setBookmarkOpen(prev => !prev)}
          />
          {bookmarkOpen && !noSelection && (
            <div className="mnav-sheet-sub">
              {contentsList.map((contentItem, index) => (
                <button
                  type="button"
                  key={index}
                  className={'mnav-sheet-subitem' + (contentItem.pageIndex === selectedPageIndex ? ' active' : '')}
                  onClick={run(() => setBookmark(index))}
                >
                  {contentItem.title}
                </button>
              ))}
            </div>
          )}
          <SheetItem icon="scissors" label={t.nav.split} disabled={noSelection || selectedPageBlank} onClick={run(splitPage)}/>
          <SheetItem icon="cross" label={t.nav.delete} danger disabled={noSelection} onClick={run(removePage)}/>
          <SheetItem icon="undo" label={t.nav.undo} disabled={!canUndo} onClick={run(undo)}/>
          {spreadState.available && (
            <>
              <div className="mnav-sheet-divider"/>
              <SheetItem
                icon="document"
                label={spreadState.isCentered ? t.option.removeSingle : t.option.setSingle}
                active={spreadState.isCentered}
                onClick={run(toggleSpreadCenter)}
              />
              {spreadState.canBindPrev && (
                <SheetItem
                  icon="swap"
                  label={spreadState.isBoundPrev ? t.option.removeBindPrev : t.option.bindPrev}
                  active={spreadState.isBoundPrev}
                  onClick={run(toggleSpreadBindPrev)}
                />
              )}
              {spreadState.canBindNext && (
                <SheetItem
                  icon="swap"
                  label={spreadState.isBoundNext ? t.option.removeBindNext : t.option.bindNext}
                  active={spreadState.isBoundNext}
                  onClick={run(toggleSpreadBindNext)}
                />
              )}
            </>
          )}
        </div>
      )}

      {openGroup === 'more' && (
        <div className="mnav-sheet">
          <SheetItem
            icon="document"
            label={containerBgFilled ? t.nav.previewBgFilled : t.nav.previewBgTransparent}
            active={containerBgFilled}
            disabled={!hasPages}
            onClick={run(toggleContainerBg)}
          />
          <SheetItem
            icon={theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'theme-auto'}
            label={{ light: t.nav.themeLight, dark: t.nav.themeDark, auto: t.nav.themeAuto }[theme]}
            onClick={cycleTheme}
          />
          <SheetItem
            icon="lang"
            label={{ zh: t.nav.langEn, en: t.nav.langZh }[lang]}
            onClick={run(toggleLang)}
          />
          <div className="mnav-sheet-divider"/>
          <SheetItem icon="trash" label={t.nav.reset} danger disabled={!hasPages} onClick={run(reset)}/>
        </div>
      )}

      <nav id="nav-mobile">
        {barButton('import', 'upload', t.nav.import)}
        {barButton('book', 'book', t.nav.book)}
        {barButton('page', 'tools', t.nav.page, selectedPageIndex !== null)}
        <button
          type="button"
          className="mnav-btn primary"
          disabled={!hasPages}
          onClick={run(generate)}
        >
          <span className="mnav-icon-box"><Icon name="install"/></span>
          <span className="mnav-label">{t.nav.generate}</span>
        </button>
        {barButton('more', 'menu', t.nav.more)}
      </nav>
    </>
  )
}

export default observer(MobileNav)
