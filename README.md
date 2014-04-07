# tilelive-carto

I am a [Carto](https://github.com/mapbox/carto) style source for
[tilelive](https://github.com/mapbox/tilelive.js).

## Usage

```javascript
var tilelive = require("tilelive");

require("tilelive-carto")(tilelive);

tilelive.load("carto+file://./project.mml", function(err, src) {
  // ...
});
```
