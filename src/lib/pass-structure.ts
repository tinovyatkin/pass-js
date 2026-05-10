// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

/**
 * Class that implements base structure fields setters / getters
 *
 * @see {@link https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3}
 */

import type {
  ApplePass,
  PassStyle,
  TransitType,
  PassCommonStructure,
} from '../interfaces.js';
import { PASS_STYLES, TRANSIT, STRUCTURE_FIELDS } from '../constants.js';

import { FieldsMap } from './fieldsMap.js';
import { NFCField } from './nfc-fields.js';

type StructureFieldName =
  | 'headerFields'
  | 'auxiliaryFields'
  | 'backFields'
  | 'primaryFields'
  | 'secondaryFields'
  | 'additionalInfoFields';

export class PassStructure {
  protected fields: Partial<ApplePass> = {};

  constructor(fields: Partial<ApplePass> = {}) {
    for (const style of PASS_STYLES) {
      if (!(style in fields)) continue;
      this.style = style;
      if ('boardingPass' in fields && fields.boardingPass) {
        this.transitType = fields.boardingPass.transitType;
      } else if ('storeCard' in this.fields && 'nfc' in fields) {
        this.fields.nfc = new NFCField(fields.nfc);
      }
      const structure = fields[style as keyof ApplePass] as
        | PassCommonStructure
        | undefined;
      if (!structure) continue;
      for (const prop of STRUCTURE_FIELDS) {
        if (!(prop in structure)) continue;
        const currentProperty = structure[prop as keyof PassCommonStructure];
        const target = this[prop as StructureFieldName];
        if (Array.isArray(currentProperty))
          for (const field of currentProperty) target.add(field);
        else if (currentProperty instanceof FieldsMap)
          for (const [key, data] of currentProperty)
            target.add({ key, ...data });
      }
    }
  }

  // Returns the structure container for the current pass style, creating it
  // if it doesn't exist. Throws if no style is set.
  private structure(): PassCommonStructure {
    const { style } = this;
    if (!style)
      throw new ReferenceError(
        `Pass style is undefined, set the pass style before accessing pass structure fields`,
      );
    const s = this.fields[style as keyof ApplePass];
    if (s) return s as PassCommonStructure;
    const fresh = {} as PassCommonStructure;
    (this.fields as Record<PassStyle, PassCommonStructure>)[style] = fresh;
    return fresh;
  }

  private fieldMap(name: StructureFieldName): FieldsMap {
    const s = this.structure();
    if (!(s[name] instanceof FieldsMap)) s[name] = new FieldsMap();
    return s[name] as FieldsMap;
  }

  /** Pass type, e.g. boardingPass, coupon, etc. */
  get style(): PassStyle | undefined {
    for (const style of PASS_STYLES) {
      if (style in this.fields) return style;
    }
    return undefined;
  }

  set style(v: PassStyle | undefined) {
    for (const style of PASS_STYLES)
      if (style !== v) delete this.fields[style as keyof ApplePass];
    // NFC is a storeCard-only field; drop any carry-over when switching away.
    if (v !== 'storeCard')
      delete (this.fields as Partial<{ nfc: unknown }>).nfc;
    if (!v) return;
    if (!PASS_STYLES.has(v)) throw new TypeError(`Invalid Pass type "${v}"`);
    if (!(v in this.fields))
      (this.fields as Record<PassStyle, PassCommonStructure>)[v] =
        {} as PassCommonStructure;
    if ('storeCard' in this.fields && !this.fields.nfc)
      this.fields.nfc = new NFCField();
  }

  get transitType(): TransitType | undefined {
    if (this.style !== 'boardingPass')
      throw new ReferenceError(
        `transitType field only allowed in Boarding Passes, current pass is ${this.style}`,
      );
    if ('boardingPass' in this.fields && this.fields.boardingPass)
      return this.fields.boardingPass.transitType;
    return undefined;
  }

  set transitType(v: TransitType | undefined) {
    const { style } = this;
    if (!style) {
      if (!v) return;
      this.style = 'boardingPass';
    }
    if (!('boardingPass' in this.fields))
      throw new ReferenceError(
        `transitType field is only allowed at boarding passes`,
      );

    if (!v) {
      if (this.fields.boardingPass)
        delete (this.fields.boardingPass as { transitType?: TransitType })
          .transitType;
    } else {
      if (Object.values(TRANSIT).includes(v)) {
        if (this.fields.boardingPass) this.fields.boardingPass.transitType = v;
        else this.fields.boardingPass = { transitType: v };
      } else throw new TypeError(`Unknown transit type "${v}"`);
    }
  }

  get nfc(): NFCField {
    if (!('storeCard' in this.fields))
      throw new ReferenceError(
        `NFC fields only available for storeCard passes, current is ${this.style}`,
      );
    return this.fields.nfc as NFCField;
  }

  get headerFields(): FieldsMap {
    return this.fieldMap('headerFields');
  }
  get auxiliaryFields(): FieldsMap {
    return this.fieldMap('auxiliaryFields');
  }
  get backFields(): FieldsMap {
    return this.fieldMap('backFields');
  }
  get primaryFields(): FieldsMap {
    return this.fieldMap('primaryFields');
  }
  get secondaryFields(): FieldsMap {
    return this.fieldMap('secondaryFields');
  }

  // iOS 18 event-ticket dashboard fields. Only valid on eventTicket
  // passes — mirrors the style gating used by `transitType` (boardingPass)
  // and `nfc` (storeCard).
  get additionalInfoFields(): FieldsMap {
    if (this.style !== 'eventTicket')
      throw new ReferenceError(
        `additionalInfoFields only allowed on eventTicket passes, current style is ${this.style}`,
      );
    return this.fieldMap('additionalInfoFields');
  }
}
