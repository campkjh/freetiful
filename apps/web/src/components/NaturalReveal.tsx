'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const REVEAL_SELECTOR = [
  '[data-natural-reveal]',
  '.card',
  '.card-interactive',
  'main ul > li',
  'main tbody > tr',
  'main [data-natural-list] > *',
  'main [data-reveal-list] > *',
].join(',');

function classText(el: HTMLElement) {
  return typeof el.className === 'string' ? el.className : '';
}

function isPageManagedReveal(el: HTMLElement, root: Element) {
  let current: HTMLElement | null = el;

  while (current && current !== root) {
    const cls = classText(current);
    if (
      cls.includes('section-reveal') ||
      cls.includes('animate-fade-in') ||
      cls.includes('animate-[') ||
      (cls.includes('transition-all') && cls.includes('duration-700'))
    ) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

function shouldReveal(el: HTMLElement) {
  if (el.dataset.naturalRevealBound === 'true') return false;
  if (el.closest('[data-no-natural-reveal], [data-natural-reveal-root="false"]')) return false;
  if (el.closest('[role="dialog"], [data-nav-pill]')) return false;
  if (el.parentElement?.closest('[data-natural-reveal-bound="true"]')) return false;
  if (el.classList.contains('animate-pulse')) return false;

  const style = window.getComputedStyle(el);
  if (style.position === 'fixed') return false;
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;

  return true;
}

export default function NaturalReveal() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cleanupReveal: (() => void) | null = null;
    let waitForMainObserver: MutationObserver | null = null;

    const setup = (root: Element) => {
      let initialSweep = true;
      let order = 0;
      const timers: number[] = [];

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target as HTMLElement;
            observer.unobserve(el);
            el.classList.add('natural-reveal-in');
          });
        },
        { rootMargin: '120px 0px', threshold: 0.04 },
      );

      const bind = (el: HTMLElement) => {
        if (!shouldReveal(el)) return;
        if (isPageManagedReveal(el, root)) return;
        el.dataset.naturalRevealBound = 'true';

        if (initialSweep) {
          return;
        }

        const delay = Math.min(order % 10, 7) * 34;
        order += 1;
        el.style.setProperty('--natural-reveal-delay', `${delay}ms`);
        el.classList.add('natural-reveal');

        const timer = window.setTimeout(() => observer.observe(el), 16);
        timers.push(timer);
      };

      const scan = (scope: ParentNode = root) => {
        if (scope instanceof HTMLElement && scope.matches(REVEAL_SELECTOR)) bind(scope);
        scope.querySelectorAll?.(REVEAL_SELECTOR).forEach((node) => bind(node as HTMLElement));
      };

      scan(root);
      initialSweep = false;

      const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) scan(node);
          });
        });
      });
      mutationObserver.observe(root, { childList: true, subtree: true });

      return () => {
        mutationObserver.disconnect();
        observer.disconnect();
        timers.forEach((timer) => window.clearTimeout(timer));
      };
    };

    const start = () => {
      if (cleanupReveal) return true;
      const root = document.querySelector('main');
      if (!root) return false;
      cleanupReveal = setup(root);
      return true;
    };

    if (!start()) {
      waitForMainObserver = new MutationObserver(() => {
        if (!start()) return;
        waitForMainObserver?.disconnect();
        waitForMainObserver = null;
      });
      waitForMainObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      waitForMainObserver?.disconnect();
      cleanupReveal?.();
    };
  }, [pathname]);

  return null;
}
