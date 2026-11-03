/**
 * Shared product matcher for free, manual phone-case color-mask editing.
 * A mask is offered only for products clearly identified as cases/covers.
 */
export function isPhoneCaseProduct(name: string, category: string, details = '') {
  const searchable = \`${name} ${category} ${details}\`.toLocaleLowerCase('ar');
  return /جراب|جرابات|كفر|كفرات|phone\s*case|case\s*cover|phone\s*cover|\bcase\b|\bcover\b/.test(searchable);
}
