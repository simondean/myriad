var FS = require('fs');
var WinSpawn = require('win-spawn');
var Debug = require('debug')('myriad')

var NPM = module.exports;

NPM.pack = function(options, callback) {
  Debug("Packing");

  // See https://github.com/joyent/node/issues/2318 for the reason that
  // win-spawn has to be used instead of child_process
  var child = WinSpawn('npm', ['pack', options.package], {
    stdio: ['ignore', 'pipe', process.stderr],
    env: process.env
  });

  var finished = false;
  var output = '';

  child.on('error', function(err) {
    if (finished) return;
    finished = true;

    callback({ message: "Failed to pack the package", error: err });
  });

  child.stdout.on('data', function(data) {
    output += data;
  });

  child.on('exit', function(code) {
    if (finished) return;
    finished = true;

    if (code === null || code !== 0) {
      callback({ message: "Failed to pack the package", exitCode: code });
    }
    else {
      lines = output.replace(/[\r\n]+$/g, '').split(/[\r\n]+/g);

      if (lines.length !== 1) {
        callback({ message: "Expected 1 line of npm pack stdout output.  Actually got " + lines.length + " lines" });
      }
      else {
        var packageTarball = lines[0];

        FS.readFile(packageTarball, function(err, data) {
          if (err) {
            callback({ message: "Failed to read the tarball produced by npn pack", error: err });
          }
          else {
            FS.unlink(packageTarball, function(err) {
              if (err) {
                callback({ message: "Failed to delete the tarball produced by npn pack", error: err });
              }
              else {
                callback(null, data);
              }
            })
          }
        });
      }
    }
  });
}
