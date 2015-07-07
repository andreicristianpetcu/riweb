'use strict';

angular.module('riwebApp')
    .service('RippleWalletService', function (Wallet, RippleRemoteService, RippleAccountService, TrustLineService, Auth, RIPPLE_ROOT_ACCOUNT) {

        var walletInfo = {
            wallet: undefined
        };

        var theRemote;
        var currentUser = Auth.getCurrentUser();

        function showTransactionResultMessage(err) {
            if (err) {
                swal('Error', 'Failed to set the DefaultRipple flag on the cold wallet account: ' + err.message, 'error');
            }
            else {
                swal('Info', 'Set the DefaultRipple flag on the cold wallet account', 'info');
            }
        }

        function getCurrentUserWallet(callback){
            currentUser = Auth.getCurrentUser();
            Wallet.getByOwnerEmail({ownerEmail: currentUser.email}).$promise.then(function(data){
                callback(data);
            });
        }

        function setAccountFlagsForAdmin(err, flags) {
            if (err) {
                swal('Error', 'There was an error communicating with the server: ' + err.message, 'error');
            }
            else {
                /*jshint bitwise: false*/
                if (!(flags & 0x00800000)) {
                    // OK, let's set the DefaultRipple flag if it's not there
                    theRemote.setSecret(RIPPLE_ROOT_ACCOUNT.address, RIPPLE_ROOT_ACCOUNT.secret);

                    var transaction = theRemote.createTransaction('AccountSet', {
                        account: RIPPLE_ROOT_ACCOUNT.address,
                        set: 'DefaultRipple'
                    });

                    transaction.submit(showTransactionResultMessage);

                } else {
                    swal('Info', 'The admin account wallet has the DefaultRipple flag active, flags are: ' + flags, 'info');
                }
            }
        }

        function checkColdWalletFlagsWithRemote(remote) {
            theRemote = remote;

            var reqOptions = {
                account: RIPPLE_ROOT_ACCOUNT.address,
                ledger: 'validated'
            };

            theRemote.requestAccountFlags(reqOptions, setAccountFlagsForAdmin);
        }

        function checkColdWalletFlags() {
            RippleRemoteService.onRemotePresent(checkColdWalletFlagsWithRemote);
        }

        function loadCurrentUserBalance(callback) {
            if (Auth.getCurrentUser().email) {

                getCurrentUserWallet(function (data) {
                    if (data.length >= 1) {
                        walletInfo.wallet = data[0];
                        RippleAccountService.loadBalance(walletInfo.wallet.publicKey, callback);
                    } else {
                        createWallet();
                    }
                });
            }
        }

        function saveWallet(newWallet) {
            Wallet.save(newWallet,
                function () {
                    makeInitialXRPTransfer(newWallet.publicKey);
                },
                function () {
                    swal('Error', 'Sorry there was a problem processing your request!', 'error');
                });
        }

        function buildNewInitialXRPTransaction(destinationAddress) {
            return theRemote.createTransaction('Payment', {
                account: RIPPLE_ROOT_ACCOUNT.address,
                destination: destinationAddress,
                amount: 300000000
            });
        }

        function makeInitialXRPTransfer(destinationAddress) {
            //do not send money to self
            if (destinationAddress !== RIPPLE_ROOT_ACCOUNT.address) {
                RippleRemoteService.onRemotePresent(function (remote) {
                    theRemote = remote;
                    theRemote.setSecret(RIPPLE_ROOT_ACCOUNT.address, RIPPLE_ROOT_ACCOUNT.secret);

                    var transaction = buildNewInitialXRPTransaction(destinationAddress);

                    transaction.submit(function (err) {
                        if (!err) {
                            var makeInitialTrustLines = TrustLineService.buildMakeInitialTrustLines(walletInfo, remote);
                            makeInitialTrustLines(destinationAddress);
                        } else {
                            swal('Error', 'Sorry there was a problem processing your request! ' + err.message, 'error');
                        }
                    });
                });
            } else {
                loadCurrentUserBalance();
            }
        }

        function generateNewWallet() {
            var newWallet = {};
            newWallet.ownerEmail = currentUser.email;
            // generate new wallet
            var wallet = ripple.Wallet.generate();
            newWallet.publicKey = wallet.address;
            newWallet.passphrase = wallet.secret;
            saveWallet(newWallet);
        }

        function reuseAdminWallet() {
            var newWallet = {};
            newWallet.ownerEmail = currentUser.email;
            //reuse existing known wallet
            newWallet.publicKey = RIPPLE_ROOT_ACCOUNT.address;
            newWallet.passphrase = RIPPLE_ROOT_ACCOUNT.secret;
            saveWallet(newWallet);
            checkColdWalletFlags();
        }

        function generateWalletIfMissing(existingWalletFound) {
            if (existingWalletFound.length < 1) {
                if (currentUser.role === 'admin') {
                    reuseAdminWallet();
                } else {
                    generateNewWallet();
                }
            }
        }

        function createWallet() {
            console.log('Creating wallet');
            if (currentUser) {
                if (currentUser.email !== walletInfo.makingWalletForEmail) {
                    walletInfo.makingWalletForEmail = currentUser.email;
                    getCurrentUserWallet(generateWalletIfMissing);
                }
            }
        }

        return {
            createWallet: createWallet,
            loadCurrentUserBalance: loadCurrentUserBalance,
            walletInfo: walletInfo
        };
    });
