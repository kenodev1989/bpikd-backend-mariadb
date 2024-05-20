export const slugify = (text) => {
  return text
    .toString()
    .normalize('NFD') // separate diacritics from letters
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/[^.\w-]+/g, '') // remove all non-word chars except period
    .replace(/--+/g, '-') // replace multiple - with single -
    .replace(/^-+|-+$/g, ''); // remove leading and trailing dashes
};
