'use strict';

var sinon = require('sinon');
var app = require('../../app');
var chai = require('chai');
var io = require('socket.io');
var expect = chai.expect;
var ripple = require('ripple-lib');
var Q = require('q');
var sinonChai = require("sinon-chai");
chai.use(sinonChai);

var Utils = require('./../../utils/utils');
var Wallet = require('./../wallet/wallet.model');
var account_info = require('./account_info.socket');
var TestingUtils = require('./../../../test/utils/testing_utils');

describe('Test account_info', function () {
    var socket, remote;
    beforeEach(function () {
        socket = TestingUtils.buildSocketSpy();

        ripple.Wallet.generate = sinon.stub().returns(TestingUtils.getNonAdminRippleGeneratedWallet());

        remote = TestingUtils.buildRemoteStub();
        account_info.register(socket);

        Utils.getNewConnectedAdminRemote = sinon.stub().returns(Q.resolve(remote));
        Utils.getNewConnectedRemote = sinon.stub().returns(Q.resolve(remote));
    });

    beforeEach(function () {
        sinon.spy(Wallet, "create");
    });
    afterEach(function () {
       Wallet.create.restore();
       Wallet.findByOwnerEmail.restore();
    });

    it('should get account_info for unexisting email', function (done) {
        TestingUtils.buildFindByOwnerEmailForUnexisting(Wallet);

        account_info.get_account_info('not_exist@example.com', socket).then(function () {
            expect(socket.emit).to.have.calledWith('post:account_info', {info: 'User does not exist!'});
            expect(socket.emit).to.have.callCount(1);
            done();
        }).done(null, function(error){done(error);});
    });

    it('should get account_info for admin email', function (done) {
        TestingUtils.buildFindByOwnerEmailForAdmin(Wallet);

        account_info.get_account_info('admin@admin.com', socket).then(function () {
            expect(socket.emit).to.have.callCount(1);
            expect(socket.emit).to.have.calledWith('post:account_info', {balance: 0});
            done();
        }).done(null, function(error){done(error);});
    });

});
