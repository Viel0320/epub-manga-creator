import React from 'react'
import { createRoot } from 'react-dom/client'
import { observer } from 'mobx-react'
import 'components/icon'
import './index.css'

import Header from 'components/header'
import Main from 'components/main'
import Modal, { ModalBackDrop } from 'components/modal'

import { I18nProvider, useI18n } from 'i18n'
import storeMain, { StoreContext } from 'store/main'

const LoadingOverlay = observer(() => {
  const t = useI18n()
  if (!storeMain.ui.isLoading) return null
  return (
    <div className="loading-overlay">
      <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status"></div>
      <h5>{storeMain.ui.loadingText || (storeMain.ui.lang === 'zh' ? '正在加载...' : 'Loading...')}</h5>
    </div>
  )
})

const App = observer(() => (
  <StoreContext.Provider value={storeMain}>
    <I18nProvider lang={storeMain.ui.lang}>
      <Header />
      <Main />
      <Modal />
      <ModalBackDrop />
      <LoadingOverlay />
    </I18nProvider>
  </StoreContext.Provider>
))

const container =
  document.getElementById('root') ||
  document.body.appendChild(document.createElement('div'))
if (!container.id) container.id = 'root'
const root = createRoot(container)
root.render(<App />)
