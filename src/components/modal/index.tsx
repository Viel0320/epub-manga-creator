import React, { useCallback, useContext } from 'react';
import { observer } from 'mobx-react';
import { StoreContext } from 'store/main';
import ModalBook from './ModalBook';
import ModalContents from './ModalContents';
import ModalPage from './ModalPage';
import './index.css';

const Modal = function() {
  const { ui: store } = useContext(StoreContext);

  const modalVisible = store.modalBookVisible || store.modalContentVisible || store.modalPageVisible;

  const onClickClose = useCallback(() => {
    store.hideModal();
  }, [store]);

  return modalVisible ? (
    <div id="modal" className="modal fade show" style={{display:'block'}} onClick={onClickClose}>
      {
        !store.modalBookVisible ? null : <ModalBook />
      }
      {
        !store.modalContentVisible ? null : <ModalContents />
      }
      {
        !store.modalPageVisible ? null : <ModalPage />
      }
    </div>
  ) : null;
};

const ModalBackDrop = observer(function() {
  const { ui: store } = useContext(StoreContext);
  const modalVisible = store.modalBookVisible || store.modalContentVisible || store.modalPageVisible;

  return modalVisible
    ? <div key="modal-backdrop" className="modal-backdrop fade show"/>
    : null;
});

export { ModalBackDrop };
export default observer(Modal);
