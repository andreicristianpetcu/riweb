/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var ripple = require('ripple-lib');
var Q = require('q');
var Wallet = require('./../wallet/wallet.model');
var Utils = require('./../../utils/utils');

var socket;

var ROOT_RIPPLE_ACCOUNT = Utils.ROOT_RIPPLE_ACCOUNT;

function fund_wallet(wallet, amount) {
  var deferred = Q.defer();
  amount = amount || 60;

  var ripple_address = wallet.address;

  if (ripple_address === ROOT_RIPPLE_ACCOUNT.address) {
    Utils.getEventEmitter().emit('set_root_flags');
    deferred.resolve(wallet);
  } else {
    Utils.getNewConnectedAdminRemote().then(function(remote){
      var options = { account: ROOT_RIPPLE_ACCOUNT.address,
                      destination: ripple_address,
                      amount : amount * 1000000
                    };
      // console.log('Remote connected');
      var transaction = remote.createTransaction('Payment', options);
      transaction.submit(function (err, res) {
          if (err) {
              // console.log('Failed to make initial XRP transfer because: ' +
              //               err);
              deferred.reject(err);
          } else {
              // console.log('Successfully funded wallet ' + ripple_address +
              //             ' with 60 XRP');
              deferred.resolve(wallet);
              Utils.getEventEmitter().emit('set_trust', {
                  rippleDestinationAddr: ROOT_RIPPLE_ACCOUNT.address,
                  rippleSourceAddr: wallet.address,
                  rippleSourceSecret: wallet.secret
              });
          }
        });
    });
  }

  return deferred.promise;
}

function save_wallet_to_db(wallet) {
  return Wallet.findByOwnerEmail(wallet.ownerEmail).then(function(foundWallet){
    if(!foundWallet){
      var deferred = Q.defer();
      Wallet.create(wallet, function (err, savedWallet) {
        if (!err) {
          socket.emit('post:create_wallet', null, savedWallet.address);
          deferred.resolve(savedWallet);
        } else {
          socket.emit('post:create_wallet', 'error', null);
          deferred.reject(err);
        }
      });
      return deferred.promise;
    } else {
      return Q(foundWallet);
    }
  });
}

function create_admin_wallet(){
    return Q(Utils.ROOT_RIPPLE_ACCOUNT);
}

function create_new_wallet(){
    return Q.fcall(ripple.Wallet.generate);
}

function get_create_wallet(owner_email){
    if (owner_email === 'admin@admin.com') {
        return create_admin_wallet;
    } else {
        return create_new_wallet;
    }
}

function create_wallet_for_email(owner_email) {
    var create_wallet = get_create_wallet(owner_email);

    var promise = create_wallet()
        .then(convert_ripple_to_riweb_wallet)
        .then(save_wallet_to_db)
        .then(fund_wallet);

    function convert_ripple_to_riweb_wallet(ripple_wallet) {
        return {
            ownerEmail: owner_email,
            address: ripple_wallet.address,
            secret: ripple_wallet.secret
        };
    }

    return promise;
}

exports.create_wallet_for_email = create_wallet_for_email;
exports.fund_wallet = fund_wallet;

exports.register = function(newSocket) {
  socket = newSocket;
  socket.on('create_wallet', function(data) {
      create_wallet_for_email(data.ownerEmail);
  });
};
