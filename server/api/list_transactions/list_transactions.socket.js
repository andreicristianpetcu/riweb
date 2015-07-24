/**
 * Broadcast updates to client when the model changes
 */

'use strict';

var ripple = require('ripple-lib');
var Q = require('q');

var Utils = require('./../../utils/utils');
var Wallet = require('./../wallet/wallet.model');

function findEmailFromAddress(rippleAddress){
	return Wallet.findByRippleAddress(rippleAddress).then(function(foundWallet){
		if(!foundWallet){
			return '<<< deleted account >>>';
		} else {
			return foundWallet.ownerEmail;
		}
	})
}

function convertRippleTxToHuman(transaction){
	
  var sourceEmailPromise = findEmailFromAddress(transaction.tx.Account);
  var destinationEmailPromise = findEmailFromAddress(transaction.tx.Destination);
  return Q.all([sourceEmailPromise, destinationEmailPromise]).spread(function(sourceEmail, destinationEmail){
		var transactionHuman = {
					source: sourceEmail,
					destination: destinationEmail,
					amount: transaction.tx.Amount.value + '€',
					fee: transaction.tx.Fee};
					
		return transactionHuman;
  });
}

function listTransactions(ownerEmail, socket) {
		var deferred = Q.defer();

	function buildMissingError() {
		var result = {
			ownerEmail: ownerEmail,
			status: 'error',
			message: 'missing account'
		}

		socket.emit('post:list_transactions', result);
		deferred.resolve(result);
	}

	var wallet;
	Wallet.findByOwnerEmail(ownerEmail).then(function (wallets) {
		if (wallets.constructor == Array) {
			if (wallets.length != 1) {
				buildMissingError();

				return deferred.promise;
			} else {
				wallet = wallets[0];
			}
		} else {
			if (!wallets) {
				buildMissingError();

				return deferred.promise;
			} else {
				wallet = wallets;
			}
		}

		Utils.getNewConnectedRemote(wallet.address, wallet.secret).then(function (remote) {
			remote.requestAccountTransactions({
				account: wallet.address,
				ledger_index_min: -1,
				ledger_index_max: -1,
				binary: false
			}, function (err, res) {
				var result;
				if (err) {
					result = { status: 'error', message: err.message };
					socket.emit('post:list_transactions', result);
					deferred.resolve(result);
				} else {
     				var transactionPromises = [];

					res.transactions.forEach(function(rippleTx){
						transactionPromises.push(convertRippleTxToHuman(rippleTx));
					});
					Q.all(transactionPromises).then(function(transactionsHuman){
							result = { status: 'success', transactions: transactionsHuman };
							socket.emit('post:list_transactions', transactionsHuman);
							deferred.resolve(result);
					});
					
				}
			});
		});
	});

	return deferred.promise;
}

function translateTransactionsToHuman(ownerEmail, ownerRippleAddress, transactionsList) {
	var deferred = Q.defer();

	var transactionsListHuman = [];
	var walletsPromises = [];
	var result = [];

	transactionsList.forEach(function (transaction) {

		var transactionHuman = {
			source: transaction.tx.Account,
			destination: transaction.tx.Destination,
			fee: transaction.tx.Fee,
			txType: transaction.tx.TransactionType,
			date: transaction.tx.date,
			amount: transaction.tx.Amount // Amount is a number for XRP or an object { currency, issuer, value } for EUR
		}

		if (transactionHuman.txType == 'Payment') {
			if (typeof transactionHuman.amount === 'object') {
				transactionHuman.amount = transactionHuman.amount.value; // Extract only EUR value	
				transactionsListHuman[transactionHuman.destination] = transactionHuman;
				
				// Wait for the owner email from the DB
				var addressToResolve = ownerRippleAddress === transactionHuman.destination ? transactionHuman.source : transactionHuman.destination;
				walletsPromises.push(Wallet.findByRippleAddress(addressToResolve));
			}
		}

	});

	Q.allSettled(walletsPromises)
		.then(function (walletPromisesResults) {
			walletPromisesResults.forEach(function (walletPromiseResult, idx) {
				if (walletPromiseResult.state === 'fulfilled') {
					var transactionHuman = transactionsListHuman[walletsPromises[idx].rippleAddress];
					
					// If the user no longer exists in the DB the promise value will resolve to null
					var wallet = walletPromiseResult.value;
					
					var resultTx = {
						source: 		transactionHuman.source === ownerRippleAddress ? 
											ownerEmail : (wallet ? wallet.ownerEmail : '<<< deleted account >>>'),
						destination:  	transactionHuman.destination === ownerRippleAddress ? 
											ownerEmail : (wallet ? wallet.ownerEmail : '<<< deleted account >>>') ,
						amount: 		transactionHuman.amount + '€',
						fee: 			transactionHuman.fee
					};
					
					result.push(resultTx);
				}
			});

			deferred.resolve(result);
		});

	return deferred.promise;
}

function listTransactions_old(ownerEmail, socket) {
	var deferred = Q.defer();

	function buildMissingError() {
		var result = {
			ownerEmail: ownerEmail,
			status: 'error',
			message: 'missing account'
		}

		socket.emit('post:list_transactions', result);
		deferred.resolve(result);
	}

	var wallet;
	Wallet.findByOwnerEmail(ownerEmail).then(function (wallets) {
		if (wallets.constructor == Array) {
			if (wallets.length != 1) {
				buildMissingError();

				return deferred.promise;
			} else {
				wallet = wallets[0];
			}
		} else {
			if (!wallets) {
				buildMissingError();

				return deferred.promise;
			} else {
				wallet = wallets;
			}
		}

		Utils.getNewConnectedRemote(wallet.address, wallet.secret).then(function (remote) {
			remote.requestAccountTransactions({
				account: wallet.address,
				ledger_index_min: -1,
				ledger_index_max: -1,
				binary: false
			}, function (err, res) {
				var result;
				if (err) {
					result = { status: 'error', message: err.message };
					socket.emit('post:list_transactions', result);
					deferred.resolve(result);
				} else {
					translateTransactionsToHuman(wallet.ownerEmail, wallet.address, res.transactions)
						.then(function (transactionsHuman) {
							result = { status: 'success', transactions: transactionsHuman };
							socket.emit('post:list_transactions', result);
							deferred.resolve(result);
						});
				}
			});
		});
	});

	return deferred.promise;
}

exports.listTransactions = listTransactions;
exports.register = function (socket) {
	socket.on('list_transactions', function (ownerEmail) {
		listTransactions(ownerEmail, socket);
	});
}
