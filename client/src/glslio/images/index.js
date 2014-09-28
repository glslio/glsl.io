var Qimage = require("qimage");
var Q = require("q");

var images = {};

module.exports = {
  formats: "512x400 600x400 1024x768".split(" "),
  formatsByUsage: {
    "editor": 0,
    "gallery": 1,
    "gallery-big": 2,
    "home": 2,
    "embed": 2
  },
  names: [
    "barley.jpg",
    "pHyYeNZMRFOIRpYeW7X3_manacloseup.jpg",
    "ic1dX3kBQjGNaPQb8Xel_1920x1280.jpg",
    "wdXqHcTwSTmLuKOGz92L_Landscape.jpg",
    "hBd6EPoQT2C8VQYv65ys_White_Sands.jpg",
    "ikZyw45kT4m16vHkHe7u_9647713235_29ce0305d2_o.jpg",
    "bigbuckbunny_snapshot1.jpg",
    "lUUnN7VGSoWZ3noefeH7_Baker_Beach-12.jpg",
    "a1mV1egnQwOqxZZZvhVo_street.jpg"
  ],
  resolveFormat: function (formatId) {
    var format = (formatId in this.formatsByUsage) ? this.formats[this.formatsByUsage[formatId]] : formatId;
    if (!format) throw new Error("format not found. "+formatId);
    return format;
  },
  resolveName: function (imgId) {
    var name = typeof imgId === "number" ? this.names[imgId] : imgId;
    if (!name) throw new Error("image name not found. "+imgId);
    return name;
  },
  getImage: function (imgId, formatId) {
    var url = "/assets/images/"+this.resolveFormat(formatId)+"/"+this.resolveName(imgId);
    if (!(url in images)) {
      images[url] = Qimage(url);
    }
    return images[url];
  },
  allImagesForFormat: function (formatId) {
    var self = this;
    return Q.all(this.names.map(function (name) {
      return self.getImage(name, formatId);
    }));
  }
};
