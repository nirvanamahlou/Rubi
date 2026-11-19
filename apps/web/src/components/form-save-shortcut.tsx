'use client';

import { useEffect } from 'react';

const dialogs = 'dialog[open], [role="dialog"], [role="alertdialog"]';
const unavailable =
  '[hidden], [inert], [aria-hidden="true"], [data-state="closed"]';
const saveLabel = /^(?:ذخیره|ثبت|save|register)(?:\s|$)/iu;

function isVisible(element: HTMLElement): boolean {
  return (
    !element.closest(unavailable) &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility === 'visible'
  );
}

function label(button: HTMLButtonElement | HTMLInputElement): string {
  return (
    button.getAttribute('aria-label') ||
    (button instanceof HTMLInputElement
      ? button.value
      : button.textContent?.trim()) ||
    button.title
  ).trim();
}

export function handleFormSaveShortcut(event: KeyboardEvent): void {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    !event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    (event.code !== 'KeyS' && event.key.toLowerCase() !== 's')
  )
    return;

  const focused = document.activeElement;
  const modal = Array.from(document.querySelectorAll<HTMLElement>(dialogs))
    .filter(isVisible)
    .at(-1);
  if (modal?.matches('[role="alertdialog"]')) return;

  const scope = modal ?? document;
  const focusedForm =
    focused && 'form' in focused && focused.form instanceof HTMLFormElement
      ? focused.form
      : focused?.closest('form');

  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      'button, input[type="submit"]',
    ),
  ).filter((button) => {
    const form = button.form;
    if (!scope.contains(form ?? button) || !isVisible(button)) return false;
    if (focusedForm && scope.contains(focusedForm) && form !== focusedForm)
      return false;

    const explicit = button.hasAttribute('data-form-save-shortcut');
    return (
      explicit ||
      (((button.type === 'submit' && form !== null) || modal !== undefined) &&
        saveLabel.test(label(button)))
    );
  });

  const explicit = buttons.filter((button) =>
    button.hasAttribute('data-form-save-shortcut'),
  );
  const submitters = buttons.filter((button) => button.type === 'submit');
  const candidates = explicit.length
    ? explicit
    : submitters.length
      ? submitters
      : buttons;
  const button = candidates.length === 1 ? candidates[0] : undefined;
  if (!button) return;

  event.preventDefault();
  if (!button.matches(':disabled') && !button.closest('[aria-disabled="true"]'))
    button.click();
}

export function FormSaveShortcut() {
  useEffect(() => {
    window.addEventListener('keydown', handleFormSaveShortcut);
    return () => window.removeEventListener('keydown', handleFormSaveShortcut);
  }, []);

  return null;
}
