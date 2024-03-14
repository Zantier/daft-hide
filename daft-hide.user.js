// ==UserScript==
// @name       daft.ie hide
// @namespace  http://daft-hide.daav.ee/
// @version    1.0
// @description  hide properties on daft.ie
// @author     David Phillips
// @match      *://*.daft.ie/*
// @require    http://code.jquery.com/jquery-3.0.0.min.js
// @grant      GM_getValue
// @grant      GM_setValue
// ==/UserScript==

(function() {
  'use strict';

  let housesStoreIndex = 'daft_hide';
  // Indexed by URL.
  let houses = {};
  let mutationObserver = new MutationObserver(function(changes) {
    onLoadPage();
  });

  $(document).ready(function() {
    onLoadPage();
  });

  function onLoadPage() {
    mutationObserver.disconnect();
    // When we click a property on a search page, or click back from a property page,
    // it performs a single mutation event on the react root element
    mutationObserver.observe(document.body, { childList:true, subtree:false });

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
    if ($('*[data-testid="mapsearch-wrapper"]').length === 1) {
      pageType = 'map';
    }
    log(`pageType: ${pageType}`);

    if (pageType === 'search') {
      mutationObserver.observe($('*[data-testid="results"]')[0], { childList:true, subtree:false });
      let $boxes = $('*[data-testid="results"] > *');
      $boxes.each(function(i, ele) {
        initializeBox(ele);
      });
    }

    if (pageType === 'single') {
      updatePropertyPage();
    }

    if (pageType === 'map') {
      mutationObserver.observe($('*[data-testid="mapsearch-carousel"]')[0], { childList: true, subtree: false });
      let $boxes = $('*[data-testid="mapsearch-carousel"] > *');
      $boxes.each(function (i, ele) {
        initializeBox(ele);
      });
    }
  }

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
    let floorArea = $box.find('*[data-testid="floor-area"]').text();
    let price = $priceBox.text();
    let url = $urlBox.attr('href');

    initializeControls(url, $titleBox, price, floorArea, $box);
  }

  // Show stuff on property page.
  function updatePropertyPage() {
    let $titleBox = $('*[data-testid="address"],*[data-testid="alt-title"]')
    ensureSingleElement({ $titleBox });

    let $priceBox = $('*[data-testid="price"]');
    ensureSingleElement({ $priceBox });
    let floorArea = $('*[data-testid="floor-area"]').text();
    let price = $priceBox.text();
    let url = window.location.pathname;

    initializeControls(url, $titleBox, price, floorArea, undefined);
  }

  // This will be used both in search results and property page
  function initializeControls(url, $titleBox, priceText, floorAreaText, $hideBox) {
    // When filtering search results, initialize can run multiple times on the same property
    let alreadyInitialized = $titleBox.parent().find('.checkbox_ignore').length > 0;
    if (alreadyInitialized) {
      return;
    }

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

    let price = toNumber(priceText);
    let floorArea = toNumber(floorAreaText);
    if (!isNaN(price) && !isNaN(floorArea)) {
      let pricePerFloorArea = Math.round(price/floorArea);
      priceText += `, €${pricePerFloorArea} per m²`;
    }

    $checkboxContainer.append($checkbox);
    $checkboxContainer.append($('<span> ' + priceText + '</span>'));
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

    let selectors = [
      '*[data-testid="agent-branding-top"]',
      '*[data-testid="agent-branding-top-lite"]',
      '*[data-testid="image-container"]',
      '*[data-testid="card-thumbnails"]',
      '*[data-testid="price"]',
      '*[data-testid="card-info"]',
      '*[data-testid="callout-container"]',
      '*[data-testid="heart-icon"]',
      '*[data-testid="info-stamp-featuredLevel-premium-partner"]',
    ];

    if (doShow) {
      for (let selector of selectors) {
        $box.find(selector).show();
      }
    } else {
      for (let selector of selectors) {
        $box.find(selector).hide();
      }
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

  // Convert string to number, stripping out any non-digit characters. If there are no
  // digits, return NaN.
  function toNumber(str) {
    let digits = '';
    for (let ch of str) {
      if (ch >= '0' && ch <= '9') {
        digits += ch;
      }
    }

    return parseInt(digits);
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
