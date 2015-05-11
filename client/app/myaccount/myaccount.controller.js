'use strict';

angular.module('riwebApp')
    .factory('Remote', [function ($scope, Auth) {
        var Remote = new ripple.Remote({
            // see the API Reference for available options
            servers: [ 'ws://localhost:6006' ]
        });

        Remote.loadCurrentUserBalance = function(){
            Wallet.getByOwnerEmail({ownerEmail: Auth.getCurrentUser().email}).$promise.then(function (data) {
                if (data.length === 1) {
                    $scope.wallet = data[0];
                    Remote.requestAccountInfo({account: $scope.wallet.publicKey}, function (err, info) {
                        /*jshint camelcase: false */
                        $scope.xrpBallance = info.account_data.Balance;
                        $scope.$apply();
                    });
                }
            });
        };

        Remote.init = function(){
            Remote.connect(function () {
                console.log('Remote connected');

                var streams = [
                    'ledger',
                    'transactions'
                ];

                var request = Remote.requestSubscribe(streams);

                request.on('error', function (error) {
                    console.log('request error: ', error);
                });


                // the `ledger_closed` and `transaction` will come in on the remote
                // since the request for subscribe is finalized after the success return
                // the streaming events will still come in, but not on the initial request
                Remote.on('ledger_closed', function (ledger) {
                    /*jshint camelcase: false */
                    $scope.ledgerClosed = ledger.ledger_hash;
                    $scope.$apply();
                });

                Remote.on('error', function (error) {
                    $scope.error = error;
                    $scope.$apply();
                });

                // fire the request
                request.request();

                /* Remote connected */
                Remote.requestServerInfo(function (err, info) {
                    /*jshint camelcase: false */
                    var pubkeyNode = info.info.pubkey_node;
                    if (pubkeyNode) {
                        $scope.message = 'Connected to server ' + pubkeyNode;
                        $scope.server_name = pubkeyNode;
                        $scope.server_error = '';
                    } else {
                        $scope.server_name = '';
                        $scope.server_error = 'Error ' + err;
                    }
                    $scope.$apply();

                });

                Remote.loadCurrentUserBalance();

            });
        }

        return Remote;
    }])
    .controller('MyaccountCtrl', function ($scope, Auth, User, Wallet, Remote) {

        $scope.getMyAccountUser = Auth.getCurrentUser;

        $scope.createWallet = function () {
            var currentUser = $scope.getMyAccountUser();
            return Wallet.getByOwnerEmail({ownerEmail: currentUser.email}).$promise
                .then(function (data) {
                    if (data.length < 1) {
                        var newWallet = {};
                        if (currentUser.email === 'admin@admin.com') {
                            newWallet.publicKey = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
                        }
                        if (!currentUser.passphrase) {
                            newWallet.passphrase = 'masterpassphrase';
                        }

                        newWallet.ownerEmail = currentUser.email;
                        newWallet.currency = "XRP";

                        return Wallet.save(newWallet,
                            function (data) {
                                Remote.loadCurrentUserBalance();
                                swal('Good job!', 'Congratulations ' + currentUser.name + '! You created an new wallet! ' + data.publicKey, 'success');
                            },
                            function () {
                                swal('Error', 'Sorry there was a problem processing your request!', 'error');
                            }.bind(this)).$promise;
                    }
                });
        };

        $scope.message = 'Not connected to any server';
        $scope.ballance = '0 XRPs :(';
        $scope.ledgerClosed = '';
        $scope.error = '';
        Remote.init();
    });
