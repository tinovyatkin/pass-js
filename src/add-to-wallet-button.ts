// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

/**
 * "Add to Apple Wallet" button helper.
 *
 * Returns the official Apple-branded badge SVG as a Buffer for the
 * requested locale, or falls back to `en-US` if the requested locale
 * is not available.
 *
 * IMPORTANT — Apple usage guidelines:
 * The branded SVG assets are trademarks of Apple Inc. and their use is
 * governed by Apple's Marketing Resources:
 *   https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/
 *
 * This file ships with a clearly-marked placeholder; the maintainer
 * must source and drop Apple's real branded SVGs into
 * `src/assets/add-to-wallet/<locale>.svg` before releasing a version
 * that advertises this helper as production-ready. See
 * `src/assets/add-to-wallet/README.md` for the licensing constraint.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { normalizeLocale } from './lib/normalize-locale.js';

export type AddToWalletLocale =
  | 'en-US'
  | 'en-GB'
  | 'es-ES'
  | 'es-MX'
  | 'fr-FR'
  | 'fr-CA'
  | 'de-DE'
  | 'it-IT'
  | 'ja-JP'
  | 'ko-KR'
  | 'pt-BR'
  | 'zh-CN'
  | 'zh-TW'
  | 'nl-NL'
  | 'sv-SE'
  | 'da-DK'
  | 'no-NO'
  | 'fi-FI'
  | 'ru-RU'
  | 'pl-PL'
  | 'tr-TR'
  | 'th-TH'
  | 'ar-SA'
  | 'he-IL';

export interface AddToWalletOptions {
  locale?: AddToWalletLocale;
}

const DEFAULT_LOCALE: AddToWalletLocale = 'en-US';

const SUPPORTED_LOCALES: ReadonlySet<AddToWalletLocale> =
  new Set<AddToWalletLocale>([
    'en-US',
    'en-GB',
    'es-ES',
    'es-MX',
    'fr-FR',
    'fr-CA',
    'de-DE',
    'it-IT',
    'ja-JP',
    'ko-KR',
    'pt-BR',
    'zh-CN',
    'zh-TW',
    'nl-NL',
    'sv-SE',
    'da-DK',
    'no-NO',
    'fi-FI',
    'ru-RU',
    'pl-PL',
    'tr-TR',
    'th-TH',
    'ar-SA',
    'he-IL',
  ]);

function resolveLocale(input: string | undefined): AddToWalletLocale {
  if (!input) return DEFAULT_LOCALE;
  let normalized: string;
  try {
    normalized = normalizeLocale(input);
  } catch {
    return DEFAULT_LOCALE;
  }
  return SUPPORTED_LOCALES.has(normalized as AddToWalletLocale)
    ? (normalized as AddToWalletLocale)
    : DEFAULT_LOCALE;
}

/**
 * Returns the official "Add to Apple Wallet" badge SVG as a Buffer for
 * the requested locale. If the requested locale is not available, falls
 * back to `en-US`.
 *
 * Must comply with
 * https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/
 */
export function getAddToWalletButton(options?: AddToWalletOptions): Buffer {
  const locale = resolveLocale(options?.locale);
  const assetUrl = new URL(
    `./assets/add-to-wallet/${locale}.svg`,
    import.meta.url,
  );
  try {
    return readFileSync(fileURLToPath(assetUrl));
  } catch (cause) {
    if (
      cause instanceof Error &&
      (cause as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      throw new Error(
        'Apple-branded SVG assets must be added to src/assets/add-to-wallet/ per https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/',
        { cause },
      );
    }
    throw cause;
  }
}
