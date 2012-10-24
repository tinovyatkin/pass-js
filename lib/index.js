// Exports function for creating a new template, from which you can create new
// passbooks.

var Template = require("./template");


// Create a new template.
//
// style  - Passbook style (coupon, eventTicket, etc)
// fields - Passbook fields (passTypeIdentifier, teamIdentifier, etc) 
function createTemplate(style, fields) {
  return new Template(style, fields);
}

module.exports = createTemplate;

