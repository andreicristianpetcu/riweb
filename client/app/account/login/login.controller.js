'use strict';

angular.module('riwebApp')
  .controller('LoginCtrl', function ($scope, $http, Auth, $location, socket) {
    $scope.user = {};
    $scope.errors = {};

    $scope.login = function(form) {
      $scope.submitted = true;

      if(form.$valid) {
        Auth.login({
          email: $scope.user.email,
          password: $scope.user.password
        })
        .then( function() {
          // Logged in, redirect to home
          $location.path('/myaccount');
        })
        .catch( function(err) {
          $scope.errors.other = err.message;
        });
      }
    };

  });
