var SocketIOClient = require('socket.io-client');
var Async = require('async');
var Events = require('events');
var Util = require('util');
var Path = require('path');
var Debug = require('debug')('myriad')
var NPM = require('./npm');

var Connection = function(options, callback) {
  if (!(this instanceof Connection)) return new Connection(options, callback);

  var self = this;

  Events.EventEmitter.call(self);

  if (options) {
    self.connect(options, callback);
  }
}

Util.inherits(Connection, Events.EventEmitter);

Connection.prototype.connect = function(options, callback) {
  var self = this;

  self._socket = SocketIOClient.connect(options.url, { 'force new connection': true });

  if (callback) {
    self.on('connect', callback);
  }

  self._socket.on('connect', function() {
    Debug("Received event connect");
    self.emit('connect', {});
  });

  ['childStdout', 'childStderr', 'childError', 'childExit', 'childClose', 'childDisconnect', 'childMessage'].forEach(function(event) {
    self._socket.on(event, function(data) {
      Debug("Received event " + event);
      self.emit(event, data);
    });
  });
}

Connection.prototype.spawn = function(options, callback) {
  var self = this;

  if (options.localPackage !== true && options.localPackage !== false) {
    Debug("Defaulting localPackage to true");
    options.localPackage = true;
  }

  Async.waterfall(
    [
      function(callback) {
        if (options.localPackage) {
          var package = Path.resolve(options.package);
          Debug('Using local package ' + package);
          callback(null, package);
        }
        else if (options.package instanceof Buffer) {
          Debug('Package has already been packed');
          callback(null, options.package);
        }
        else {
          NPM.pack({ package: options.package }, function(err, package) {
            if (err) {
              callback({ message: "Failed to pack the package", error: err });
            }
            else {
              Debug('Packed package ' + options.package);
              callback(null, package.toString('base64'));
            }
          });
        }
      }
    ],
    function(err, package) {
      if (err) {
        // No event listeners registered yet so wait for next tick
        process.nextTick(function() {
          self.emit('error', err);
        });
      }
      else {
        if (callback) {
          self._socket.on('spawn', callback);
        }

        var data = {
          package: package,
          localPackage: options.localPackage,
          bin: options.bin,
          args: options.args
        }

        self.send({ event: 'spawn', data: data });
      }
    }
  );
};

Connection.prototype.send = function(options) {
  var self = this;

  Debug("Sending event " + options.event);
  self._socket.emit(options.event, options.data);
};

Connection.prototype.disconnect = function() {
  var self = this;

  Debug("Disconnecting");
  self._socket.disconnect();
}

module.exports = Connection;