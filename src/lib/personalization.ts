// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

import { stripJsonComments } from './strip-json-comments.js';

/**
 * PassKit personalization fields supported by Wallet's reward-card signup
 * flow.
 *
 * @see {@link https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/PassPersonalization.html}
 */
export type RequiredPersonalizationField =
  | 'PKPassPersonalizationFieldName'
  | 'PKPassPersonalizationFieldPostalCode'
  | 'PKPassPersonalizationFieldEmailAddress'
  | 'PKPassPersonalizationFieldPhoneNumber';

/**
 * Contents of `personalization.json`.
 */
export interface Personalization {
  description: string;
  requiredPersonalizationFields: RequiredPersonalizationField[];
  termsAndConditions?: string;
}

const PERSONALIZATION_FIELDS: ReadonlySet<string> = new Set([
  'PKPassPersonalizationFieldName',
  'PKPassPersonalizationFieldPostalCode',
  'PKPassPersonalizationFieldEmailAddress',
  'PKPassPersonalizationFieldPhoneNumber',
]);

const PERSONALIZATION_LOGO_RE = /(?:^|\/)personalizationLogo(?:@[23]x)?\.png$/;

function assertPlainObject(value: unknown): asserts value is {
  description?: unknown;
  requiredPersonalizationFields?: unknown;
  termsAndConditions?: unknown;
} {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError('personalization must be a plain object');
  }
}

export function validatePersonalization(
  value: Personalization,
): Personalization {
  assertPlainObject(value);

  if (typeof value.description !== 'string' || value.description.length === 0)
    throw new TypeError(
      'personalization.description must be a non-empty string',
    );

  if (!Array.isArray(value.requiredPersonalizationFields))
    throw new TypeError(
      'personalization.requiredPersonalizationFields must be an array',
    );
  if (value.requiredPersonalizationFields.length === 0)
    throw new TypeError(
      'personalization.requiredPersonalizationFields must contain at least one field',
    );

  const requiredPersonalizationFields = value.requiredPersonalizationFields.map(
    (field, index) => {
      if (typeof field !== 'string' || !PERSONALIZATION_FIELDS.has(field)) {
        throw new TypeError(
          `personalization.requiredPersonalizationFields[${index}] is invalid`,
        );
      }
      return field as RequiredPersonalizationField;
    },
  );

  const res: Personalization = {
    description: value.description,
    requiredPersonalizationFields,
  };

  if (value.termsAndConditions !== undefined) {
    if (typeof value.termsAndConditions !== 'string')
      throw new TypeError(
        'personalization.termsAndConditions must be a string',
      );
    res.termsAndConditions = value.termsAndConditions;
  }

  return res;
}

export function parsePersonalizationBuffer(buffer: Buffer): Personalization {
  return validatePersonalization(
    JSON.parse(stripJsonComments(buffer.toString('utf8'))),
  );
}

export function createPersonalizationEntry(personalization: Personalization): {
  path: 'personalization.json';
  data: Buffer;
} {
  return {
    path: 'personalization.json',
    data: Buffer.from(JSON.stringify(validatePersonalization(personalization))),
  };
}

export function isPersonalizationLogoPath(path: string): boolean {
  return PERSONALIZATION_LOGO_RE.test(path);
}
