var FS = require('fs');
var Debug = require('debug')('myriad')

var Connection = require('./connection');
var NPM = require('./npm');

var Myriad = function(options, callback) {
  return new Connection(options, callback);
};

Myriad.Connection = Connection;
Myriad.NPM = NPM;

module.exports = Myriad;
