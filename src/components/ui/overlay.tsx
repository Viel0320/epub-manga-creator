import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import { useStore } from 'store/main';
import { useI18n } from 'i18n';

/**
 * Theme-aware replacement for window.confirm / window.prompt / alert, whose
 * chrome is OS-drawn and ignores the publication theme. Mounted once beside
 * the toast container; callers await ui.showConfirm/showPrompt/showAlert.
 */
const OverlayContainer = observer(function OverlayContainer() {
  const { ui } = useStore();
  const t = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevActiveRef = useRef<HTMLElement | null>(null);
  const [inputValue, setInputValue] = useState('');

  const overlay = ui.overlay;

  const getFocusableElements = (): HTMLElement[] => {
    const elements: (HTMLElement | null)[] = [];
    if (overlay?.kind === 'prompt') {
      elements.push(inputRef.current);
    }
    if (overlay?.kind !== 'alert') {
      elements.push(cancelRef.current);
    }
    elements.push(okRef.current);
    return elements.filter((el): el is HTMLElement => el !== null && !el.hasAttribute('disabled'));
  };

  /** Focus the safe target per kind: the prompt's input, else the cancel button (or OK for alerts). */
  useEffect(() => {
    if (!overlay) return;
    prevActiveRef.current = document.activeElement as HTMLElement | null;
    if (overlay.kind === 'prompt') {
      setInputValue(overlay.defaultValue ?? '');
      inputRef.current?.focus();
    } else if (overlay.kind === 'alert') {
      okRef.current?.focus();
    } else {
      cancelRef.current?.focus();
    }
    return () => {
      prevActiveRef.current?.focus();
      prevActiveRef.current = null;
    };
  }, [overlay]);

  if (!overlay) return null;

  const dismiss = () => ui.settleOverlay(overlay.kind === 'prompt' ? null : false);
  const accept = () => ui.settleOverlay(overlay.kind === 'prompt' ? inputValue : true);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      dismiss();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      const items = getFocusableElements();
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey) {
        const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        items[prevIndex].focus();
      } else {
        const nextIndex = currentIndex === -1 || currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
        items[nextIndex].focus();
      }
    }
  };

  return (
    <div
      className="workspace-overlay-container"
      onPointerDown={event => { if (event.target === event.currentTarget) dismiss(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="workspace-overlay-panel" role="alertdialog" aria-modal="true" aria-describedby="workspace-overlay-message">
        <p id="workspace-overlay-message" className="workspace-overlay-message">{overlay.message}</p>
        {overlay.kind === 'prompt' && (
          <input
            ref={inputRef}
            className="workspace-overlay-input"
            value={inputValue}
            onChange={event => setInputValue(event.currentTarget.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); accept(); } }}
          />
        )}
        <div className="workspace-overlay-actions">
          {overlay.kind !== 'alert' && (
            <button type="button" ref={cancelRef} className="workspace-button" onClick={dismiss}>{t.confirm.cancel}</button>
          )}
          <button
            type="button"
            ref={okRef}
            className={`workspace-button ${overlay.kind === 'confirm' && overlay.danger ? 'workspace-danger' : 'workspace-primary'}`}
            onClick={accept}
          >{t.confirm.ok}</button>
        </div>
      </div>
    </div>
  );
});

export default OverlayContainer;
