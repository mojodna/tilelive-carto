"use strict";

var fs = require("fs"),
    path = require("path"),
    url = require("url");

var async = require("async"),
    carto = require("carto");

var PREFIX = "carto+";

module.exports = function(tilelive, options) {
  var Carto = function(uri, callback) {
    uri = url.parse(uri, true);

    uri.protocol = uri.protocol.replace(PREFIX, "");
    this.uri = null;

    var version = 0;

    // watch the directory containing the style and recompile if anything
    // changes
    if (uri.query.cache === false || uri.query.cache === "false") {
      fs.watch(path.resolve(path.dirname(path.join(uri.hostname, uri.pathname))), {
        persistent: false
      }, function(event, filename) {
        return Carto.compile(uri, function(err, sourceURI) {
          if (err) {
            console.warn(err.stack);
            return;
          }

          this.uri = sourceURI;
          this.uri.query.version = ++version;
        }.bind(this));
      }.bind(this));
    }

    return Carto.compile(uri, function(err, sourceURI) {
      if (err) {
        return callback(err);
      }

      this.uri = sourceURI;
      this.uri.query.version = version;

      return callback(null, this);
    }.bind(this));
  };

  Carto.compile = function(uri, callback) {
    callback = callback || function() {};

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
        if (typeof(mss) === "object") {
          // stylesheet was inlined, by millstone or otherwise
          return done(null, mss);
        }

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

        var xml;

        try {
          xml = new carto.Renderer().render(mml);
        } catch (err) {
          if (Array.isArray(err)) {
            err.forEach(function(e) {
              // TODO what's this?
              carto.writeError(e, options);
            });
          } else {
            return callback(err);
          }
        }

        var sourceURI = {
          protocol: "mapnik:",
          xml: xml,
          query: uri.query
        };

        return callback(null, sourceURI);
      });
    });
  };

  Carto.prototype.getInfo = function(callback) {
    return tilelive.load(this.uri, function(err, source) {
      if (err) {
        return callback(err);
      }

      return source.getInfo(callback);
    });
  };

  Carto.prototype.getTile = function(z, x, y, callback) {
    return tilelive.load(this.uri, function(err, source) {
      if (err) {
        return callback(err);
      }

      return source.getTile(z, x, y, callback);
    });
  };

  Carto.prototype.close = function(callback) {
    callback = callback || function() {};

    return setImmediate(callback);
  };

  Carto.registerProtocols = function(tilelive) {
    tilelive.protocols[PREFIX + "file:"] = this;
  };

  Carto.registerProtocols(tilelive);

  return Carto;
};
