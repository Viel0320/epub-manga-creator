import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import Icon from 'components/icon';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  /** Trigger id so a sibling <label htmlFor> opens the dropdown like a native select. */
  id?: string;
  value: string;
  options: SelectOption[];
  /** Receives the picked value — the native select contract without the event wrapper. */
  onChange: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * Themed listbox dropdown replacing native <select>: the OS-drawn popup ignores
 * the publication theme, so the panel renders in-tree with pointer and keyboard
 * support (arrows, Home/End, Enter, Escape) and flips above the trigger when
 * viewport space runs out.
 */
export default function Select({ id, value, options, onChange, ariaLabel, disabled, size = 'md', className = '' }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const selected = options.find(option => option.value === value);
  const placeholder = options.find(option => option.disabled);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  /** Preference selects live near the viewport bottom, so flip when there is no room below. */
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup) return;
    const rect = trigger.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    setDropUp(roomBelow < popup.scrollHeight + 12 && rect.top > roomBelow);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const current = options.findIndex(option => option.value === value && !option.disabled);
    const firstEnabled = options.findIndex(option => !option.disabled);
    const start = current >= 0 ? current : firstEnabled;
    setActiveIndex(start);
    popupRef.current?.focus();
    requestAnimationFrame(() => {
      const nodes = popupRef.current?.querySelectorAll('[role="option"]');
      nodes?.[Math.max(0, start)]?.scrollIntoView({ block: 'nearest' });
    });
  }, [open, options, value]);

  function scrollToOption(index: number) {
    requestAnimationFrame(() => {
      popupRef.current?.querySelectorAll('[role="option"]')[index]?.scrollIntoView({ block: 'nearest' });
    });
  }

  function enabledIndexes() {
    return options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
  }

  function moveActive(step: 1 | -1) {
    const enabled = enabledIndexes();
    if (!enabled.length) return;
    const position = enabled.indexOf(activeIndex);
    const next = enabled[(position + step + enabled.length) % enabled.length];
    setActiveIndex(next);
    scrollToOption(next);
  }

  function commit(nextValue: string) {
    setOpen(false);
    triggerRef.current?.focus();
    if (nextValue !== value) onChange(nextValue);
  }

  function onPopupKeyDown(event: ReactKeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const enabled = enabledIndexes();
      if (!enabled.length) return;
      const next = event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1];
      setActiveIndex(next);
      scrollToOption(next);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option && !option.disabled) commit(option.value);
    }
  }

  return (
    <div ref={rootRef} className={'workspace-select ' + className} data-open={open || undefined}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="workspace-select-trigger"
        data-size={size}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{selected ? selected.label : placeholder ? placeholder.label : ''}</span>
        <Icon name="chevron-down" />
      </button>
      {open && (
        <div
          ref={popupRef}
          className="workspace-select-popup"
          data-placement={dropUp ? 'up' : 'down'}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          onKeyDown={onPopupKeyDown}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex || undefined}
              disabled={option.disabled}
              className="workspace-select-option"
              onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }}
              onClick={() => { if (!option.disabled) commit(option.value); }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
