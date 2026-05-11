// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

import * as constants from './constants.js';

export { constants };
export { Template } from './template.js';
export { Pass } from './pass.js';
export type {
  SemanticTags,
  SemanticTagValue,
  SemanticTagObject,
  // Semantic-tag sub-types
  CurrencyAmount,
  EventDateInfo,
  PersonNameComponents,
  Seat,
  SemanticLocation,
  WifiNetwork,
  PKPassengerCapability,
  PKTransitSecurityProgram,
  // iOS 18 / 26 top-level key mixins
  PassEventTicketKeys,
  PassEnhancedBoardingPassKeys,
  PassUpcomingKeys,
} from './interfaces.js';
export type {
  DateInformation,
  Image,
  Images,
  ImageURLEntry,
  UpcomingEntrySemantics,
  UpcomingPassInformationEntry,
  UpcomingPassInformationType,
  UpcomingURLs,
} from './lib/upcoming-pass-information.js';
export type {
  Personalization,
  RequiredPersonalizationField,
} from './lib/personalization.js';
