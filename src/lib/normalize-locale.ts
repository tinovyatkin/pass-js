/**
 * @see {@link https://stackoverflow.com/questions/8758340/regex-to-detect-locales}
 */

export function normalizeLocale(locale: string): string {
  const match = /^(?<lang>[A-Za-z]{2,4})([-_](?<variant>[A-Za-z]{4}|\d{3}))?([-_](?<country>[A-Za-z]{2}|\d{3}))?$/.exec(
    locale,
  );
  if (!match?.groups?.lang)
    throw new TypeError(`Invalid locale string: ${locale}`);
  let result = match.groups.lang.toLowerCase();
  if (match.groups.variant)
    result += `-${match.groups.variant
      .charAt(0)
      .toUpperCase()}${match.groups.variant.slice(1).toLowerCase()}`;
  if (match.groups.country) result += `-${match.groups.country.toUpperCase()}`;
  return result;
}
