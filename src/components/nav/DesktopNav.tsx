import React from 'react'
import { observer } from 'mobx-react'
import Icon from 'components/icon'
import { useI18n } from 'i18n'
import { useNavActions, ImportType, NavActions } from './actions'

const PageControl = observer(function(props: { actions: NavActions }) {
  const t = useI18n()
  const {
    selectedPageIndex, selectedPageBlank, hasPages, canUndo, contentsList,
    useImageSize, movePagePrompt, insertBlankPage, setBookmark, splitPage, removePage, undo,
  } = props.actions

  const undoButton = (
    <div className="nav-item">
      <button
        type="button"
        className={`btn ${canUndo ? 'btn-secondary' : 'btn-outline-secondary disabled'}`}
        disabled={!canUndo}
        onClick={undo}
        title={t.nav.undo}
      >
        <span className="nav-icon-box"><Icon name="undo"/></span>
        <span className="nav-label">{t.nav.undo}</span>
      </button>
    </div>
  )

  if (selectedPageIndex === null) {
    return (
      <>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="ruler"/></span>
            <span className="nav-label">{t.nav.ruler}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="menu"/></span>
            <span className="nav-label">{t.nav.move}</span>
          </button>
        </div>
        <div className="nav-item">
          <button
            type="button"
            className={`btn ${!hasPages ? 'btn-outline-secondary disabled' : 'btn-secondary'}`}
            disabled={!hasPages}
            onClick={insertBlankPage}
            title={t.nav.insertBlankPage}
          >
            <span className="nav-icon-box"><Icon name="notification"/></span>
            <span className="nav-label">{t.nav.insertBlankPage}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="bookmark"/></span>
            <span className="nav-label">{t.nav.bookmark}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="scissors"/></span>
            <span className="nav-label">{t.nav.split}</span>
          </button>
        </div>
        <div className="nav-item">
          <button type="button" className="btn btn-outline-secondary disabled" disabled>
            <span className="nav-icon-box"><Icon name="cross"/></span>
            <span className="nav-label">{t.nav.delete}</span>
          </button>
        </div>
        {undoButton}
      </>
    )
  }

  return (
    <>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" disabled={selectedPageBlank} onClick={useImageSize}>
          <span className="nav-icon-box"><Icon name="ruler"/></span>
          <span className="nav-label">{t.nav.ruler}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={movePagePrompt}>
          <span className="nav-icon-box"><Icon name="menu"/></span>
          <span className="nav-label">{t.nav.move}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={insertBlankPage}
          title={t.nav.insertBlankPage}
        >
          <span className="nav-icon-box"><Icon name="notification"/></span>
          <span className="nav-label">{t.nav.insertBlankPage}</span>
        </button>
      </div>
      <div className="nav-item dropdown">
        <button type="button" className="btn btn-secondary">
          <span className="nav-icon-box"><Icon name="bookmark"/></span>
          <span className="nav-label">{t.nav.bookmark}</span>
        </button>
        <ul className="dropdown-menu" style={{top: 0,left:'100%'}}>
          {
            contentsList.map((contentItem, index) =>
              <li key={index}>
                <span
                  className={"dropdown-item" + (contentItem.pageIndex === selectedPageIndex ? ' active' : '')}
                  onClick={() => setBookmark(index)}
                >
                  {contentItem.title}
                </span>
              </li>
            )
          }
        </ul>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" disabled={selectedPageBlank} onClick={splitPage}>
          <span className="nav-icon-box"><Icon name="scissors"/></span>
          <span className="nav-label">{t.nav.split}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-secondary" onClick={removePage}>
          <span className="nav-icon-box"><Icon name="cross"/></span>
          <span className="nav-label">{t.nav.delete}</span>
        </button>
      </div>
      {undoButton}
    </>
  )
})

const DesktopNav = function(props: { requestImport: (type: ImportType) => void }) {
  const actions = useNavActions()
  const t = useI18n()
  const {
    hasPages, containerBgFilled, theme, lang,
    toggleBook, toggleContents, togglePage, generate,
    toggleContainerBg, cycleTheme, reset, toggleLang,
  } = actions

  return (
    <nav id="nav" className="navbar bg-dark">
      <div className="nav-item dropdown">
        <button type="button" className="btn btn-primary" title={t.nav.import}>
          <span className="nav-icon-box"><Icon name="upload"/></span>
          <span className="nav-label">{t.nav.import}</span>
        </button>
        <ul className="dropdown-menu" style={{top: 0,left:'100%'}}>
          <li><span className="dropdown-item" data-type="image" onClick={() => props.requestImport('image')}>{t.nav.importImage}</span></li>
          <li><span className="dropdown-item" data-type="zip" onClick={() => props.requestImport('zip')}>{t.nav.importZip}</span></li>
          <li><span className="dropdown-item" data-type="epub" onClick={() => props.requestImport('epub')}>{t.nav.importEpub}</span></li>
        </ul>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={toggleBook} title={t.nav.book}>
          <span className="nav-icon-box"><Icon name="book"/></span>
          <span className="nav-label">{t.nav.book}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={toggleContents} title={t.nav.contents}>
          <span className="nav-icon-box"><Icon name="list"/></span>
          <span className="nav-label">{t.nav.contents}</span>
        </button>
      </div>
      <div className="nav-item">
        <button type="button" className="btn btn-primary" onClick={togglePage} title={t.nav.page}>
          <span className="nav-icon-box"><Icon name="tools"/></span>
          <span className="nav-label">{t.nav.page}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!hasPages}
          onClick={generate}
          title={t.nav.generate}
        >
          <span className="nav-icon-box"><Icon name="install"/></span>
          <span className="nav-label">{t.nav.generate}</span>
        </button>
      </div>
      <PageControl actions={actions}/>
      <div className="nav-item nav-bottom-group">
        <button
          type="button"
          className={`btn ${!hasPages ? 'btn-outline-secondary disabled' : containerBgFilled ? 'btn-primary' : 'btn-secondary'}`}
          disabled={!hasPages}
          onClick={toggleContainerBg}
          title={containerBgFilled ? t.nav.previewBgFilled : t.nav.previewBgTransparent}
        >
          <span className="nav-icon-box"><Icon name="document"/></span>
          <span className="nav-label">{t.nav.previewBg}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={cycleTheme}
          title={
            { light: t.nav.themeLight, dark: t.nav.themeDark, auto: t.nav.themeAuto }[theme]
          }
        >
          <span className="nav-icon-box">
            <Icon name={theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'theme-auto'}/>
          </span>
          <span className="nav-label">{t.nav.theme}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-secondary nav-reset-btn"
          disabled={!hasPages}
          onClick={reset}
          title={t.nav.reset}
        >
          <span className="nav-icon-box"><Icon name="trash"/></span>
          <span className="nav-label">{t.nav.reset}</span>
        </button>
      </div>
      <div className="nav-item">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={toggleLang}
          title={{ zh: t.nav.langZh, en: t.nav.langEn }[lang]}
        >
          <span className="nav-icon-box"><Icon name="lang"/></span>
          <span className="nav-label">{{ zh: t.nav.langEn, en: t.nav.langZh }[lang]}</span>
        </button>
      </div>
    </nav>
  )
}

export default observer(DesktopNav)
