import React from 'react';
import { observer } from 'mobx-react';
import Workspace from 'components/workspace/Workspace';
import Lightbox from 'components/lightbox';
import ToastContainer from 'components/toast';
import OverlayContainer from 'components/ui/overlay';
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

/** The workspace owns persistent editor pages; only the reader and loading state use overlays. */
const App = observer(function App() {
  const { ui } = useStore();

  return (
    <I18nProvider lang={ui.lang}>
      <Workspace />
      <Lightbox />
      <OverlayContainer />
      <ToastContainer />
      <LoadingOverlay />
    </I18nProvider>
  );
});

export default App;
