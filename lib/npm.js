var ChildProcess = require('child_process');
var FS = require('fs');
var Debug = require('debug')('myriad')

var NPM = module.exports;

NPM.pack = function(options, callback) {
  var child = ChildProcess.spawn('npm', ['pack', options.package], {
    stdio: ['ignore', 'pipe', process.stderr]
  });

  var output = '';

  child.stdout.on('data', function(data) {
    output += data;
  });

  child.on('exit', function(code) {
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
