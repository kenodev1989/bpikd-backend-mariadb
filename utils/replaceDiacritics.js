export function replaceDiacritics(searchQuery) {
  // Extend the replacement for other characters as needed
  const replacements = {
    c: '[cčć]',
    d: '[dđ]',
    s: '[sš]',
    z: '[zž]',
    // Add more replacements as necessary
  };

  // Replace each character in the searchQuery with its diacritic variations
  let replacedQuery = searchQuery.toLowerCase();
  for (const [key, value] of Object.entries(replacements)) {
    replacedQuery = replacedQuery.replace(new RegExp(key, 'g'), value);
  }

  return replacedQuery;
}
