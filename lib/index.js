// Exports function for creating a new template, from which you can create new
// passes.

var Template = require("./template");


// Create a new template.
//
// style  - Pass style (coupon, eventTicket, etc)
// fields - Pass fields (passTypeIdentifier, teamIdentifier, etc) 
function createTemplate(style, fields) {
  return new Template(style, fields);
}

module.exports = createTemplate;
