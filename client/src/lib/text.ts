/**
 * Diyanet publishes place names in upper case ("İSTANBUL", "KÜÇÜKÇEKMECE").
 * Turkish-aware title case: "İstanbul", "Küçükçekmece", "Kuzey Kıbrıs".
 */
export function titleTr(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLocaleLowerCase('tr')
    .split(/(\s+|-|\/|\()/)
    .map((w) => (w.length ? w.charAt(0).toLocaleUpperCase('tr') + w.slice(1) : w))
    .join('');
}
