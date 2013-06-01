var WebSocketDriver = require('websocket-driver');
var Net = require('net');
var URL = require('url');
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

  if (callback) {
    Debug("Has callback");
    self.on('connect', callback);
  }

  Debug("Connecting to " + options.url);
  self._driver = WebSocketDriver.client(options.url);
  var url = URL.parse(options.url);
  Debug("Starting TCP connection to " + url.hostname + ":" + url.port);
  var tcp = Net.createConnection({ host: url.hostname, port: url.port });
  Debug("Started connecting");

  tcp.on('error', function(error) {
    Debug("Received error event from tcp socket");
    Debug(error);
    self.emit('error', error);
  });

  tcp.pipe(self._driver.io);
  self._driver.io.pipe(tcp);

  tcp.on('connect', function() {
    Debug("Starting driver");
    self._driver.start();
  });

  self._driver.on('open', function(event) {
    Debug("Received open event");
    self.emit('connect', {});
  });

  self._driver.on('error', function(event) {
    Debug("Received error event");
    Debug(event);
    self.emit('error', { message: event.message });
  });

  self._driver.on('close', function(event) {
    Debug("Received close event");
    tcp.end();
    self.emit('close', {});
  });

  self._driver.on('message', function(event) {
    Debug("Received message event");
    event = JSON.parse(event.data);
    Debug("Received " + event.event + " message");
    self.emit('message', event);
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
          self._driver.on('spawn', callback);
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
  self._driver.text(JSON.stringify({ event: options.event, data: options.data }));
};

Connection.prototype.disconnect = function() {
  var self = this;

  Debug("Disconnecting");
  self._driver.close();
}

module.exports = Connection;