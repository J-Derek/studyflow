import React, { useEffect, useRef, useState } from 'react';

/**
 * Tooltips for icon-only controls, one for the whole app. A control with no visible words (a button or link holding only an icon) shows its
 * name when the mouse rests on it, when it is reached with the keyboard, and after a long press on a touch screen. The name comes from
 * `data-tip`, `aria-label` or `title`; a `title` is moved to `aria-label` so the control keeps its accessible name and the browser's own
 * slower tooltip does not appear as well. Controls that already show words are left alone.
 */
const CONTROL = 'button, a[href], [role="button"], summary';
const HOVER_DELAY = 350;
const LONG_PRESS = 500;
const TOUCH_SHOW = 2200;

function visibleWords(el: Element): string {
  let out = '';
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? '';
    else if (n instanceof Element && !n.classList.contains('sr-only') && n.getAttribute('aria-hidden') !== 'true') n.childNodes.forEach(walk);
  };
  el.childNodes.forEach(walk);
  return out.trim();
}

/** The tooltip text for a control, or null when it shows words of its own (or has nothing to say). */
export function tipFor(el: Element): string | null {
  if (visibleWords(el) !== '') return null;
  const title = el.getAttribute('title');
  if (title) {
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', title);
    el.setAttribute('data-tip', title);
    el.removeAttribute('title');
  }
  return el.getAttribute('data-tip') || el.getAttribute('aria-label') || null;
}

interface Tip {
  text: string;
  left: number;
  top: number;
  below: boolean;
}

export const TooltipHost: React.FC = () => {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const owner = useRef<Element | null>(null);

  useEffect(() => {
    const clear = () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(hideTimer.current);
    };
    const hide = () => {
      clear();
      owner.current = null;
      setTip(null);
    };
    const show = (el: Element, text: string) => {
      const r = el.getBoundingClientRect();
      const below = r.top < 48;
      owner.current = el;
      setTip({ text, left: Math.min(Math.max(r.left + r.width / 2, 80), window.innerWidth - 80), top: below ? r.bottom + 6 : r.top - 6, below });
    };
    const target = (t: EventTarget | null): Element | null => (t instanceof Element ? t.closest(CONTROL) : null);

    const onOver = (e: MouseEvent) => {
      const el = target(e.target);
      if (!el || el === owner.current) return;
      const text = tipFor(el);
      if (!text) return;
      clear();
      timer.current = window.setTimeout(() => show(el, text), HOVER_DELAY);
    };
    const onOut = (e: MouseEvent) => {
      const el = target(e.target);
      if (el && !el.contains(e.relatedTarget as Node | null)) hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = target(e.target);
      if (!el) return;
      // Only for the keyboard: a mouse click already shows the hover tip, and focus after a tap should not pop one up.
      let keyboard = false;
      try {
        keyboard = el.matches(':focus-visible');
      } catch {
        keyboard = false;
      }
      if (!keyboard) return;
      const text = tipFor(el);
      if (text) show(el, text);
    };
    const onTouchStart = (e: TouchEvent) => {
      const el = target(e.target);
      if (!el) return;
      const text = tipFor(el);
      if (!text) return;
      clear();
      timer.current = window.setTimeout(() => {
        show(el, text);
        hideTimer.current = window.setTimeout(hide, TOUCH_SHOW);
      }, LONG_PRESS);
    };
    const cancelTouch = () => window.clearTimeout(timer.current);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', hide);
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', cancelTouch, { passive: true });
    document.addEventListener('touchmove', cancelTouch, { passive: true });
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('click', hide, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      clear();
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', cancelTouch);
      document.removeEventListener('touchmove', cancelTouch);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('click', hide, true);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      role="tooltip"
      data-testid="tooltip"
      style={{ position: 'fixed', left: tip.left, top: tip.top, transform: tip.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)' }}
      className="pointer-events-none z-[70] max-w-[min(20rem,calc(100vw-1rem))] rounded-md bg-zinc-900 dark:bg-zinc-100 px-2 py-1 text-xs font-medium text-white dark:text-zinc-900 shadow-lg"
    >
      {tip.text}
    </div>
  );
};
