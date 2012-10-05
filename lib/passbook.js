// openssl x509 -in cert.cer -inform DER -outform PEM -out cert.pem
// openssl pkcs12 -in key.p12 -out key.pem -nodes

var Crypto  = require("crypto");
var Path    = require("path");
var spawn   = require("child_process").spawn;
var Zip     = require("node-native-zip");


IGNORE = ["manifest.json", "signature", ".DS_Store"];


function Template(style, dict) {
  this.style = style;
  this.dict = dict || {};
  this.dict.formatVersion = 1;
}


Template.prototype.createPassbook = function(dict) {
  return new Passbook(this, dict);
}


var TEMPLATE = ["passTypeIdentifier", "teamIdentifier"];
TEMPLATE.forEach(function(key) {
  Template.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.dict[key];
    } else {
      this.dict[key] = value;
      return this;
    }
  }
});


function Passbook(template, dict) {
  this.template = template;
  this.dict = dict || {};
  this.structure = this.dict[template.style];
  if (!this.structure)
    this.structure = this.dict[template.style] = {};
}


Passbook.prototype.fields = function() {
  var fields = {};
  for (var key in this.template.dict)
    fields[key] = this.template.dict[key];
  for (var key in this.dict)
    fields[key] = this.dict[key];
  return fields;
}

var TOP_LEVEL = ["description", "organizationName", "serialNumber", "locations", "relevantDate",
             "barcode", "backgroundColor", "foregroundColor", "labelColor", "logoText",
             "suppressStripShine", "authenticationToken", "webServiceURL"];

TOP_LEVEL.forEach(function(key) {
  Passbook.prototype[key] = function(value) {
    if (arguments.length == 0) {
      return this.dict[key];
    } else {
      this.dict[key] = value;
      return this;
    }
  }
});


var STRUCTURE = ["headerFields", "primaryFields", "secondaryFields", "auxiliaryFields", "backFields", "transitType"];

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


Passbook.prototype.create = function(files, password, callback) {
  var zip = new Zip();
  var json = JSON.stringify(this.fields());
  zip.add("pass.json", new Buffer(json, "utf-8"));
  files["pass.json"] = json;
  var manifest = this.createManifest(files);
  zip.add("manifest.json", new Buffer(manifest, "utf-8"));
  this.signManifest(manifest, password, function(error, signature) {
    if (error) {
      callback(error);
    } else {
      zip.add("signature", signature);
      try {
        for (var filename in files) {
          var contents = files[filename];
          zip.add(Path.basename(filename), contents);
        }
        callback(null, zip.toBuffer());
      } catch(error) {
        callback(error);
      }
    }
  });
}

// Creates a manifest from map of files. Returns as a string.
Passbook.prototype.createManifest = function(files) {
  var manifest = {};
  for (var filename in files) {
    var file = files[filename];
    var sha = Crypto.createHash("sha1").update(file).digest("hex");
    manifest[Path.basename(filename)] = sha;
  }
  return JSON.stringify(manifest);
}

// Signs a manifest and returns the signature.
Passbook.prototype.signManifest = function(manifest, password, callback) {
  var identifier = this.template.passTypeIdentifier().replace(/pass./, "");
  var args = [
    __dirname + "/sign.rb",
    __dirname + "/../certs/" + identifier + ".p12",
    password,
    __dirname + "/../certs/wwdr.pem"
  ];
  var sign = spawn("ruby", args);
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
      callback(null, new Buffer(output, "binary"));
    } else {
      callback(new Error(error));
    }
  });
  sign.stdin.write(manifest);
  sign.stdin.end();
}


function createTemplate(style, dict) {
  return new Template(style, dict);
}

module.exports = createTemplate;
