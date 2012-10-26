var applyImageMethods = require("./images");
var Crypto            = require("crypto");
var execFile          = require("child_process").execFile;
var Stream            = require("stream");
var inherits          = require("util").inherits;
var File              = require("fs");
var HTTP              = require("http");
var HTTPS             = require("https");
var Path              = require("path");
var Zip               = require("./zip");


// Top-level passbook fields.
var TOP_LEVEL           = [ "authenticationToken", "backgroundColor", "barcode", "description",
                            "foregroundColor", "labelColor", "locations", "logoText",
                            "organizationName", "relevantDate", "serialNumber", 
                            "suppressStripShine", "webServiceURL"];
// These top level fields are required for a valid passbook
var REQUIRED_TOP_LEVEL  = [ "description", "organizationName", "passTypeIdentifier",
                            "serialNumber", "teamIdentifier" ];
// Passbook structure keys.
var STRUCTURE           = [ "auxiliaryFields", "backFields", "headerFields",
                            "primaryFields", "secondaryFields", "transitType" ];
// These images are required for a valid passbook.
var REQUIRED_IMAGES     = [ "icon", "logo" ];




// Create a new passbook.
//
// tempplate  - The template
// fields     - Passbook fields (description, serialNumber, logoText)
function Passbook(template, fields, images) {
  this.template = template;
  this.fields = cloneObject(fields);
  // Structure is basically reference to all the fields under a given style
  // key, e.g. if style is coupon then structure.primaryFields maps to
  // fields.coupon.primaryFields.
  var style = template.style;
  this.structure = this.fields[style];
  if (!this.structure)
    this.structure = this.fields[style] = {};
  this.images = cloneObject(images);
}

applyImageMethods(Passbook);


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
    if (arguments.length === 0) {
      return this.fields[key];
    } else {
      this.fields[key] = value;
      return this;
    }
  };
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
    if (arguments.length === 0) {
      return this.structure[key];
    } else {
      this.structure[key] = value;
      return this;
    }
  };
});


// Validate passbook, throws error if missing a mandatory top-level field or image.
Passbook.prototype.validate = function() {
  for (var i in REQUIRED_TOP_LEVEL) {
    var k1 = REQUIRED_TOP_LEVEL[i];
    if (!this.fields[k1])
      throw new Error("Missing field " + k1);
  }
  for (var j in REQUIRED_IMAGES) {
    var k2 = REQUIRED_IMAGES[j];
    if (!this.images[k2])
      throw new Error("Missing image " + k2 + ".png");
  }
};

// Returns the pass.json object (not a string).
Passbook.prototype.getPassbookJSON = function() {
  var fields = cloneObject(this.fields);
  fields.formatVersion = 1;
  return fields;
};


// Generate Passbook file and stream it to output stream.
//
// output     - Output stream
// callback   - Optional, notified when done writing
Passbook.prototype.pipe = function(output, callback) {
  var self = this;
  var zip = new Zip(output);

  if (callback) {
    zip.on("close", callback);
    zip.on("error", callback);
  }

  // Validate before attempting to create
  this.validate();
  // Construct manifest here
  var manifest = {};
  // Add file to zip and it's SHA to manifest
  function addFile(filename) {
    var file = zip.addFile(filename);
    var sha = new SHAWriteStream(manifest, filename, file);
    return sha;
  }

  // Create pass.json
  var passJson = new Buffer(JSON.stringify(this.getPassbookJSON()), "utf-8");
  addFile("pass.json").end(passJson, "utf8");

  var expecting = 0;
  var lastError;
  for (var key in this.images) {
    var filename = key.replace(/2x$/, "@2x") + ".png";
    addImage(addFile(filename), this.images[key], function(error) {
      --expecting;
      if (error)
        lastError = error;
      if (expecting === 0)
        done(lastError);
    });
    ++expecting;
  }

  function done(error) {
    if (error) {
      callback(error);
    } else {
      self.signZip(zip, manifest, function(error) {
        zip.close();
      });
    }
  }
  return;
};


function addImage(file, source, callback) {
  if (typeof(source) == "string" || source instanceof String) {
    if (/^https?:/i.test(source)) {
      // URL
      var protocol = /^https:/i.test(source) ? HTTPS : HTTP;
      protocol.get(source, function(response) {
        if (response.statusCode == 200) {
          response.on("end", callback);
          response.pipe(file);
          response.resume();
        } else
          callback(new Error("Server returned " + response.statusCode + " for " + source));
      }).on("error", callback);
    } else {
      // Assume filename
      var stream = File.createReadStream(source);
      stream.pipe(file);
      file.on("close", callback);
    }
  } else if (source instanceof Buffer) {
    file.end(buffer);
    callback();
  } else if (typeof(source) == "function") {
    try {
      source(file);
      callback();
    } catch (error) {
      callback(error);
    }
  } else {
    // image is not a supported type
    callback(new Error("Cannot load image " + file.filename + ", must be String (filename), Buffer or function"));
  }
}


// Add manifest.json and signature files.
Passbook.prototype.signZip = function(zip, manifest, callback) {
  var json = JSON.stringify(manifest);
  // Add manifest.json
  zip.addFile("manifest.json").end(json, "utf-8");
  // Create signature
  signManifest(this.template, json, function(error, signature) {
    if (!error) {
      // Write signature file
      zip.addFile("signature").end(signature);
    }
    callback(error);
  });
};


// Signs a manifest and returns the signature.
function signManifest(template, manifest, callback) {
  var identifier = template.passTypeIdentifier().replace(/^pass./, "");

  var args = [
    "smime",
    "-sign", "-binary",
    "-signer",    Path.resolve(template.keysPath, identifier + ".pem"),
    "-certfile",  Path.resolve(template.keysPath, "wwdr.pem"),
    "-passin",    "pass:" + template.password
  ];
  var sign = execFile("openssl", args, { stdio: "pipe" }, function(error, stdout, stderr) {
    if (error) {
      callback(new Error(stderr));
    } else {
      var signature = stdout.split(/\n\n/)[3];
      callback(null, new Buffer(signature, "base64"));
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


// -- Manifest output stream --


// A write stream that calculates SHA from the output and updates the manifest
// accordingly.
//
// manifest - Manifest object
// filename - Filename (manifest property to set)
// output   - Pipe to this output stream
function SHAWriteStream(manifest, filename, output) {
  this.output = output;
  this.manifest = manifest;
  this.filename = filename;
  this.sha = Crypto.createHash("sha1");
  output.on("close", this.emit.bind(this, "close"));
  output.on("error", this.emit.bind(this, "error"));
  var self = this;
  this.on("pipe", function(source) {
    source.on("data", self.write.bind(self));
    source.resume();
  });
}

inherits(SHAWriteStream, Stream);

SHAWriteStream.prototype.write = function(buffer, encoding) {
  this.output.write(buffer, encoding);
  this.sha.update(buffer, encoding);
  return true;
};

SHAWriteStream.prototype.end = function(buffer, encoding) {
  if (buffer)
    this.write(buffer, encoding);
  this.output.end();
  this.manifest[this.filename] = this.sha.digest("hex");
};


module.exports = Passbook;
