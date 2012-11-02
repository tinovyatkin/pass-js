var assert = require("assert");
var createTemplate = require("../");
var Crypto = require("crypto");
var execFile = require("child_process").execFile;
var File = require("fs");


describe("Pass", function() {
  before(function() {
    this.template = createTemplate("coupon", {
      passTypeIdentifier: "pass.com.example.passbook",
      teamIdentifier:     "MXL"
    });
    this.template.keys(__dirname + "/../keys", "secret");
    this.fields = {
      serialNumber:       "123456",
      organizationName:   "Acme flowers",
      description:        "20% of black roses"
    };
  });

  describe("from template", function() {
    before(function() {
      this.pass = this.template.createPass();
    });

    it("should copy template fields", function() {
      assert.equal(this.pass.fields.passTypeIdentifier, "pass.com.example.passbook");
    });

    it("should start with no images", function() {
      assert.deepEqual(this.pass.images, {});
    });

    it("should create a structure based on style", function() {
      assert(this.pass.fields.coupon);
      assert(!this.pass.fields.eventTicket);
    });
  });

  describe("without serial number", function() {
    it("should not be valid", function() {
      var pass = this.template.createPass(cloneExcept(this.fields, "serialNumber"));
      try {
        pass.validate();
        assert(false, "Pass validated without serialNumber");
      } catch(ex) { 
        assert.equal(ex.message, "Missing field serialNumber");
      }
    });
  });

  describe("without organization name", function() {
    it("should not be valid", function() {
      var pass = this.template.createPass(cloneExcept(this.fields, "organizationName"));
      try {
        pass.validate();
        assert(false, "Pass validated without organizationName");
      } catch(ex) { 
        assert.equal(ex.message, "Missing field organizationName");
      }
    });
  });

  describe("without description", function() {
    it("should not be valid", function() {
      var pass = this.template.createPass(cloneExcept(this.fields, "description"));
      try {
        pass.validate();
        assert(false, "Pass validated without description");
      } catch(ex) { 
        assert.equal(ex.message, "Missing field description");
      }
    });
  });
  
  describe("without icon.png", function() {
    it("should not be valid", function() {
      var pass = this.template.createPass(this.fields);
      try {
        pass.validate();
        assert(false, "Pass validated without icon.png");
      } catch(ex) { 
        assert.equal(ex.message, "Missing image icon.png");
      }
    });
  });

  describe("without logo.png", function() {
    var validationError;

    before(function(done) {
      var pass = this.template.createPass(this.fields);
      pass.icon("icon.png");
      var file = File.createWriteStream("/tmp/pass.pkpass");
      pass.pipe(file);
      pass.on("done", done);
      pass.on("error", function(error) {
        validationError = error;
        done();
      });
    });

    it("should not be valid", function() {
      assert(validationError, "Pass validated without logo.png");
      assert.equal(validationError.message, "Missing image logo.png");
    });
  });


  describe("generated", function() {
    before(function() {
      this.pass = this.template.createPass(this.fields);
      this.pass.loadImagesFrom(__dirname + "/resources");
      this.pass.headerFields.add("date", "Date", "Nov 1");
      this.pass.primaryFields.add([
        { key: "location", label: "Place", value: "High ground" }
      ]);

    });

    before(function(done) {
      if (File.existsSync("/tmp/pass.pkpass"))
        File.unlinkSync("/tmp/pass.pkpass");
      var file = File.createWriteStream("/tmp/pass.pkpass");
      this.pass.pipe(file);
      this.pass.on("end", done);
    });

    it("should be a valid ZIP", function(done) {
      execFile("unzip", ["-t", "/tmp/pass.pkpass"], function(error, stdout) {
        if (error)
          error = new Error(stdout);
        done(error);
      });
    });

    it("should contain pass.json", function(done) {
      unzip("/tmp/pass.pkpass", "pass.json", function(error, buffer) {
        assert.deepEqual(JSON.parse(buffer), {
          passTypeIdentifier: 'pass.com.example.passbook',
          teamIdentifier:     'MXL',
          serialNumber:       '123456',
          organizationName:   'Acme flowers',
          description:        '20% of black roses',
          coupon:             {
            headerFields:       [
              { key:    "date",
                label:  "Date",
                value:  "Nov 1"
              }
            ],
            primaryFields:      [
              { key:    "location",
                label:  "Place",
                value:  "High ground"
              }
            ]
          },
          formatVersion:      1
        });
        done();
      });
    });

    it("should contain a manifest", function(done) {
      unzip("/tmp/pass.pkpass", "manifest.json", function(error, buffer) {
        assert.deepEqual(JSON.parse(buffer), {
          "pass.json":        "87c2bd96d4bcaf55f0d4d7846a5ae1fea85ea628",
          "icon.png":         "e0f0bcd503f6117bce6a1a3ff8a68e36d26ae47f",
          "icon@2x.png":      "10e4a72dbb02cc526cef967420553b459ccf2b9e",
          "logo.png":         "abc97e3b2bc3b0e412ca4a853ba5fd90fe063551",
          "logo@2x.png":      "87ca39ddc347646b5625062a349de4d3f06714ac",
          "strip.png":        "68fc532d6c76e7c6c0dbb9b45165e62fbb8e9e32",
          "strip@2x.png":     "17e4f5598362d21f92aa75bc66e2011a2310f48e",
          "thumbnail.png":    "e199fc0e2839ad5698b206d5f4b7d8cb2418927c",
          "thumbnail@2x.png": "ac640c623741c0081fb1592d6353ebb03122244f"
        });
        done();
      });
    });

    it("should contain a signature", function(done) {
      execFile("signpass", ["-v", "/tmp/pass.pkpass"], function(error, stdout) {
        assert(/\*\*\* SUCCEEDED \*\*\*/.test(stdout), stdout);
        done();
      });
    });

    it("should contain the icon", function(done) {
      unzip("/tmp/pass.pkpass", "icon.png", function(error, buffer) {
        assert.equal(Crypto.createHash("sha1").update(buffer).digest("hex"),
                     "e0f0bcd503f6117bce6a1a3ff8a68e36d26ae47f");
        done();
      });
    });

    it("should contain the logo", function(done) {
      unzip("/tmp/pass.pkpass", "logo.png", function(error, buffer) {
        assert.equal(Crypto.createHash("sha1").update(buffer).digest("hex"),
                     "abc97e3b2bc3b0e412ca4a853ba5fd90fe063551");
        done();
      });
    });

  });

});


// Clone all the fields in object, except the named field, and return a new
// object.
//
// object - Object to clone
// field  - Except this field
function cloneExcept(object, field) {
  var clone = {};
  for (var key in object) {
    if (key !== field)
      clone[key] = object[key];
  }
  return clone;
}


function unzip(zipFile, filename, callback) {
  execFile("unzip", ["-p", zipFile, filename], { encoding: "binary" }, function(error, stdout) {
    if (error) {
      callback(new Error(stdout));
    } else {
      callback(null, new Buffer(stdout, "binary"));
    }
  });
}


