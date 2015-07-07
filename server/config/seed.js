/**
 * Populate DB with sample data on server start
 * to disable, edit config/environment/index.js, and set `seedDB: false`
 */

'use strict';

var User = require('../api/user/user.model');
var Wallet = require('../api/wallet/wallet.model');
var BankAccount = require('../api/bankaccount/bankaccount.model');

User.find({}).remove(function() {
  User.create({
    provider: 'local',
    name: 'Test User',
    email: 'test@test.com',
    password: 'test',
    bank: 'ing'
  }, {
    provider: 'local',
    role: 'admin',
    name: 'Admin',
    email: 'admin@admin.com',
    password: 'admin',
    bank: 'ing'
  }, function() {
      console.log('finished populating users');
    }
  );
});

BankAccount.find({}).remove(function() {
  BankAccount.create({
    name: 'ing',
    info: 'ING Bank',
    coldWallet: {
      address: 'r4gzWvzzJS2xLuga9bBc3XmzRMPH3VvxXg'
    },
    hotWallet : {
      address: 'rJXw6AVcwWifu2Cvhg8CLkBWbqUjYbaceu',
      secret: 'ssVbYUbUYUH8Yi9xLHceSUQo6XGm4'
    }
  },
  {
    name: 'abnamro',
    info: 'ABN Amro Bank',
    coldWallet: {
      address: ''
    },
    hotWallet: {
      address: '',
      secret: ''
    }
  }, function() {
      console.log('finished creating bank account data');
    }
  );
});

Wallet.find({}).remove().exec();
