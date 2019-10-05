/* eslint-disable max-depth */
/**
 * Class that implements base structure fields setters / getters
 *
 * @see {@link https://developer.apple.com/library/content/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/LowerLevel.html#//apple_ref/doc/uid/TP40012026-CH3-SW3}
 */

import {
  ApplePass,
  PassStyle,
  TransitType,
  PassCommonStructure,
} from '../interfaces';
import { PASS_STYLES, TRANSIT, STRUCTURE_FIELDS } from '../constants';

import { FieldsMap } from './fieldsMap';
import { NFCField } from './nfc-fields';

export class PassStructure {
  protected fields: Partial<ApplePass> = {};

  // eslint-disable-next-line sonarjs/cognitive-complexity
  constructor(fields: Partial<ApplePass> = {}) {
    // setting style first
    for (const style of PASS_STYLES) {
      if (style in fields) {
        this.style = style;
        if ('boardingPass' in fields && fields.boardingPass) {
          this.transitType = fields.boardingPass.transitType;
        } else if ('storeCard' in this.fields && 'nfc' in fields) {
          // check NFC fields
          this.fields.nfc = new NFCField(fields.nfc);
        }
        const structure: PassCommonStructure = fields[this.style];
        for (const prop of STRUCTURE_FIELDS) {
          if (prop in structure) {
            const currentProperty = structure[prop];
            if (Array.isArray(currentProperty))
              for (const field of currentProperty) this[prop].add(field);
            else if (currentProperty instanceof FieldsMap)
              // copy fields
              for (const [key, data] of currentProperty)
                this[prop].add({ key, ...data });
          }
        }
      }
    }
  }

  /**
   * Pass type, e.g boardingPass, coupon, etc
   */
  get style(): PassStyle | undefined {
    for (const style of PASS_STYLES) {
      if (style in this.fields) return style;
    }
    return undefined;
  }

  set style(v: PassStyle | undefined) {
    // remove all other styles
    for (const style of PASS_STYLES) if (style !== v) delete this.fields[style];
    if (!v) return;
    if (!PASS_STYLES.has(v)) throw new TypeError(`Invalid Pass type "${v}"`);
    if (!(v in this.fields)) this.fields[v] = {};
    // Add NFC fields
    if ('storeCard' in this.fields) this.fields.nfc = new NFCField();
    //   if ('boardingPass' in this.fields && this.fields.boardingPass) this.fields.boardingPass.
  }

  /**
   * Required for boarding passes; otherwise not allowed.
   * Type of transit.
   * Must be one of the following values: PKTransitTypeAir, PKTransitTypeBoat, PKTransitTypeBus, PKTransitTypeGeneric,PKTransitTypeTrain.
   */
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
      // removing transitType on empty pass does nothing
      if (!v) return;
      // setting transitStyle on a pass without type will set this pass as boardingPass also
      this.style = 'boardingPass';
    }
    if (!('boardingPass' in this.fields))
      throw new ReferenceError(
        `transitType field is only allowed at boarding passes`,
      );

    if (!v) {
      if (this.fields.boardingPass) delete this.fields.boardingPass.transitType;
    } else {
      if (Object.values(TRANSIT).includes(v)) {
        if (this.fields.boardingPass) this.fields.boardingPass.transitType = v;
        else this.fields.boardingPass = { transitType: v };
      } else throw new TypeError(`Unknown transit type "${v}"`);
    }
  }

  /**
   * NFC-enabled pass keys support sending reward card information as part of an Apple Pay transaction.
   *
   * NFC-enabled pass keys are only supported in passes that contain an Enhanced Passbook/NFC certificate.
   * For more information, contact merchant support at https://developer.apple.com/contact/passkit/.
   * **Only for storeCards with special Apple approval**
   *
   * @see {@link https://developer.apple.com/library/archive/documentation/UserExperience/Reference/PassKit_Bundle/Chapters/TopLevel.html#//apple_ref/doc/uid/TP40012026-CH2-DontLinkElementID_3}
   */
  get nfc(): NFCField {
    if (!('storeCard' in this.fields))
      throw new ReferenceError(
        `NFC fields only available for storeCard passes, current is ${this.style}`,
      );
    return this.fields.nfc as NFCField;
  }

  get headerFields(): FieldsMap {
    const { style } = this;
    if (!style)
      throw new ReferenceError(
        `Pass style is undefined, set the pass style before accessing pass structure fields`,
      );
    if (!(this.fields[style].headerFields instanceof FieldsMap))
      this.fields[style].headerFields = new FieldsMap();
    return this.fields[style].headerFields;
  }
  get auxiliaryFields(): FieldsMap {
    const { style } = this;
    if (!style)
      throw new ReferenceError(
        `Pass style is undefined, set the pass style before accessing pass structure fields`,
      );
    if (!(this.fields[style].auxiliaryFields instanceof FieldsMap))
      this.fields[style].auxiliaryFields = new FieldsMap();
    return this.fields[style].auxiliaryFields;
  }
  get backFields(): FieldsMap {
    const { style } = this;
    if (!style)
      throw new ReferenceError(
        `Pass style is undefined, set the pass style before accessing pass structure fields`,
      );
    if (!(this.fields[style].backFields instanceof FieldsMap))
      this.fields[style].backFields = new FieldsMap();
    return this.fields[style].backFields;
  }
  get primaryFields(): FieldsMap {
    const { style } = this;
    if (!style)
      throw new ReferenceError(
        `Pass style is undefined, set the pass style before accessing pass structure fields`,
      );
    if (!(this.fields[style].primaryFields instanceof FieldsMap))
      this.fields[style].primaryFields = new FieldsMap();
    return this.fields[style].primaryFields;
  }
  get secondaryFields(): FieldsMap {
    const { style } = this;
    if (!style)
      throw new ReferenceError(
        `Pass style is undefined, set the pass style before accessing pass structure fields`,
      );
    if (!(this.fields[style].secondaryFields instanceof FieldsMap))
      this.fields[style].secondaryFields = new FieldsMap();
    return this.fields[style].secondaryFields;
  }
}
