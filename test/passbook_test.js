var assert = require("assert");
var createTemplate = require("../");
var Crypto = require("crypto");
var execFile = require("child_process").execFile;
var File = require("fs");


describe("Passbook", function() {
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
      this.passbook = this.template.createPassbook();
    });

    it("should copy template fields", function() {
      assert.equal(this.passbook.fields.passTypeIdentifier, "pass.com.example.passbook");
    });

    it("should start with no images", function() {
      assert.deepEqual(this.passbook.images, {});
    });

    it("should create a structure based on style", function() {
      assert(this.passbook.fields.coupon);
      assert(!this.passbook.fields.eventTicket);
    });
  });

  describe("without serial number", function() {
    it("should not be valid", function() {
      var passbook = this.template.createPassbook(cloneExcept(this.fields, "serialNumber"));
      try {
        passbook.validate();
        assert(false, "Passbook validated without serialNumber");
      } catch(ex) { 
        assert.equal(ex.message, "Missing field serialNumber");
      }
    });
  });

  describe("without organization name", function() {
    it("should not be valid", function() {
      var passbook = this.template.createPassbook(cloneExcept(this.fields, "organizationName"));
      try {
        passbook.validate();
        assert(false, "Passbook validated without organizationName");
      } catch(ex) { 
        assert.equal(ex.message, "Missing field organizationName");
      }
    });
  });

  describe("without description", function() {
    it("should not be valid", function() {
      var passbook = this.template.createPassbook(cloneExcept(this.fields, "description"));
      try {
        passbook.validate();
        assert(false, "Passbook validated without description");
      } catch(ex) { 
        assert.equal(ex.message, "Missing field description");
      }
    });
  });
  
  describe("without icon.png", function() {
    it("should not be valid", function() {
      var passbook = this.template.createPassbook(this.fields);
      try {
        passbook.validate();
        assert(false, "Passbook validated without icon.png");
      } catch(ex) { 
        assert.equal(ex.message, "Missing image icon.png");
      }
    });
  });

  describe("without logo.png", function() {
    it("should not be valid", function() {
      var passbook = this.template.createPassbook(this.fields);
      passbook.icon("icon.png");
      try {
        passbook.validate();
        assert(false, "Passbook validated without logo.png");
      } catch(ex) { 
        assert.equal(ex.message, "Missing image logo.png");
      }
    });
  });


  describe("generated", function() {
    before(function(done) {
      var passbook = this.template.createPassbook(this.fields);
      passbook.loadImagesFrom(__dirname + "/resources");
      if (File.existsSync("/tmp/passbook.pkpass"))
        File.unlinkSync("/tmp/passbook.pkpass");
      var file = File.createWriteStream("/tmp/passbook.pkpass");
      passbook.writeToOutputStream(file, done);
    });

    it("should be a valid ZIP", function(done) {
      execFile("unzip", ["-t", "/tmp/passbook.pkpass"], function(error, stdout) {
        if (error)
          error = new Error(stdout);
        done(error);
      });
    });

    it("should contain pass.json", function(done) {
      unzip("/tmp/passbook.pkpass", "pass.json", function(error, buffer) {
        assert.deepEqual(JSON.parse(buffer), {
          passTypeIdentifier: 'pass.com.example.passbook',
          teamIdentifier:     'MXL',
          serialNumber:       '123456',
          organizationName:   'Acme flowers',
          description:        '20% of black roses',
          coupon:             {},
          formatVersion:      1
        });
        done();
      });
    });

    it("should contain a manifest", function(done) {
      unzip("/tmp/passbook.pkpass", "manifest.json", function(error, buffer) {
        assert.deepEqual(JSON.parse(buffer), {
          "pass.json":        "bcb463e9d94298e2d9757cea4a1af501fe5b45ae",
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
      execFile("signpass", ["-v", "/tmp/passbook.pkpass"], function(error, stdout) {
        assert(/\*\*\* SUCCEEDED \*\*\*/.test(stdout), stdout);
        done();
      });
    });

    it("should contain the icon", function(done) {
      unzip("/tmp/passbook.pkpass", "icon.png", function(error, buffer) {
        assert.equal(Crypto.createHash("sha1").update(buffer).digest("hex"),
                     "e0f0bcd503f6117bce6a1a3ff8a68e36d26ae47f");
        done();
      });
    });

    it("should contain the logo", function(done) {
      unzip("/tmp/passbook.pkpass", "logo.png", function(error, buffer) {
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


