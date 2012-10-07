// Exports function for creating a new template.

var Crypto  = require("crypto");
var File    = require("fs");
var Path    = require("path");
var spawn   = require("child_process").spawn;
var Zip     = require("./zip");


// Template will have accessor methods for these fields.
var TEMPLATE = ["passTypeIdentifier", "teamIdentifier", 
                "backgroundColor", "foregroundColor", "labelColor", "logoText",
                "suppressStripShine", "webServiceURL"];
// Supported passbook styles.
var STYLES = ["boardingPass", "coupon", "eventTicket", "generic", "storeCard"];
// Top-level passbook fields.
var TOP_LEVEL = ["description", "organizationName", "serialNumber", "locations", "relevantDate",
                 "barcode", "backgroundColor", "foregroundColor", "labelColor", "logoText",
                 "suppressStripShine", "authenticationToken", "webServiceURL"];
// These top level fields are required for a valid passbook
var REQUIRED_TOP_LEVEL = ["passTypeIdentifier", "teamIdentifier", "serialNumber", "organizationName", "description"];
// Passbook structure keys.
var STRUCTURE = ["headerFields", "primaryFields", "secondaryFields", "auxiliaryFields",
                 "backFields", "transitType"];
// Supported images.
var IMAGES = ["background", "footer", "icon", "logo", "strip", "thumbnail"];
// These images are required for a valid passbook.
var REQUIRED_IMAGES = ["icon", "logo"];


// Create a new template.
//
// style  - Passbook style (coupon, eventTicket, etc)
// fields - Passbook fields (passTypeIdentifier, teamIdentifier, etc) 
function createTemplate(style, fields) {
  return new Template(style, fields);
}


// Create a new template.
//
// style  - Passbook style (coupon, eventTicket, etc)
// fields - Passbook fields (passTypeIdentifier, teamIdentifier, etc) 
function Template(style, fields) {
  if (!STYLES.indexOf(style))
    throw new Error("Unsupported passbook style " + style);
  this.style = style;
  this.fields = cloneObject(fields);
}

// Create a new passbook from a template.
Template.prototype.createPassbook = function(fields) {
  // Combine template and passbook fields
  var combined = {};
  for (var key in this.fields)
    combined[key] = this.fields[key];
  for (var key in fields)
    combined[key] = fields[key];
  return new Passbook(this.style, combined);
}

// Accessor methods for template fields.
//
// Call with an argument to set field and return self, call with no argument to
// get field value.
//
//   template.passTypeIdentifier("com.example.mypass");
//   console.log(template.passTypeIdentifier());
TEMPLATE.forEach(function(key) {
  Template.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.fields[key];
    } else {
      this.fields[key] = value;
      return this;
    }
  }
});


// Create a new passbook.
//
// style  - Passbook style (coupon, eventTicket, etc)
// fields - Passbook fields (description, serialNumber, logoText)
function Passbook(style, fields) {
  this.style = style;
  this.fields = cloneObject(fields);
  // Structure is basically reference to all the fields under a given style
  // key, e.g. if style is coupon then structure.primaryFields maps to
  // fields.coupon.primaryFields.
  this.structure = this.fields[this.style];
  if (!this.structure)
    this.structure = this.fields[this.style] = {};
  this.images = {};
}

// Accessor methods for top-level fields (description, serialNumber, logoText,
// etc).
//
// Call with an argument to set field and return self, call with no argument to
// get field value.
//
//   passbook.description("Unbelievable discount");
//   console.log(passbook.description());
TOP_LEVEL.forEach(function(key) {
  Passbook.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.fields[key];
    } else {
      this.fields[key] = value;
      return this;
    }
  }
});

// Accessor methods for structure fields (primaryFields, backFields, etc).
//
// Call with an argument to set field and return self, call with no argument to
// get field value.
//
//   passbook.headerFields({ key: "time", value: "10:00AM" });
//   console.log(passbook.headerFields());
STRUCTURE.forEach(function(key) {
  Passbook.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.structure[key];
    } else {
      this.structure[key] = value;
      return this;
    }
  }
});

// Accessor methods for images (logo, strip, etc).
//
// Call with an argument to set the image and return self, call with no
// argument to get image value.
//
//   passbook.icon(function(callback) { ... };
//   console.log(passbook.icon());
//
// The 2x suffix is used for high resolution version (file name uses @2x
// suffix).
//
//   passbook.icon2x("icon@2x.png");
//   console.log(passbook.icon2x());
IMAGES.forEach(function(key) {
  Passbook.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.images[key];
    } else {
      this.images[key] = value;
      return this;
    }
  }
  var double = key + "2x";
  Passbook.prototype[double] = function(value) {
    if (arguments.length == 0) {
      return this.images[double];
    } else {
      this.images[double] = value;
      return this;
    }
  }
})

// Load all images from the specified directory. Only supported images are
// loaded, nothing bad happens if directory contains other files.
//
// path - Directory containing images to load
Passbook.prototype.loadImagesFrom = function(path) {
  var self = this;
  var files = File.readdirSync(path);
  files.forEach(function(filename) {
    var basename = Path.basename(filename, ".png");
    if (/@2x$/.test(basename) && ~IMAGES.indexOf(basename.slice(0, -3))) {
      // High resolution
      self.images[basename.replace(/@2x/, "2x")] = Path.resolve(path, filename);
    } else if (~IMAGES.indexOf(basename)) {
      // Normal resolution
      self.images[basename] = Path.resolve(path, filename);
    }
  });
  return this;
}

// Validate passbook, throws error if missing a mandatory top-level field or image.
Passbook.prototype.validate = function() {
  for (var i in REQUIRED_TOP_LEVEL) {
    var key = REQUIRED_TOP_LEVEL[i];
    if (!this.fields[key] && !this.template.fields[key])
      throw new Error("Missing field " + key);
  }
  for (var i in REQUIRED_IMAGES) {
    var key = REQUIRED_IMAGES[i];
    if (!this.images[key])
      throw new Error("Missing image " + key + ".png");
  }
}

// Create the passbook.
//
// options  - Various options
// callback - Called with error or null and the passbook data (Buffer)
//
// Options are:
// password - Password for the PKCS12 key
Passbook.prototype.create = function(options, callback) {
  var self = this;
  var zip = new Zip();

  // Validate before attempting to create
  try {
    this.validate();
  } catch (error) {
    callback(error);
    return;
  }

  // Create pass.json
  var fields = cloneObject(this.fields);
  fields.formatVersion = 1;
  var passJson = new Buffer(JSON.stringify(fields), "utf-8");

  // Get image from key
  function getImage(key, done) {
    var image = self.images[key];
    if (typeof image == "string" || image instanceof String) {
      // image is a filename, load from disk
      File.readFile(image, done);
    } else if (image instanceof Buffer) {
      done(null, image);
    } else if (typeof image == "function") {
      // image is a function, call it to obtain image
      try {
        image(done);
      } catch (error) {
        done(error);
      }
    } else if (image) {
      // image is not a supported type
      done(new Error("Cannot load image " + key + ", must be String (filename), Buffer or function"));
    } else
      done();
  }

  // Add next pair of images from the list of keys
  function addNextImage(imageKeys, files, done) {
    var imageKey = imageKeys[0];
    if (imageKey) {
      // Add normal resolution
      getImage(imageKey, function(error, buffer) {
        if (error) {
          done(error);
        } else {
          if (buffer) {
            files[imageKey + ".png"] = buffer;
          }
          // Add high resolution
          getImage(imageKey + "2x", function(error, buffer) {
            if (error) {
              done(error);
            } else {
              if (buffer)
                files[imageKey + "@2x.png"] = buffer;
              addNextImage(imageKeys.slice(1), files, done);
            }
          });
        }
      });
    } else
      done();
  }

  // These are all the files that will show in the manifest
  var files = { "pass.json": passJson };
  // Start adding all the images
  addNextImage(IMAGES, files, function(error) {
    if (error) {
      callback(error);
    } else {
      // Now that we have a map of all the images, add them to the zip
      Object.keys(files).forEach(function(filename) {
        zip.addFile(filename, files[filename]);
      });

      // Calculate the manifest and add it as well
      var manifest = createManifest(files);
      zip.addFile("manifest.json", new Buffer(manifest, "utf-8"));

      // Sign the manifest and add the signature
      signManifest(self.fields.passTypeIdentifier, manifest, options.password, function(error, signature) {
        if (error) {
          callback(error);
        } else {
          zip.addFile("signature", signature);
          // Create Zip file
          zip.generate(function(error, buffer) {
            callback(error, buffer);
          });
        }
      });
    }
  });

}

// Creates a manifest from map of files. Returns as a string.
function createManifest(files) {
  var manifest = {};
  for (var filename in files) {
    var file = files[filename];
    var sha = Crypto.createHash("sha1").update(file).digest("hex");
    manifest[Path.basename(filename)] = sha;
  }
  return JSON.stringify(manifest);
}

// Signs a manifest and returns the signature.
function signManifest(passTypeIdentifier, manifest, password, callback) {
  var identifier = passTypeIdentifier.replace(/pass./, "");

  var args = [
    "smime",
    "-sign",
    "-signer", __dirname + "/../certs/" + identifier + ".pem",
    "-inkey", __dirname + "/../certs/" + identifier + ".pem",
    "-certfile", __dirname + "/../certs/wwdr.pem"
  ];
  if (password)
    args.push("-passin", "pass:" + password)
  var sign = spawn("openssl", args);
  var error = "";
  var output = "";
  sign.stdout.on("data", function(data) {
    output = output + data.toString("binary");
  });
  sign.stderr.on("data", function(data) {
    error = error + data;
  });
  sign.on("exit", function(code) {
    if (code == 0) {
      var signature = output.split(/\n\n/)[3];
      callback(null, new Buffer(signature, "base64"));
    } else {
      callback(new Error(error));
    }
  });
  sign.stdin.write(manifest);
  sign.stdin.end();
}

// Clone an object by copying all its properties and returning new object.
// If the argument is missing or null, returns a new object.
function cloneObject(object) {
  var clone = {};
  if (object) {
    for (var key in object)
      clone[key] = object[key];
  }
  return clone;
}


module.exports = createTemplate;
