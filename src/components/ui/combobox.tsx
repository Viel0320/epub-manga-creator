import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

interface ComboboxProps {
  /** Attachable input id so a sibling <label htmlFor> focuses the field. */
  id?: string;
  /** Space-separated value; each segment is one entry. */
  value: string;
  /** Preset suggestions; segments already present in the value are filtered out. */
  suggestions: string[];
  /** Receives the whole value on every keystroke and on each picked suggestion. */
  onChange: (value: string) => void;
  ariaLabel?: string;
}

/**
 * Themed editable dropdown replacing native <input list> + <datalist>, whose
 * OS-drawn popup ignores the publication theme. Free text is kept as typed;
 * picking a suggestion completes the segment being typed (suggestions only
 * match what is already typed). Entries are space-separated: end an entry
 * with a space to commit it, then the next pick appends a further segment.
 * The popup only shows while suggestions match the last segment; Escape or
 * an outside press closes it.
 */
export default function Combobox({ id, value, suggestions, onChange, ariaLabel }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const endsWithSpace = /\s$/.test(value);
  const segments = value.split(/\s+/).filter(Boolean);
  const typed = endsWithSpace ? '' : (segments[segments.length - 1] ?? '');
  const committed = endsWithSpace ? segments : segments.slice(0, -1);
  const options = suggestions.filter(suggestion =>
    suggestion !== typed
    && !committed.includes(suggestion)
    && suggestion.toLowerCase().includes(typed.toLowerCase())
  );

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        inputRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  /** Preference fields sit near the viewport bottom, so flip when there is no room below. */
  useLayoutEffect(() => {
    if (!open) return;
    const input = inputRef.current;
    const popup = popupRef.current;
    if (!input || !popup) return;
    const rect = input.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    setDropUp(roomBelow < popup.scrollHeight + 12 && rect.top > roomBelow);
  }, [open]);

  function pick(suggestion: string) {
    onChange([...committed, suggestion].join(' '));
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function moveActive(step: 1 | -1) {
    if (!options.length) return;
    const next = activeIndex < 0
      ? (step === 1 ? 0 : options.length - 1)
      : (activeIndex + step + options.length) % options.length;
    setActiveIndex(next);
    requestAnimationFrame(() => {
      popupRef.current?.querySelectorAll('[role="option"]')[next]?.scrollIntoView({ block: 'nearest' });
    });
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && open && activeIndex >= 0 && options[activeIndex]) {
      event.preventDefault();
      pick(options[activeIndex]);
    }
  }

  return (
    <div ref={rootRef} className="workspace-combobox">
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="form-control"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={open && options.length > 0 ? listboxId : undefined}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        value={value}
        onChange={event => onChange(event.currentTarget.value)}
        onFocus={() => setOpen(true)}
        onPointerDown={() => { if (!open) setOpen(true); }}
        onKeyDown={onInputKeyDown}
      />
      {open && options.length > 0 && (
        <div
          ref={popupRef}
          id={listboxId}
          className="workspace-select-popup"
          data-placement={dropUp ? 'up' : 'down'}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              role="option"
              aria-selected="false"
              data-active={index === activeIndex || undefined}
              className="workspace-select-option"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
