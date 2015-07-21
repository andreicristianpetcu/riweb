/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var ripple = require('ripple-lib');
var Utils = require('./../../utils/utils');
var Q = require('q');
var Wallet = require('./../wallet/wallet.model');
var create_wallet = require('./../create_wallet/create_wallet.socket');

function remote_request_account_lines(ripple_address, remote){
  var deferred = Q.defer();
  var options = {
    account: ripple_address,
    ledger: 'validated'
  };
  remote.requestAccountLines(options, function(err, info) {
    if(!err){
      deferred.resolve(info);
    } else {
      deferred.reject(err);
    }
  });
  return deferred.promise;
}


function get_ripple_account_info(ripple_address) {
  var deferred = Q.defer();

  Utils.getNewConnectedRemote()
    .then(function(remote){
      remote_request_account_lines(ripple_address, remote).then(function(info){
        deferred.resolve(info);
      });
    }).catch(function(err){
      console.error(err);
      deferred.reject(err);
    });
  return deferred.promise;
}

function get_account_info(owner_email, socket) {
  return Wallet.findByOwnerEmail(owner_email).then(function(foundWallet) {
      var deferred = Q.defer();

     if (foundWallet && foundWallet.address) { // There should be only one
        get_ripple_account_info(foundWallet.address).then(function(ripple_account_info) {
          var account_lines = {
            balance: ripple_account_info.lines.length > 0 ? ripple_account_info.lines[0].balance : 0
          };

          socket.emit('post:account_info', account_lines);
          deferred.resolve(account_lines);
        }).catch(function(err){
          console.error(err);
          deferred.reject(err);
        });
      } else {
        socket.emit('post:account_info', {info: 'User does not exist!'});
        deferred.resolve({info: 'User does not exist!'});
      }
      return deferred.promise;
  });
}


exports.get_account_info = get_account_info;

exports.register = function(socket) {
  socket.on('account_info', function(owner_email) {
    console.log('account_info ' + owner_email);
    get_account_info(owner_email, socket);
  });
};
