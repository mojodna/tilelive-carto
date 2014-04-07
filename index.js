"use strict";

var fs = require("fs"),
    path = require("path"),
    url = require("url");

var async = require("async"),
    carto = require("carto"),
    tileliveMapnik = require("tilelive-mapnik");

var PREFIX = "carto+";

module.exports = function(tilelive, options) {
  tileliveMapnik.registerProtocols(tilelive);

  var Carto = function(uri, callback) {
    uri = url.parse(uri, true);

    uri.protocol = uri.protocol.replace(PREFIX, "");

    var filename = path.join(uri.hostname, uri.pathname);

    return fs.readFile(filename, function(err, mml) {
      if (err) {
        return callback(err);
      }

      try {
        mml = JSON.parse(mml);
      } catch (e) {
        return callback(e);
      }

      return async.map(mml.Stylesheet, function(mss, done) {
        return fs.readFile(path.join(path.dirname(filename), mss), "utf8", function(err, style) {
          if (err) {
            return done(err);
          }

          return done(null, {
            id: mss,
            data: style
          });
        });
      }, function(err, styles) {
        if (err) {
          return callback(err);
        }

        mml.Stylesheet = styles;

        new carto.Renderer().render(mml, function(err, xml) {
          if (err) {
            if (Array.isArray(err)) {
              err.forEach(function(e) {
                // TODO what's this?
                carto.writeError(e, options);
              });
            } else {
              return callback(err);
            }
          } else {
            var sourceURI = {
              protocol: "mapnik:",
              xml: xml
            };

            return tilelive.load(sourceURI, callback);
          }
        });
      });
    });
  };

  Carto.registerProtocols = function(tilelive) {
    tilelive.protocols[PREFIX + "file:"] = this;
  };

  Carto.registerProtocols(tilelive);

  return Carto;
};
