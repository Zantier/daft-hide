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

  let housesStoreIndex = 'daft_hide';
  // Indexed by URL.
  let houses = {};

  $(document).ready(function() {
    houses = getUrlInfo();

    // Single property, or property search
    // Logging this first helps to see if the script is completely broken
    // because daft has updated
    let pageType = 'none';
    if ($('*[data-testid="results"]').length === 1) {
      pageType = 'search';
    }
    if ($('*[data-testid="header-image-component"]').length === 1) {
      pageType = 'single';
    }
    log(`pageType: ${pageType}`);

    if (pageType === 'search') {
      let $boxes = getBoxes();
      $boxes.each(function(i, ele) {
        initializeBox(ele);
      });
    }

    if (pageType === 'single') {
      updatePropertyPage();
    }
  });

  // Get the list of URLs to ignore.
  function getUrlInfo() {
    let result = {};
    let catValues = GM_getValue(housesStoreIndex, '');
    if (catValues) {
      result = JSON.parse(catValues);
    }

    return result;
  }

  // Initialize a box containing a house.
  function initializeBox(ele) {
    // Each box has an image (either to the left, or large image above)
    // then a line for the price, and a line for the address
    let $box = $(ele);
    let $titleBox = $box.find('*[data-testid="address"]');
    ensureSingleElement({ $titleBox });
    let $urlBox = $box.find('> a');
    ensureSingleElement({ $urlBox });

    let $priceBox = $box.find('*[data-testid="price"]');
    ensureSingleElement({ $priceBox });
    let price = $priceBox.text();
    let url = $urlBox.attr('href');

    initializeControls(url, $titleBox, price, $box);
  }

  // Show stuff on property page.
  function updatePropertyPage() {
    let $titleBox = $('*[data-testid="address"],*[data-testid="alt-title"]')
    if ($titleBox.length == 0) {
      return;
    }

    let url = window.location.pathname;

    initializeControls(url, $titleBox, undefined, undefined);
  }

  // This will be used both in search results and property page
  function initializeControls(url, $titleBox, price, $hideBox) {
    let house = houses[url];
    let desc = '';

    let checkedText = 'checked="true"';
    if (house) {
      desc = house.desc;
      if (!house.doShow) {
        showAndHide($hideBox, false);
        checkedText = '';
      }
    }

    let $checkboxContainer = $('<div class="checkbox-container"></div>');
    let $descContainer = $('<div class="desc-container"></div>');
    $titleBox.before($checkboxContainer);
    $titleBox.after($descContainer);

    let $checkbox = $('<input class="checkbox_ignore" type="checkbox" ' + checkedText + ' />');
    let $descDiv = $('<textarea class="desc" style="resize:none; width:400px">' + desc + '</textarea>');

    $checkboxContainer.append($checkbox);
    if (price) {
      $checkboxContainer.append($('<span> ' + price + '</span>'));
    }
    $checkbox.on('click', function() {
      submitChange(url, $checkbox, $descDiv, $hideBox);
    });

    // When we click on checkbox or description box, don't follow the property link
    $checkboxContainer.on('click', function(ev) {
      ev.stopPropagation();
    });
    $descContainer.on('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
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
    let doShow = $checkbox.prop('checked');
    let desc = $descDiv.val();

    showAndHide($box, doShow);

    let house = houses[url];
    let inList = !doShow || desc;

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
  function getBoxes() {
    return $('.SearchPage__Result-gg133s-2');
  }

  // Ensure that the jQuery object has only a single element
  // elementObject: { elementName: $element }
  function ensureSingleElement(elementObject) {
    let elementName = Object.keys(elementObject)[0];
    let $element = Object.values(elementObject)[0];
    if ($element.length !== 1) {
      logError(`Wrong ${elementName} count: ${$element.length}`);
    }
  }

  function log(msg) {
    console.log(`daft_hide: ${msg}`);
  }
  function logError(msg) {
    console.error(`daft_hide: ${msg}`);
  }
})();
