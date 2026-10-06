import { useEffect } from 'react';

/** Shared keyboard/focus behavior for existing and nested financial dialogs. */
export function ModalAccessibility() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let returnFocus: HTMLElement | null = null;
    let lastOutside: HTMLElement | null = document.activeElement as HTMLElement;
    let restore: (() => void) | undefined;
    const focusable = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')]
      .filter(element => !element.closest('[hidden], [inert]') && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden');
    const focusFirst = () => { if (active) (focusable(active)[0] || active).focus(); };
    function synchronize() {
      const dialogs = [...document.querySelectorAll<HTMLElement>('.modal-backdrop[role="dialog"]')].filter(d => !d.hidden && getComputedStyle(d).display !== 'none');
      const next = dialogs.at(-1) || null;
      if (next === active) { if (active && !active.contains(document.activeElement)) focusFirst(); return; }
      const previous = active;
      restore?.(); restore = undefined;
      active = next;
      if (!next) { if (returnFocus?.isConnected) returnFocus.focus(); returnFocus = null; return; }
      if (!previous) returnFocus = lastOutside;
      const inertStates = new Map<HTMLElement, boolean>();
      let branch: HTMLElement = next;
      while (branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling !== branch && sibling instanceof HTMLElement && !['SCRIPT', 'STYLE'].includes(sibling.tagName)) { inertStates.set(sibling, sibling.inert); sibling.inert = true; }
        }
        if (branch.parentElement === document.body) break;
        branch = branch.parentElement;
      }
      const overflow = document.body.style.overflow;
      const tabIndex = next.getAttribute('tabindex');
      next.tabIndex = -1;
      document.body.style.overflow = 'hidden';
      restore = () => { inertStates.forEach((wasInert, node) => { node.inert = wasInert; }); document.body.style.overflow = overflow; if (tabIndex === null) next.removeAttribute('tabindex'); else next.setAttribute('tabindex', tabIndex); };
      if (!next.contains(document.activeElement)) focusFirst();
    }
    function onFocus(event: FocusEvent) { const target = event.target; if (target instanceof HTMLElement && !target.closest('.modal-backdrop[role="dialog"]')) { if (active) focusFirst(); else lastOutside = target; } }
    function onPointer(event: PointerEvent) { const target = event.target; if (!active && target instanceof HTMLElement) lastOutside = target.closest<HTMLElement>('button, a, input, [tabindex]') || lastOutside; }
    function onKey(event: KeyboardEvent) {
      if (!active) return;
      if (event.key === 'Escape') {
        const close = active.querySelector<HTMLButtonElement>('.modal__header button:not([disabled])');
        if (close) { event.preventDefault(); event.stopPropagation(); close.click(); }
      }
      if (event.key === 'Tab') {
        const items = focusable(active), first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); active.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === active)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === active)) { event.preventDefault(); first.focus(); }
      }
    }
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('focusin', onFocus); document.addEventListener('pointerdown', onPointer, true); document.addEventListener('keydown', onKey, true);
    synchronize();
    return () => { observer.disconnect(); restore?.(); document.removeEventListener('focusin', onFocus); document.removeEventListener('pointerdown', onPointer, true); document.removeEventListener('keydown', onKey, true); };
  }, []);
  return null;
}
