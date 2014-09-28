var _ = require("lodash");
var primitiveTypes = ["float", "int", "bool", "sampler2D"];
module.exports = function primitiveForType (t) {
  if (_.contains(primitiveTypes, t)) return t;
  if (t[0] === "b") return "bool";
  if (t[0] === "i") return "int";
  return "float";
};
