// Generate a pass file.

var applyImageMethods = require("./images");
var Crypto            = require("crypto");
var EventEmitter      = require("events").EventEmitter;
var execFile          = require("child_process").execFile;
var Stream            = require("stream");
var inherits          = require("util").inherits;
var File              = require("fs");
var HTTP              = require("http");
var HTTPS             = require("https");
var Path              = require("path");
var Zip               = require("./zip");


// Top-level pass fields.
var TOP_LEVEL           = [ "authenticationToken", "backgroundColor", "barcode", "description",
                            "foregroundColor", "labelColor", "locations", "logoText",
                            "organizationName", "relevantDate", "serialNumber", 
                            "suppressStripShine", "webServiceURL"];
// These top level fields are required for a valid pass.
var REQUIRED_TOP_LEVEL  = [ "description", "organizationName", "passTypeIdentifier",
                            "serialNumber", "teamIdentifier" ];
// Pass structure keys.
var STRUCTURE_FIELDS    = [ "auxiliaryFields", "backFields", "headerFields",
                            "primaryFields", "secondaryFields" ];
// These images are required for a valid pass.
var REQUIRED_IMAGES     = [ "icon", "logo" ];




// Create a new pass.
//
// template  - The template
// fields    - Pass fields (description, serialNumber, logoText)
function Pass(template, fields, images) {
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

inherits(Pass, EventEmitter);
applyImageMethods(Pass);


// Accessor methods for top-level fields (description, serialNumber, logoText,
// etc).
//
// Call with an argument to set field and return self, call with no argument to
// get field value.
//
//   pass.description("Unbelievable discount");
//   console.log(pass.description());
TOP_LEVEL.forEach(function(key) {
  Pass.prototype[key] = function(value) {
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
// For example:
//
//   pass.headerFields.add("time", "The Time", "10:00AM");
//   pass.backFields.add("url", "Web site", "http://example.com");
STRUCTURE_FIELDS.forEach(function(key) {
  Pass.prototype.__defineGetter__(key, function() {
    return new Fields(this, key);
  });
});


// Field accessors.
function Fields(pass, key) {
  this.pass = pass;
  this.key = key;
}


// Adds a field to the end of the list.
//
// You can call this method with three/four arguments:
// key      - Field key
// label    - Field label (optional)
// value    - Field value
// options  - Other field options (e.g. dateStyle)
//
// You can call this method with a single object that contains all field
// properties (key, label, etc).
//
// You can also call with an array of either one.
//
// Returns self.
Fields.prototype.add = function(key, label, value, options) {
  var field, k;
  if (arguments.length > 1) {
    this.remove(key);
    field = { key: key, value: value };
    if (label)
      field.label = label;
    if (options) {
      for (k in options)
        field[k] = options[k];
    }
    this.all().push(field);
  } else if (Array.isArray(arguments[0])) {
    var array = arguments[0];
    for (var i in array)
      this.add.call(this, array[i]);
  } else {
    var properties = arguments[0];
    key = properties.key;
    this.remove(key);
    field = {};
      for (k in properties)
        field[k] = properties[k];
    this.all().push(field);
  }
  return this;
};

// Returns a field.
//
// If field exists, returns an object with:
// key      - Field key
// label    - Field label (optional)
// value    - Field value
// Other field options (e.g. dateStyle) 
Fields.prototype.get = function(key) {
  var fields = this.pass.structure[this.key];
  if (fields) {
    for (var i in fields) {
      var field = fields[i];
      if (field.key == key)
        return field;
    }
  }
  return null;
};

// Returns an array of all fields.
Fields.prototype.all = function() {
  var fields = this.pass.structure[this.key];
  if (!fields)
    this.pass.structure[this.key] = fields = [];
  return fields;
};

// Removes a given field.
Fields.prototype.remove = function(key) {
  var fields = this.pass.structure[this.key];
  if (fields) {
    for (var i in fields) {
      if (fields[i].key == key) {
        fields.splice(i, 1);
        break;
      }
    }
  }
  return this;
};

// Removes all fields.
Fields.prototype.clear = function() {
  this.pass.structure[this.key] = [];
  return this;
};


// Validate pass, throws error if missing a mandatory top-level field or image.
Pass.prototype.validate = function() {
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
Pass.prototype.getPassJSON = function() {
  var fields = cloneObject(this.fields);
  fields.formatVersion = 1;
  return fields;
};


// Pipe pass to a write stream.
//
// output - Write stream
Pass.prototype.pipe = function(output) {
  var self = this;
  var zip = new Zip(output);
  var lastError;

  zip.on("error", function(error) {
    lastError = error;
  });

  // Validate before attempting to create
  try {
    this.validate();
  } catch (error) {
    process.nextTick(function() {
      self.emit("error", error);
    });
    return;
  }

  // Construct manifest here
  var manifest = {};
  // Add file to zip and it's SHA to manifest
  function addFile(filename) {
    var file = zip.addFile(filename);
    var sha = new SHAWriteStream(manifest, filename, file);
    return sha;
  }

  // Create pass.json
  var passJson = new Buffer(JSON.stringify(this.getPassJSON()), "utf-8");
  addFile("pass.json").end(passJson, "utf8");

  var expecting = 0;
  for (var key in this.images) {
    var filename = key.replace(/2x$/, "@2x") + ".png";
    addImage(addFile(filename), this.images[key], function(error) {
      --expecting;
      if (error)
        lastError = error;
      if (expecting === 0)
        doneWithImages();
    });
    ++expecting;
  }

  function doneWithImages() {
    if (lastError) {
      zip.close();
      self.emit("error", lastError);
    } else {
      process.nextTick(function() {
        self.signZip(zip, manifest, function(error) {
          zip.close();
          zip.on("end", function() {
            self.emit("end");
          });
          zip.on("error", function(error) {
            self.emit("error", error);
          });
        });
      });
    }
  }
};


// Use this to send pass as HTTP response.
//
// response - HTTP response
// callback - Called when done sending/error occurred
//
// Adds appropriate headers and pipes pass to response.
Pass.prototype.render = function(response, callback) {
  response.setHeader("Content-Type", "application/vnd.apple.pkpass");
  if (callback) {
    this.on("error", callback);
    this.on("end", callback);
  }
  this.pipe(response);
};


function addImage(file, source, callback) {
  if (typeof(source) == "string" || source instanceof String) {
    if (/^https?:/i.test(source)) {
      // URL
      var protocol = /^https:/i.test(source) ? HTTPS : HTTP;
      protocol.get(source, function(response) {
        if (response.statusCode == 200) {
          file.on("close", callback);
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
    file.on("close", callback);
    file.write(source);
    file.end();
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
Pass.prototype.signZip = function(zip, manifest, callback) {
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
    var trimmedStderr = stderr.trim(); 
    // Windows outputs some unhelpful error messages, but still produces a valid signature
    if (error || (trimmedStderr && trimmedStderr.indexOf('- done') < 0)) {
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


module.exports = Pass;
