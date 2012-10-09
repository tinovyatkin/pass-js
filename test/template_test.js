var assert = require("assert");
var createTemplate = require("../lib/passbook");

describe("Template", function() {

  describe("unsupported style", function() {
    it("should throw an error", function() {
      try {
        createTemplate("discount");
        assert(false, "Created template with unsupported style 'discount'");
      } catch(error) {}
    });
  });

  describe("fields", function() {
    before(function() {
      this.fields = { passTypeIdentifier: "com.example.passbook" };
      this.template = createTemplate("coupon", this.fields);
    });
    it("should come from constructor", function() {
      assert.equal(this.template.passTypeIdentifier(), "com.example.passbook");
    });
    it("should not change when original object changes", function() {
      this.fields.passTypeIdentifier = "com.example.somethingelse";
      assert.equal(this.template.passTypeIdentifier(), "com.example.passbook");
    });
  });
  
});
