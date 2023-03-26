// ==UserScript==
// @name       daft.ie hide
// @namespace  http://daft-hide.daav.ee/
// @version    0.6
// @description  hide properties on daft.ie
// @match      *://*.daft.ie/*
// @require    http://code.jquery.com/jquery-3.0.0.min.js
// @copyright  2014+, David Phillips
// @grant      GM_getValue
// @grant      GM_setValue
// ==/UserScript==

(function() {
  'use strict';

  var housesStoreIndex = 'daft_hide';
  // Indexed by URL.
  var houses = {};

  $(document).ready(function()
  {
    houses = getUrlInfo();
    var $boxes = getBoxes();
    $boxes.each(function(i, ele) {
      initializeBox(ele);
    });

    updatePropertyPage();
  });

  // Get the list of URLs to ignore.
  function getUrlInfo()
  {
    var result = {};
    var catValues = GM_getValue(housesStoreIndex, '');
    if (catValues) {
      result = JSON.parse(catValues);
    }

    return result;
  }

  // Initialize a box containing a house.
  function initializeBox(ele)
  {
    // Each box has an image (either to the left, or large image above)
    // then a line for the price, and a line for the address
    var $box = $(ele);
    var $titleBox = $box.find('.TitleBlock__Address-sc-1avkvav-8');
    ensureSingleElement({ $titleBox });
    var $urlBox = $box.find('> a');
    ensureSingleElement({ $urlBox });

    var $priceBox = $box.find('.TitleBlock__Price-sc-1avkvav-4');
    ensureSingleElement({ $priceBox });
    var price = $priceBox.text();
    var url = $urlBox.attr('href');

    initializeControls(url, $titleBox, price, $box);
  }

  // Show stuff on property page.
  function updatePropertyPage() {
    var $titleBox = $('.TitleBlock__Address-sc-1avkvav-8')
    if ($titleBox.length == 0) {
      return;
    }

    var url = window.location.pathname;

    initializeControls(url, $titleBox, undefined, undefined);
  }

  // This will be used both in search results and property page
  function initializeControls(url, $titleBox, price, $hideBox) {
    var house = houses[url];
    var desc = '';

    var checkedText = 'checked="true"';
    if (house) {
      desc = house.desc;
      if (!house.doShow) {
        showAndHide($hideBox, false);
        checkedText = '';
      }
    }

    var $checkboxContainer = $('<div class="checkbox-container"></div>');
    var $descContainer = $('<div class="desc-container"></div>');
    $titleBox.before($checkboxContainer);
    $titleBox.after($descContainer);

    var $checkbox = $('<input class="checkbox_ignore" type="checkbox" ' + checkedText + ' />');
    var $descDiv = $('<textarea class="desc" style="resize:none; width:400px">' + desc + '</textarea>');

    $checkboxContainer.append($checkbox);
    if (price) {
      $checkboxContainer.append($('<span> ' + price + '</span>'));
    }
    $checkbox.on('click', function() {
      submitChange(url, $checkbox, $descDiv, $hideBox);
    });

    $descContainer.append($descDiv);
    auto_grow($descDiv[0]);
    $descDiv.on('input', function() {
      submitChange(url, $checkbox, $descDiv, $hideBox);
      auto_grow(this);
    });
  }

  function auto_grow(element) {
    element.style.height = '5px';
    element.style.height = (element.scrollHeight)+'px';
  }

  function showAndHide($box, doShow) {
    if (!$box) {
      return;
    }

    if (doShow) {
      $box.find('.PropertyImage__mainImageContainerStandard').show();
      $box.find('.PropertyImage__mainImageContainer').show();
      $box.find('.brandLink').show();
    } else {
      $box.find('.PropertyImage__mainImageContainerStandard').hide();
      $box.find('.PropertyImage__mainImageContainer').hide();
      $box.find('.brandLink').hide();
    }
  }

  function submitChange(url, $checkbox, $descDiv, $box) {
    var doShow = $checkbox.prop('checked');
    var desc = $descDiv.val();

    showAndHide($box, doShow);

    var house = houses[url];
    var inList = !doShow || desc;

    if (inList) {
      houses[url] = {
        doShow: doShow,
        desc: desc,
      };
    } else {
      delete houses[url];
    }

    //console.log(houses);
    GM_setValue(housesStoreIndex, JSON.stringify(houses));
  }

  // Get jQuery object of all boxes containing a house.
  function getBoxes()
  {
    return $('.SearchPage__Result-gg133s-2');
  }

  // Ensure that the jQuery object has only a single element
  // elementObject: { elementName: $element }
  function ensureSingleElement(elementObject)
  {
    let elementName = Object.keys(elementObject)[0];
    let $element = Object.values(elementObject)[0];
    if ($element.length !== 1) {
      log(`Wrong ${elementName} count: ${$element.length}`);
    }
  }

  function log(msg)
  {
    console.error(`daft_hide: ${msg}`);
  }
})();
