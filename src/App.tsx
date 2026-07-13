import React from 'react';
import { observer } from 'mobx-react';
import Header from 'components/header';
import Main from 'components/main';
import Modal, { ModalBackDrop } from 'components/modal';
import Lightbox from 'components/lightbox';
import { I18nProvider } from 'i18n';
import { useStore } from 'store/main';

const LoadingOverlay = observer(function() {
  const { ui } = useStore();

  if (!ui.isLoading) {
    return null;
  }

  return (
    <div
      className="d-flex flex-column justify-content-center align-items-center position-fixed top-0 start-0 w-100 h-100"
      style={{ zIndex: 2000, background: 'rgba(0,0,0,.5)' }}
    >
      <div className="spinner-border text-primary" role="status" />
      {ui.loadingText ? <div className="mt-3 text-white">{ui.loadingText}</div> : null}
    </div>
  );
});

const App = observer(function App() {
  const { ui } = useStore();

  return (
    <I18nProvider lang={ui.lang}>
      <Header />
      <Main />
      <Modal />
      <ModalBackDrop />
      <Lightbox />
      <LoadingOverlay />
    </I18nProvider>
  );
});

export default App;
