const INVISIBLE_CHARS_REGEX = /[\u200B-\u200D\uFEFF]/g;

module.exports = (value = '') => {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .normalize('NFKC')
    .replace(INVISIBLE_CHARS_REGEX, '')
    .trim()
    .toLowerCase();
};
