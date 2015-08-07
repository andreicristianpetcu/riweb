/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var ripple = require('ripple-lib');
var Q = require('q');
var Utils = require('./../../utils/utils');
var debug = require('debug')('SetRootFlags');

function setRootFlags(account) {
    var deferred = Q.defer();
	
    account = account || Utils.ROOT_RIPPLE_ACCOUNT.address;
    
	Utils.getNewConnectedRemote(account.address, account.secret).then(function(remote) {
        var transaction = remote.createTransaction('AccountSet', {
            account: account,
            set: 'DefaultRipple'
        });

        transaction.submit(function(err){
            if (err) {
                debug(err);
             	deferred.reject(err);
            } else {
     	        deferred.resolve({status: 'success'});
            }
        });
    });

	return deferred.promise;
}

exports.setRootFlags = setRootFlags;
exports.register = function() {
	Utils.getEventEmitter().on('set_root_flags', function(data) {
		setRootFlags(data.account);
	})  
}

