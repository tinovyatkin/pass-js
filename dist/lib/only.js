"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Returns object with only selected properties
 *
 */
function only(obj, props) {
    if (!obj || typeof obj !== "object" || !Object.keys(obj).length)
        return {};
    if (!props)
        return obj;
    const res = {};
    const properties = props.trim().split(/\s+/);
    if (properties.length < 1)
        return res;
    Object.defineProperties(res, properties
        .filter((prop) => obj.hasOwnProperty(prop))
        .reduce((result, prop) => {
        result[prop] = Object.getOwnPropertyDescriptor(obj, prop);
        return result;
    }, {}));
    return res;
}
exports.only = only;
