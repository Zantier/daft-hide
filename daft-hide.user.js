// ==UserScript==
// @name       daft.ie hide
// @namespace  http://daft-hide.daav.ee/
// @version    1.0.3
// @description  hide properties on daft.ie
// @author     David Phillips
// @match      *://*.daft.ie/*
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

  onLoadPage();

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
    let resultsElement = document.querySelector('*[data-testid="results"]');
    if (resultsElement) {
      pageType = 'search';
    }
    if (document.querySelector('*[data-testid="header-image-component"]')) {
      pageType = 'single';
    }
    let mapSearchWrapper = document.querySelector('*[data-testid="mapsearch-wrapper"]');
    let mapSearchCarousel = document.querySelector('*[data-testid="mapsearch-carousel"]');
    let mapSearch = document.querySelector('#mapSearch');
    if (mapSearchWrapper) {
      pageType = 'map';
    }
    log(`pageType: ${pageType}`);

    if (pageType === 'search') {
      mutationObserver.observe(resultsElement, { childList:true, subtree:false });
      for (let box of resultsElement.children) {
        initializeBox(box);
      };
    }

    if (pageType === 'single') {
      updatePropertyPage();
    }

    if (pageType === 'map') {
      // After clicking a property on the map, then "Back", the wrapper loads before the carousel
      mutationObserver.observe(mapSearchWrapper, { childList: true, subtree: false });
      if (!elementExists({ mapSearchCarousel })) {
        return;
      }
      mutationObserver.observe(mapSearchCarousel, { childList: true, subtree: false });
      if (!elementExists({ mapSearch })) {
        return;
      }
      mutationObserver.observe(mapSearch, { childList: true, subtree: false });
      let mapPricesParent = mapSearch.children[0];
      if (!elementExists({ mapPricesParent })) {
        return;
      }
      mutationObserver.observe(mapPricesParent, { childList: true, subtree: false });
      let boxes = mapSearchCarousel.children;
      let mapPrices = mapPricesParent.children;
      console.log(`boxes ${boxes.length}, mapPrices ${mapPrices.length}`);
      for (let i = 0; i < boxes.length; i++) {
        let box = boxes[i];
        let data = initializeBox(box);
        let color = '';
        if (data && data.desc) {
          color = '#00a0f0';
        }
        if (data && !data.doShow) {
          color = 'grey';
        }
        mapPrices[i+1].children[0].style.backgroundColor = color;
      }

      let popupBox = mapSearch.querySelector('*[data-testid^="pop-up"]')
      if (popupBox) {
        initializeBox(popupBox, true);
      }
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
  function initializeBox(box, isMapPopup) {
    // Each box has an image (either to the left, or large image above)
    // then a line for the price, and a line for the address

    let exists = true;
    // address on search page, sub-line-2-info on map popup
    let titleBox = box.querySelector('*[data-testid="address"],*[data-testid="sub-line-2-info"]');
    exists = exists && elementExists({ titleBox });
    let urlBox = box.querySelector(':scope > a');
    exists = exists && elementExists({ urlBox });

    // price on search page, sub-title on map popup
    let priceBox = box.querySelector('*[data-testid="price"],*[data-testid="sub-title"]');
    exists = exists && elementExists({ priceBox });

    if (!exists) {
      return;
    }

    let floorAreaBox = box.querySelector('*[data-testid="floor-area"]');
    let floorArea = floorAreaBox?.textContent;
    let price = priceBox.textContent;
    let url = urlBox.getAttribute('href');

    initializeControls(url, titleBox, price, floorArea, box, isMapPopup);
    let house = houses[url];
    return house;
  }

  // Show stuff on property page.
  function updatePropertyPage() {
    let exists = true;
    let titleBox = document.querySelector('*[data-testid="address"],*[data-testid="alt-title"]')
    exists = exists && elementExists({ titleBox });

    let priceBox = document.querySelector('*[data-testid="price"]');
    exists = exists && elementExists({ priceBox });

    if (!exists) {
      return;
    }

    let floorAreaBox = document.querySelector('*[data-testid="floor-area"]');
    let floorArea = floorAreaBox?.textContent;
    let price = priceBox.textContent;
    let url = window.location.pathname;

    initializeControls(url, titleBox, price, floorArea, undefined);
  }

  // This will be used both in search results and property page
  function initializeControls(url, titleBox, priceText, floorAreaText, hideBox, isMapPopup) {
    // When filtering search results, initialize can run multiple times on the same property
    let alreadyInitialized = titleBox.parentElement.querySelector('.checkbox_ignore');
    if (alreadyInitialized) {
      return;
    }

    let house = houses[url];
    let desc = '';

    let checkedText = 'checked="true"';
    if (house) {
      desc = house.desc;
      if (!house.doShow) {
        showAndHide(hideBox, false);
        checkedText = '';
      }
    }

    if (isMapPopup) {
      // On map popup, wrap controls to new lines
      titleBox.parentElement.style.flexWrap = 'wrap';
      let urlBox = hideBox.querySelector(':scope > a');
      // Make the box wider, to fit the textbox
      urlBox.style.display = 'inline-flex';
      urlBox.style.backgroundColor = 'rgba(255,255,255,0.7)';
      urlBox.parentElement.parentElement.parentElement.style.backgroundColor = 'transparent';
    }
    let checkboxContainer = createElementFromHTML('<div class="checkbox-container"></div>');
    let descContainer = createElementFromHTML('<div class="desc-container"></div>');
    insertBefore(checkboxContainer, titleBox);
    insertAfter(descContainer, titleBox);
    let checkbox = createElementFromHTML('<input class="checkbox_ignore" type="checkbox" ' + checkedText + ' />');
    let descDiv = createElementFromHTML('<textarea class="desc" style="resize:none; width:400px">' + desc + '</textarea>');

    let price = toNumber(priceText);
    let floorArea = toNumber(floorAreaText);
    if (!isNaN(price) && !isNaN(floorArea)) {
      let pricePerFloorArea = Math.round(price/floorArea);
      priceText += `, €${pricePerFloorArea} per m²`;
    }

    checkboxContainer.appendChild(checkbox);
    if (!isMapPopup) {
      checkboxContainer.appendChild(createElementFromHTML('<span> ' + priceText + '</span>'));
    }
    checkbox.addEventListener('click', function() {
      submitChange(url, checkbox, descDiv, hideBox);
    });

    // When we click on checkbox or description box, don't follow the property link
    checkboxContainer.addEventListener('click', function(ev) {
      ev.stopPropagation();
    });
    descContainer.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
    });

    descContainer.appendChild(descDiv);
    auto_grow(descDiv);
    descDiv.addEventListener('input', function() {
      submitChange(url, checkbox, descDiv, hideBox);
      auto_grow(this);
    });
  }

  function auto_grow(element) {
    element.style.height = '5px';
    element.style.height = (element.scrollHeight)+'px';
  }

  function showAndHide(box, doShow) {
    if (!box) {
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
        let elements = box.querySelectorAll(selector);
        for (let element of elements) {
          element.style.display = '';
        }
      }
    } else {
      for (let selector of selectors) {
        let elements = box.querySelectorAll(selector);
        for (let element of elements) {
          element.style.display = 'none';
        }
      }
    }
  }

  function submitChange(url, checkbox, descDiv, box) {
    let doShow = checkbox.checked;
    let desc = descDiv.value;

    showAndHide(box, doShow);

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
    if (str) {
      for (let ch of str) {
        if (ch >= '0' && ch <= '9') {
          digits += ch;
        }
      }
    }

    return parseInt(digits);
  }

  // Get (and log) if the element exists
  // elementObject: { elementName: element }
  function elementExists(elementObject) {
    let elementName = Object.keys(elementObject)[0];
    let element = Object.values(elementObject)[0];
    let exists = Boolean(element);
    if (!exists) {
      logError(`Element ${elementName} does not exist`);
    }
    return exists;
  }

  // Create a DOM element from the given HTML string
  function createElementFromHTML(htmlString) {
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
  }

  function insertBefore(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode);
  }
  function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  }

  function log(msg) {
    console.log(`daft_hide: ${msg}`);
  }
  function logError(msg) {
    console.error(`daft_hide: ${msg}`);
  }
})();
