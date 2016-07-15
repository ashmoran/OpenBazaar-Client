'use strict';

var __ = require('underscore'),
    $ = require('jquery'),
    loadTemplate = require('../utils/loadTemplate'),
    countriesModel = require('../models/countriesMd'),
    baseModal = require('./baseModal'),
    buyDashDetailsVw = require('./buyDashDetailsVw'),
    buyAddressesVw = require('./buyAddressesVw'),
    saveToAPI = require('../utils/saveToAPI'),
    chosen = require('../utils/chosen.jquery.min.js'),
    qr = require('qr-encode'),
    app = require('../App').getApp(),
    clipboard = require('clipboard'),
    templateHelpers = require('../utils/templateHelpers');

// randomize function
$.fn.randomize = function(selector){
  var $elems = selector ? $(this).find(selector) : $(this).children(),
      $parents = $elems.parent();

  $parents.each(function(){
    $(this).children(selector).sort(function(){
      return Math.round(Math.random()) - 0.5;
    }).detach().appendTo(this);
  });

  return this;
};

module.exports = baseModal.extend({

  className: "buyView custCol-text insideApp",

  events: {
    'click .js-buyDashWizardModal': 'blockClicks',
    'click .js-closeBuyWizardModal': 'closeWizard',
    'click .js-buyDashWizardNewAddressBtn': 'createNewAddress',
    'click .js-buyDashWizardModeratorRadio': 'modSelected',
    'click .js-buyDashWizardModNext': 'modNext',
    'click .js-buyDashWizardModBack': 'modBack',
    'click .js-buyDashWizardReturnNext': 'returnNext',
    'click .js-buyDashWizardAddressBack': 'addressPrev',
    'click .js-buyDashWizardAddressNext': 'addressNext',
    'click .js-buyDashWizardWalletNext': 'walletNowClick',
    'click .js-buyDashWizardHasWallet': 'hasWalletClick',
    // // Scenario to be handled later
    // 'click .js-buyDashWizardDoesntHaveWallet': 'doesntHaveWallet',
    'click .js-buyDashWizardNewAddressCancel': 'onAddressCancel',
    'click .js-buyDashWizardNewAddressSave': 'saveNewAddress',
    'click .js-buyDashWizardSendPurchase': 'sendPurchase',
    'click .js-buyDashWizardPurchaseBack': 'backPurchase',
    'click .js-buyDashWizardPayCopy': 'copyPayAddress',
    'click .js-accordionNext': 'accNext',
    'click .js-accordionPrev': 'accPrev',
    'click .js-buyDashWizardCountryWrapper': 'openCountrySelect',
    'click .js-buyDashWizardPayCheck': 'checkPayment',
    'click .js-buyDashWizardCloseSummary': 'closeWizard',
    'click input[name="radioPaymentType"]': 'changePaymentType',
    'click #BuyWizardQRDetailsInput': 'toggleQRDetails',
    'click .js-partialPaymentClose': 'hidePartialPaymentMsg',
    'blur input': 'validateInput'
  },

  initialize: function(options){
    var self = this,
        countries = new countriesModel();

    this.options = options || {};
    /* expected options are:
    userModel: this is set by main.js, then by a call to the settings API.
    socketView: this is a reference to the socketView
    worldwide: does this ship worldwide
    shippingRegions: countries this item ships to
     */
    this.userModel = this.options.userModel;
    this.worldwide = this.options.worldwide;
    this.shippingRegions = this.options.shippingRegions;
    //this.hideMap = true;
    this.orderID = "";
    this.model.set('selectedModerator', "");
    this.model.updateAttributes();
    this.cachePayData = "";
    this.partialPaymentAmount = 0;

    //create the country select list
    this.countryList = countries.get('countries');
    this.countriesSelect = $('<select class="chosen custCol-text" id="buyDashWizardCountryInput" required></select>');
    __.each(this.countryList, function(countryFromList){
      var countryOption = $('<option value="'+countryFromList.dataName+'" data-name="'+countryFromList.name +'">'+window.polyglot.t(`countries.${countryFromList.dataName}`)+'</option>');
      countryOption.attr("selected", self.options.userModel.get('country') == countryFromList.dataName);
      self.countriesSelect.append(countryOption);
    });
    this.listenTo(this.model, 'change:totalPrice', this.setTotalPrice);
    this.listenTo(window.obEventBus, "socketMessageReceived", function(response){
      this.handleSocketMessage(response);
    });
    this.listenTo(window.obEventBus, "closeBuyWizard", this.closeWizard);

    //make sure the model has a fresh copy of the user
    this.model.set('user', this.userModel.attributes);
  },

  handleSocketMessage: function(response) {
    var data = JSON.parse(response.data);
    if (data.notification && data.notification.order_id == this.orderID){
      if (data.notification.type == "payment received") {
        this.showSummary();
        this.hidePartialPaymentMsg();
      } else if (data.notification.type == "partial payment"){
        this.showPartialPaymentMsg(data.notification);
      }
    }
  },

  showPartialPaymentMsg: function(data){
    var payMsg = "";
    this.partialPaymentAmount = data.amount_funded;
    payMsg = window.polyglot.t('transactions.BuyerPaidMessage', {
      paidAmount: templateHelpers.intlNumFormat(this.partialPaymentAmount, 8),
      totalAmount: templateHelpers.intlNumFormat(this.model.get('totalDASHDisplayPrice'), 8)
    });

    this.$('.js-partialPaymentMsg')
        .addClass('fadeIn')
        .find('.js-partialPaymentTxt').text(payMsg);

    this.showPayAddress();
  },

  hidePartialPaymentMsg: function(){
    this.$('.js-partialPaymentMsg').removeClass('fadeIn');
  },

  initAccordion: function(targ){
    this.acc = $(targ);
    this.accWidth = this.acc.width();
    this.accHeight = this.acc.height();
    this.accChildren = this.acc.find('.accordion-child');
    this.accNum = this.accChildren.length;
    this.accWin = this.acc.find('.accordion-window');
    this.accWinWidth = this.accWidth * this.accNum;
    this.accWin.css({'left': '0px', 'width': this.accWinWidth});
    this.accChildren.css({'width': this.accWidth, 'height': this.accHeight});
  },

  accNext: function(advanceBy){
    var oldPos = parseInt(this.accWin.css('left').replace("px", "")),
        moveBy = parseInt(advanceBy) ? this.accWidth * advanceBy : this.accWidth;

    if (oldPos > (this.accWidth * (this.accNum -1) * -1)){
      this.accWin.css('left', function(){
        return oldPos - moveBy;
      });
    }
  },

  accPrev: function(rewindBy){
    var oldPos = parseInt(this.accWin.css('left').replace("px", "")),
        moveBy = parseInt(rewindBy) ? this.accWidth * rewindBy : this.accWidth;

    if (oldPos < (0)){
      this.accWin.css('left', function(){
        return oldPos + moveBy;
      });
    }
  },

  accGoToID: function(ID, focusOn){
    var targID = this.accWin.find(ID),
        oldPos = parseInt(this.accWin.css('left').replace("px", "")),
        currIndex = oldPos / this.accWidth * -1,
        newIndex = targID.index(),
        moveBy = this.accWidth * (currIndex - newIndex);

    this.accWin.css('left', function(){
      return oldPos + moveBy;
    });
    // focus
    if (focusOn){
      targID.find(focusOn).focus();
    }
  },

  render: function(){
    var self = this;

    loadTemplate('./js/templates/buyDashWizard.html', function(loadedTemplate) {
      self.$el.html(loadedTemplate(self.model.toJSON()));

      baseModal.prototype.render.apply(self, arguments);

      //add subviews
      self.buyDashDetailsView && self.buyDashDetailsView.remove();
      self.buyDashDetailsView = new buyDashDetailsVw({model: self.model});
      self.registerChild(self.buyDashDetailsView);

      self.buyAddressesView && self.buyAddressesView.remove();
      self.buyAddressesView = new buyAddressesVw({model: self.model, userModel: self.userModel, worldwide: self.worldwide, shippingRegions: self.shippingRegions});
      self.registerChild(self.buyAddressesView);

      self.listenTo(self.buyAddressesView, 'setAddress', self.addressSelected);

      self.$buyDashWizardMap = self.$('.js-buyDashWizardMap');

      //init the accordion
      setTimeout(() => self.initAccordion('.js-buyDashWizardAccordion'));

      // fade the modal in after it loads and focus the input
      self.$el.find('.js-buyDashWizardModal').removeClass('fadeOut');

      //add all countries to the Ships To select list
      self.$el.find('.js-buyDashWizardCountryWrapper').append(self.countriesSelect);

      //add address view
      self.buyAddressesView.render(0);
      self.$el.find('.js-buyDashWizardAddresses').append(self.buyAddressesView.el);
      //add details view
      self.$el.find('.js-buyDashWizardInsertDetails').append(self.buyDashDetailsView.el);

      //auto select first payment type
      self.$el.find("input:radio[name=radioPaymentType]:first").attr('checked', true).trigger('click');

      //randomize the bitcoin wallet providers 5 times
      for (var i = 0; i < 5; i++) {
        $(".js-BuyWizardWallets").randomize();
      }

      //set the QR details checkbox
      var QRtoggleVal = localStorage.getItem('AdditionalPaymentData') != "false";
      self.$('#BuyWizardQRDetailsInput').prop('checked', QRtoggleVal);
    });
    return this;
  },

  modSelected: function(e){
    var modIndex = $(e.target).val();
    //this.$el.find('.js-buyDashWizardModNext').removeClass('disabled');
    if (modIndex != "direct"){
      this.model.set('selectedModerator', this.model.get('vendor_offer').listing.moderators[modIndex]);
    } else {
      this.model.set('selectedModerator', "");
    }

    this.$el.find('#BuyWizardPaymentType .js-buyDashWizardModNext').removeClass('disabled');

  },

  showMaps: function(){
    this.$el.find('.js-buyDashWizardMap').removeClass('hide');
  },

  hideMaps: function(){
    this.$el.find('.js-buyDashWizardMap').addClass('hide');
  },

  createNewAddress: function(){
    this.$el.find('.js-buyDashWizardAddress').addClass('hide');
    this.$el.find('.js-buyDashWizardNewAddress').removeClass('hide');
    this.$el.find('#buyDashWizardNameInput').focus();
    this.$el.addClass('addressFormOpened');
    this.$buyDashWizardMap.find('iframe').addClass('blurMore');

    //set chosen inputs
    $('.chosen').chosen({
      search_contains: true,
      no_results_text: window.polyglot.t('chosenJS.noResultsText'),
      placeholder_text_single: window.polyglot.t('chosenJS.placeHolderTextSingle'),
      placeholder_text_multiple: window.polyglot.t('chosenJS.placeHolderTextMultiple')
    });
  },

  onAddressCancel: function() {
    this.$buyDashWizardMap.find('iframe').removeClass('blurMore');
    this.hideNewAddress();
  },

  hideNewAddress: function(){
    this.$el.find('.js-buyDashWizardAddress').removeClass('hide');
    this.$el.find('.js-buyDashWizardNewAddress').addClass('hide');
    this.$el.removeClass('addressFormOpened');
  },

  addressSelected: function(selectedAddress){
    this.model.set('selectedAddress', selectedAddress);
    this.displayMap(selectedAddress);
    this.$el.find('.js-buyDashWizardAddressNext').removeClass('disabled');
  },

  hasWalletClick: function(){
    this.accGoToID('#BuyWizardPaymentType');
  },

  walletNowClick: function(){
    this.accGoToID("#BuyWizardPaymentType");
  },

  modNext: function(){
    this.accNext();
    this.setTotalPrice(); //in case it isn't set yet
  },

  modBack: function(){
    this.accGoToID('#BuyWizardBitcoinWallet');
  },

  // Scenario to be handled later
  // doesntHaveWallet: function(){
  //   //this.hasWallet = false;
  //   this.accNext();
  // },

  modelToFormData: function(modelJSON, formData, existingKeys) {
    var newFormData = formData || new FormData();
    __.each(modelJSON, function(value, key) {
      if (!__.has(existingKeys, key)) {
        newFormData.append(key, value);
      }
    });
    return newFormData;
  },

  changePaymentType: function(e) {
    var checked = $(e.target);

    // uncheck prior selections
    $('.js-buyDashWizardModeratorRadio').prop('checked', false);

    if (checked.attr('id') === "buyDashWizardPaymentTypeDirect") {
      this.$el.find('.js-buyDashWizardModeratorList').addClass('hide');
      this.$el.find('#buyDashWizardNoModerator').prop('checked', true).trigger( "click" );
      this.$el.find('#BuyWizardPaymentType .js-buyDashWizardModNext').removeClass('disabled');
    } else {
      this.$el.find('.js-buyDashWizardModeratorList').removeClass('hide');
      this.$el.find('#BuyWizardPaymentType .js-buyDashWizardModNext').addClass('disabled');
    }
  },

  saveNewAddress: function(){
    var self = this,
        targetForm = this.$el.find('#buyDashWizardNewAddressForm'),
        newAddress = {},
        newAddresses = [],
        addressData = {};

    __.each(this.userModel.get('shipping_addresses'), function(address){
      newAddresses.push(JSON.stringify(address));
    });

    newAddress.name = this.$el.find('#buyDashWizardNameInput').val();
    newAddress.street = this.$el.find('#buyDashWizardStreetInput').val();
    newAddress.city = this.$el.find('#buyDashWizardCityInput').val();
    newAddress.state = this.$el.find('#buyDashWizardStateInput').val();
    newAddress.postal_code = this.$el.find('#buyDashWizardPostalInput').val();
    newAddress.country = this.$el.find('#buyDashWizardCountryInput').val();
    newAddress.displayCountry = this.$el.find('#buyDashWizardCountryInput option:selected').data('name');

    if (newAddress.name && newAddress.street && newAddress.city && newAddress.state && newAddress.postal_code && newAddress.country) {
      newAddresses.push(JSON.stringify(newAddress));
    }

    addressData.shipping_addresses = newAddresses;

    saveToAPI(targetForm, this.userModel.toJSON(), self.model.get('serverUrl') + "settings", function(){
      self.$el.find('#buyDashWizardNameInput').val("");
      self.$el.find('#buyDashWizardStreetInput').val("");
      self.$el.find('#buyDashWizardCityInput').val("");
      self.$el.find('#buyDashWizardStateInput').val("");
      self.$el.find('#buyDashWizardPostalInput').val("");
      self.$el.find('#buyDashWizardCountryInput').val(self.userModel.get('country'));
      self.$el.find('.chosen').trigger('chosen:updated');
      targetForm.removeClass('formChecked').find('.formChecked').removeClass('formChecked');
      self.hideNewAddress();
      self.addNewAddress();
    }, "", addressData);
  },

  addNewAddress: function(){
    var self = this;
    this.userModel.fetch({
      success: function(data){
        var selected = data.attributes.shipping_addresses.length -1;
        //this will refresh the userModel, buyAddressView has a reference to it
        self.buyAddressesView.render(selected);
      },
      error: function(){
        app.simpleMessageModal.open({
          title: window.polyglot.t('errorMessages.serverError')
        });
      },
      complete: function(xhr, textStatus) {
        if (textStatus == 'parsererror'){
          app.simpleMessageModal.open({
            title: window.polyglot.t('errorMessages.serverError'),
            message: window.polyglot.t('errorMessages.badJSON')
          });
        }
      }
    });
  },

  displayMap: function(address){
    var addressString = "",
        $currentIframe;

    this.$buyDashWizardMap.find('.js-iframe-pending, .js-iframe-leaving')
      .remove();
    $currentIframe = this.$buyDashWizardMap.find('iframe');
    $currentIframe.addClass('blurMore');

    if (address && address.street && address.city && address.state && address.postal_code) {
      addressString = address.street + ", " + address.city + ", " + address.state + " " + address.postal_code + " " + address.displayCountry;
    } else {
      // if address is invalid, we'll create a dummy address for which google maps will show a map of the world
      addressString = "123 Street, City, State 12345 Country";
    }

    addressString = encodeURIComponent(addressString);
    var $iFrame = $('<iframe class="js-iframe-pending positionTop" width="525" height="250" frameborder="0" style="border:0; margin-top: 0; height: 250px; clip: rect(0,0,0,0)" />');

    if ($currentIframe.length) {
      this.$buyDashWizardMap.find('.js-mapSpinner').removeClass('hide');
      $iFrame.insertBefore($currentIframe);
    } else {
      this.$buyDashWizardMap.find('.mapWrap')
        .prepend($iFrame);
    }

    $iFrame.on('load', () => {
      this.$buyDashWizardMap.find('.js-mapSpinner').addClass('hide');

      $currentIframe.addClass('js-iframe-leaving')
        .fadeOut({
          duration: 'slow',
          complete: () => {
            $currentIframe.remove();
          }
        });
      $iFrame.removeClass('js-iframe-pending');
    });

    $iFrame.attr('src', 'https://www.google.com/maps/embed/v1/place?key=AIzaSyBoWGMeVZpy9qc7H418Jk2Sq2NWedJgp_4&q=' + addressString);
  },

  returnNext: function(){
    var self = this,
        bitCoinReturnAddr = this.$el.find('#buyDashWizardDashAddressInput').val(),
        modForm = this.$el.find('#buyDashWizardBitcoinReturnForm');

    modForm.addClass('formChecked');

    if (modForm[0].checkValidity()) {
      if (bitCoinReturnAddr != this.userModel.get('refund_address')) {
        saveToAPI(modForm, this.userModel.toJSON(), this.model.get('serverUrl') + "settings", function () {
          window.obEventBus.trigger("updateUserModel");
          self.skipAddressCheck();
        },
        function () {
          app.simpleMessageModal.open({
            title: window.polyglot.t('errorMessages.serverError'),
            message: window.polyglot.t('errorMessages.missingError') + '<br>' + window.polyglot.t('BitcoinReturnAddress')
          });
        });
      } else {
        this.skipAddressCheck();
      }
    }
  },

  skipAddressCheck: function(){
    if (this.model.get('vendor_offer').listing.metadata.category == "physical good"){
      this.accGoToID('#BuyWizardShipTo');
      this.showMaps();
      if (this.userModel.get('shipping_addresses').length === 0){
        this.createNewAddress();
        $('.js-buyDashWizardAddressBack').show();
        $('.js-buyDashWizardNewAddressCancel').hide();
      }
    } else {
      this.accGoToID('#BuyWizardDetails');
    }
  },

  addressPrev: function(){
    this.accGoToID("#BuyWizardBTCReturnAddress");
    this.hideMaps();
  },

  addressNext: function(){
    this.accNext();
    this.hideMaps();
  },

  sendPurchase: function(){
    var self = this,
        formData = new FormData(),
        moderatorID = this.model.get('selectedModerator').guid || "",
        selectedAddress = this.model.get('selectedAddress'),
        bitCoinReturnAddr = this.$('#buyDashWizardDashAddressInput').val();

    if (!this.$('#buyDashWizardQuantity')[0].checkValidity()){
      app.simpleMessageModal.open({
        title: window.polyglot.t('errorMessages.serverError'),
        message: window.polyglot.t('errorMessages.missingError')
      });
      return;
    }

    this.$('.js-buyDashWizardSendPurchase').addClass('hide');
    this.$('.js-buyDashWizardPendingMsg').removeClass('hide');
    this.$('.js-buyDashWizardPurchaseBack').addClass('disabled');

    formData.append("id", this.model.get('id'));

    formData.append("quantity", this.$el.find('.js-buyDashWizardQuantity').val());
    if (selectedAddress){
      formData.append("ship_to", selectedAddress.name);
      formData.append("address", selectedAddress.street);
      formData.append("city", selectedAddress.city);
      formData.append("state", selectedAddress.state);
      formData.append("postal_code", selectedAddress.postal_code);
      formData.append("country", selectedAddress.country);
    }

    if (moderatorID){
      formData.append("moderator", moderatorID);
    }

    this.$('.js-buyDashWizardSpinner').removeClass('hide');

    formData.append("refund_address", bitCoinReturnAddr);

    if (this.buyRequest){
      this.buyRequest.abort();
    }

    this.buyRequest = $.ajax({
      type: "POST",
      url: self.model.get('serverUrl') + "purchase_contract",
      contentType: false,
      processData: false,
      data: formData,
      dataType: 'json',
      success: function(data){
        if (data.success == true){
          self.showPayAddress(data);
          self.cachePayData = data; //cache the data for the QR Details toggle
        } else {
          app.simpleMessageModal.open({
            title: window.polyglot.t('errorMessages.contractError'),
            message: window.polyglot.t('errorMessages.sellerError') + ' ' +
              window.polyglot.t('errorMessages.checkPurchaseData') + '\n\n Reason: ' + data.reason
          });

          self.$('.js-buyDashWizardSpinner').addClass('hide');
          //re-enable form so they can try again
          self.$('.js-buyDashWizardSendPurchase').removeClass('hide');
          self.$('.js-buyDashWizardPendingMsg').addClass('hide');
          self.$('.js-buyDashWizardPurchaseBack').removeClass('disabled');
        }
      },
      error: function (jqXHR, status, errorThrown) {
        console.log(jqXHR);
        console.log(status);
        console.log(errorThrown);
      }
    });
  },

  toggleQRDetails: function(){
    var toggleInput = this.$('#BuyWizardQRDetailsInput'),
        toggleVal = toggleInput.prop('checked');
    localStorage.setItem('AdditionalPaymentData', toggleVal);
    this.showPayAddress();
  },

  showPayAddress: function(data){
    data = data || this.cachePayData;

    if (!data) {
      throw new Error('Data must be provided to the showPayAddress function');
    }

    var totalBTCPrice = 0,
        storeName = encodeURI(this.model.get('page').profile.name),
        message = encodeURI(this.model.get('vendor_offer').listing.item.title.substring(0, 20) + " "+data.order_id),
        payHREF = "",
        dataURI;
    this.$el.find('.js-buyDashWizardSpinner').addClass('hide');
    this.orderID = data.order_id;
    totalBTCPrice = data.amount - this.partialPaymentAmount;
    this.$el.find('.js-buyDashWizardDetailsTotalBTC').text(templateHelpers.intlNumFormat(totalBTCPrice, 8));
    this.payURL = data.payment_address;

    payHREF = "bitcoin:"+ data.payment_address+"?amount="+totalBTCPrice;
    if (localStorage.getItem('AdditionalPaymentData') != "false") {
      payHREF += "&label="+storeName+"&message="+message;
    }

    this.hideMaps();
    this.$el.find('.js-buyDashWizardPay').removeClass('hide');
    dataURI = qr(payHREF, {type: 10, size: 10, level: 'M'});
    this.$el.find('.js-buyDashWizardPayQRCode').attr('src', dataURI);
    this.$el.find('.js-buyDashWizardPayPrice').text();
    this.$el.find('.js-buyDashWizardPayURL').text(data.payment_address);
    this.$el.find('.js-buyDashWizardPayLink').attr('href', payHREF);
    this.buyDashDetailsView.lockForm();
  },

  hidePayAddress: function(){
    this.$el.find('.js-buyDashWizardPay').addClass('hide');
  },

  setTotalPrice: function(){
    var totalPrice = this.model.get('totalPrice'),
        totalDASHPrice = this.model.get('totalDASHDisplayPrice'),
        userCurrency = this.model.get('userCurrencyCode'),
        // DASHTODO: this needs handling updating when we start to allow customers to shop in DASH
        totalDisplayPrice = userCurrency == "BTC" ? app.intlNumFormat(totalPrice, 8) + " BTC" : new Intl.NumberFormat(window.lang, {
          style: 'currency',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          currency: userCurrency
        }).format(totalPrice);
    this.$('.js-buyDashWizardDetailsTotal').text(totalDisplayPrice);
    this.$('.js-buyDashWizardDetailsDASHTotal').text(app.intlNumFormat(totalDASHPrice, 8));
  },

  copyPayAddress: function(){
    clipboard.writeText(this.payURL);
  },

  backPurchase: function(){
    this.hidePayAddress();
    if (this.model.get('vendor_offer').listing.metadata.category == "physical good"){
      this.accGoToID('#BuyWizardShipTo');
      this.showMaps();
    } else {
      this.accGoToID('#BuyWizardBTCReturnAddress');
    }
    this.buyDashDetailsView.render();
    this.$el.find('.js-buyDashWizardSendPurchase').removeClass('hide');
    this.$el.find('.js-buyDashWizardPendingMsg').addClass('hide');
  },

  checkPayment: function(){
    var self = this,
        formData = new FormData();

    formData.append("order_id", this.orderID);
    $.ajax({ //this only triggers the server to send a new socket message
      type: "POST",
      url: self.model.get('serverUrl') + "check_for_payment",
      contentType: false,
      processData: false,
      data: formData,
      dataType: "json"
    });
  },

  showSummary: function(){
    this.$el.find('.js-buyDashWizardPay, .js-buyDashWizardOrderDetails, .js-buyDashWizardPendingMsg, .js-buyDashWizardPurchaseBack').addClass('hide');
    this.$el.find('.js-buyDashWizardOrderSummary, .js-buyDashWizardCloseSummary').removeClass('hide');

    // alert the user in case they're not in the active window
    new Notification(window.polyglot.t('buyFlow.paymentSent'), {
      silent: true
    });

    // play notification sound
    var notificationSound = document.createElement('audio');
    notificationSound.setAttribute('src', './audio/notification.mp3');
    notificationSound.play();
  },

  openCountrySelect: function(){
    //scroll to bottom
    var scrollParent = $('.js-buyDashWizardAddressScroller');
    scrollParent.scrollTop(scrollParent[0].scrollHeight);
  },

  blockClicks: function(e) {
    if (!$(e.target).hasClass('js-externalLink')){
      e.stopPropagation();
    }
  },

  validateInput: function(e) {
    var $input = $(e.target);

    if ($input.is('#buyDashWizardDashAddressInput')) {
      $input.val($input.val().trim());
    }

    e.target.checkValidity();
    $input.closest('.flexRow').addClass('formChecked');
  },

  closeWizard: function() {
    if (this.buyRequest){
      this.buyRequest.abort();
    }

    this.close();
  }
});