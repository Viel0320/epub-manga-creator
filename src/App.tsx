import React from 'react';
import Header from 'components/header';
import Main from 'components/main';
import Modal, { ModalBackDrop } from 'components/modal';

function App() {
  return (
    <>
      <Header />
      <Main />
      <Modal />
      <ModalBackDrop />
    </>
  );
}

export default App;
