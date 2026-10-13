import { browserDisplayLanguage } from './language';
import { translateUiText } from './translate';

export function uiAlert(message: string): void {
  window.alert(translateUiText(message, browserDisplayLanguage()));
}
export function uiConfirm(message: string): boolean {
  return window.confirm(translateUiText(message, browserDisplayLanguage()));
}
