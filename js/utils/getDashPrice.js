'use strict';

var __ = require('underscore'),
    $ = require('jquery'),
    app = require('../App').getApp();

/*eslint no-use-before-define:0*/
module.exports = function (currency, callback) {
    //some APIs require currency to be upper case
  currency = currency.toUpperCase();

  var showStatus,
      dashPrices = [],
      dashAverages = {rates: {}};

    //if this is the first check, show status
  if (!window.dashAverages){
    showStatus = app.statusBar.pushMessage({
      msg: window.polyglot.t('LoadingDashPrices'),
      duration: false
    });
  }

  window.dashAverages = window.dashAverages || {};

  var getDASHPrices = function(){
    $.ajax({
      url: app.serverConfigs.getActive().getServerBaseUrl() + '/dash_price',
      dataType: 'json',
      cache: false //just in case
    })
      .done(function(data){
        if (!__.isEmpty(data.currencyCodes)){
          dashPrices.push(data.currencyCodes);
        }
      })
      .fail(function (jqXHR, textStatus, errorThrown) {
        logAPIErrorInfo("Call to dash_price", jqXHR, textStatus, errorThrown);
      })
      .always(function () {
        makeAveragePrice();
      });

  };

  // DASHTODO: I have no idea what this bit does, so I'm not changing it to "DASH"
  if (currency == "BTC" && window.currencyKeys) {
    typeof callback === 'function' && callback(1, window.currencyKeys);
  } else if (window.dashAverages.timeStamp
        && Math.floor((new Date() - window.dashAverages.timeStamp) / 60000) < 15
        && window.currencyKeys
        && window.dashAverages.rates[currency]) {
    typeof callback === 'function' && callback(window.dashAverages.rates[currency], window.currencyKeys);
  } else {
    getDASHPrices();
  }

  // DASHTODO: this is purely generic and could be factored out of getBitcoinPrice/getDashPrice
  var makeAveragePrice = function () {
    var sum,
        currencyPrices,
        currency_code,
        currencyKeys,
        averagePrice,
        keys = {};
    dashAverages.timeStamp = new Date();
    for (var i in dashPrices) {
      if (dashPrices.hasOwnProperty(i)) {
        keys = $.extend(keys, dashPrices[i]);
      }
    }
    if (dashPrices.length === 0) {
      console.log("Dash exchange rates are not available.");
    }
    currencyKeys = Object.keys(keys);
    for (var index in currencyKeys) {
      if (currencyKeys.hasOwnProperty(index)) {
        currency_code = currencyKeys[index];
        currencyPrices = [];
        for (var j in dashPrices) {
          if (dashPrices[j][currency_code]) {
            currencyPrices.push(dashPrices[j][currency_code]);
          }
        }
        sum = 0;
        for (var jIndex in currencyPrices) {
          if (currencyPrices.hasOwnProperty(jIndex)) {
            sum += Number(currencyPrices[jIndex]);
          }
        }
        averagePrice = sum / currencyPrices.length;  //TODO: Eliminate division due to floating point math
        dashAverages.rates[currency_code] = averagePrice;
      }
    }
    window.dashAverages = dashAverages;
    window.currencyKeys = currencyKeys;

    showStatus && showStatus.remove();

    // DASHTODO: I have no idea what this bit does, so I'm not changing it to "DASH"
    if (currency != "BTC"){
      typeof callback === 'function' && callback(dashAverages.rates[currency], currencyKeys);
    } else {
      typeof callback === 'function' && callback(1, currencyKeys);
    }
  };

  function logAPIErrorInfo(APIname, jqXHR, textStatus, errorThrown) {
    console.log(APIname + " request failed: ");
    console.log(jqXHR);
    console.log(textStatus);
    console.log(errorThrown);
  }
};
