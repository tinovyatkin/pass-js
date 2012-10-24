// Passbook are created from templates


var applyImageMethods = require("./images");
var Passbook          = require("./passbook");


// Supported passbook styles.
var STYLES              = [ "boardingPass", "coupon", "eventTicket", "generic", "storeCard" ];
// Template will have accessor methods for these fields.
var TEMPLATE            = [ "passTypeIdentifier", "teamIdentifier",
                            "backgroundColor", "foregroundColor", "labelColor", "logoText",
                            "organizationName", "suppressStripShine", "webServiceURL"];


// Create a new template.
//
// style  - Passbook style (coupon, eventTicket, etc)
// fields - Passbook fields (passTypeIdentifier, teamIdentifier, etc) 
function Template(style, fields) {
  if (!~STYLES.indexOf(style))
    throw new Error("Unsupported passbook style " + style);
  this.style = style;
  this.fields = {};
  for (var key in fields)
    this.fields[key] = fields[key];
  this.keysPath = "keys";
  this.images = {};
}

applyImageMethods(Passbook);


// Sets path to directory containing keys and password for accessing keys.
//
// path     - Path to directory containing key files (default is 'keys')
// password - Password to use with keys
Template.prototype.keys = function(path, password) {
  if (path)
    this.keysPath = path;
  if (password)
    this.password = password;
};


// Create a new passbook from a template.
Template.prototype.createPassbook = function(fields) {
  // Combine template and passbook fields
  var combined = {};
  for (var k1 in this.fields)
    combined[k1] = this.fields[k1];
  for (var k2 in fields)
    combined[k2] = fields[k2];
  return new Passbook(this, combined, this.images);
};


// Accessor methods for template fields.
//
// Call with an argument to set field and return self, call with no argument to
// get field value.
//
//   template.passTypeIdentifier("com.example.mypass");
//   console.log(template.passTypeIdentifier());
TEMPLATE.forEach(function(key) {
  Template.prototype[key] = function(value) {
    if (arguments.length === 0) {
      return this.fields[key];
    } else {
      this.fields[key] = value;
      return this;
    }
  };
});


module.exports = Template;

