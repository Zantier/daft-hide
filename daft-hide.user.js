// ==UserScript==
// @name       daft.ie hide
// @namespace  http://daft-hide.daav.ee/
// @version    1.1.0
// @description  hide properties on daft.ie
// @author     David Phillips
// @match      *://*.daft.ie/*
// @grant      GM_getValue
// @grant      GM_setValue
// ==/UserScript==

/**
 * @typedef StoreData
 * @type {object}
 * @property {2} version - Whether the house is good or bad
 * @property {Object.<string, House>} urls - description of the house
 */

/**
 * @typedef House
 * @type {object}
 * @property {number} value - Whether the house is good or bad
 * @property {string} desc - description of the house
 */

(function() {
  'use strict';

  let housesStoreIndex = 'daft_hide';
  // Indexed by URL.
  /**
   * @type {Object.<string, House>}
   */
  let houses = {};
  let mutationObserver = new MutationObserver(function(changes) {
    onLoadPage();
  });

  onLoadPage();

  const styleTag = document.createElement('style');
  styleTag.textContent = `.thumbsup,.thumbsdown { text-shadow:0 0 0 #d0d0d0; }
    .value1>.thumbsup { text-shadow:0 0 0 #00ff00; }
    .value-1>.thumbsdown { text-shadow:0 0 0 #ff0000; }
    .map2 { background-color: #00a0f0d0; border-color: #00a0f0d0; }
    .map1 { background-color: #2180c4a0; border-color: #2180c4a0; }
    .map0 { background-color: #4170c480; border-color: #4170c480; }
    .map-1 { background-color: #a0a0a060; border-color: #a0a0a060; }
  `;
  document.head.appendChild(styleTag);
  console.log(document.head);

  function onLoadPage() {
    mutationObserver.disconnect();
    // When we click a property on a search page, or click back from a property page,
    // it performs a single mutation event on the react root element
    mutationObserver.observe(document.body, { childList:true, subtree:false });

    houses = getStoreData().urls;

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
      if (!resultsElement) throw Error('resultsElement cannot be null');
      mutationObserver.observe(resultsElement, { childList:true, subtree:false });
      for (let box of resultsElement.children) {
        initializeBox(box);
      };
    }

    if (pageType === 'single') {
      updatePropertyPage();
    }

    if (pageType === 'map') {
      if (!mapSearchWrapper) throw Error('mapSearchWrapper cannot be null');
      // After clicking a property on the map, then "Back", the wrapper loads before the carousel
      mutationObserver.observe(mapSearchWrapper, { childList: true, subtree: false });
      if (mapSearchCarousel) {

      }
      if (!mapSearchCarousel) {
        elementExists({ mapSearchCarousel })
        return;
      }
      mutationObserver.observe(mapSearchCarousel, { childList: true, subtree: false });
      if (!mapSearch) {
        elementExists({ mapSearch })
        return;
      }
      mutationObserver.observe(mapSearch, { childList: true, subtree: false });
      let mapPricesParent = mapSearch.children[0];
      if (!mapPricesParent) {
        elementExists({ mapPricesParent });
        return;
      }
      mutationObserver.observe(mapPricesParent, { childList: true, subtree: false });
      let boxes = mapSearchCarousel.children;
      let mapPrices = mapPricesParent.children;
      console.log(`boxes ${boxes.length}, mapPrices ${mapPrices.length}`);
      for (let i = 0; i < boxes.length; i++) {
        let box = boxes[i];
        let data = initializeBox(box);
        let value = 0;
        if (data) {
          value = data.value;
        }
        if (value === 1) {
          value = 2;
        }
        if (data && data.desc && value === 0) {
          value = 1;
        }
        setMapPriceStyle(mapPrices[i+1], value);
      }

      let popupBox = mapSearch.querySelector('*[data-testid^="pop-up"]')
      if (popupBox) {
        initializeBox(popupBox, true);
      }
    }
  }

  /**
   * @param {Element} mapPrice
   * @param {number} value
   */
  function setMapPriceStyle(mapPrice, value) {
    let child = mapPrice.children[0];
    // 1 has description, 2 has thumbs up
    child.classList.remove('map2', 'map1', 'map0', 'map-1');
    child.classList.add(`map${value}`);
  }

  /**
   * Get the list of URLs to ignore.
   * @returns {StoreData}
   */
  function getStoreData() {
    let catValues = GM_getValue(housesStoreIndex, '');
    if (!catValues) {
      return { version: 2, urls: {} };
    }

    let data = JSON.parse(catValues);
    let result = upgradeVersion2(data);
    console.log(result);
    return result;
  }

  /**
   * Initialize a box containing a house.
   * @param {Element} box
   * @param {boolean} isMapPopup
   * @returns {House | undefined}
   */
  function initializeBox(box, isMapPopup=false) {
    // Each box has an image (either to the left, or large image above)
    // then a line for the price, and a line for the address

    // address on search page, sub-line-2-info on map popup
    let titleBox = box.querySelector('*[data-testid="address"],*[data-testid="sub-line-2-info"]');
    elementExists({ titleBox });
    let urlBox = box.querySelector(':scope > a');
    elementExists({ urlBox });

    // price on search page, sub-title on map popup
    let priceBox = box.querySelector('*[data-testid="price"],*[data-testid="sub-title"]');
    elementExists({ priceBox });

    if (!titleBox || !urlBox || !priceBox) {
      return;
    }

    let floorAreaBox = box.querySelector('*[data-testid="floor-area"]');
    let floorArea = floorAreaBox?.textContent ?? '';
    let price = priceBox.textContent ?? '';
    let url = urlBox.getAttribute('href') ?? '';

    initializeControls(url, titleBox, price, floorArea, box, isMapPopup);
    let house = houses[url];
    return house;
  }

  // Show stuff on property page.
  function updatePropertyPage() {
    let titleBox = document.querySelector('*[data-testid="address"],*[data-testid="alt-title"]');
    elementExists({ titleBox });

    let priceBox = document.querySelector('*[data-testid="price"]');
    elementExists({ priceBox });

    if (!titleBox || !priceBox) {
      return;
    }

    let floorAreaBox = document.querySelector('*[data-testid="floor-area"]');
    let floorArea = floorAreaBox?.textContent ?? '';
    let price = priceBox.textContent ?? '';
    let url = window.location.pathname;

    initializeControls(url, titleBox, price, floorArea, undefined);
  }

  /**
   * This will be used both in search results and property page
   * @param {string} url
   * @param {Element} titleBox
   * @param {string} priceText
   * @param {string} floorAreaText
   * @param {Element | undefined} hideBox
   * @param {boolean} isMapPopup
   * @returns
   */
  function initializeControls(url, titleBox, priceText, floorAreaText, hideBox, isMapPopup=false) {
    let titleParent = assertParent(titleBox);
    // When filtering search results, initialize can run multiple times on the same property
    let alreadyInitialized = titleParent.querySelector('.checkbox-container');
    if (alreadyInitialized) {
      return;
    }

    let house = houses[url];
    let desc = '';

    let checkedText = 'checked="true"';
    if (house) {
      desc = house.desc;
      if (house.value === -1) {
        showAndHide(hideBox, false);
        checkedText = '';
      }
    }

    if (isMapPopup && hideBox) {
      // On map popup, wrap controls to new lines
      titleParent.style.flexWrap = 'wrap';
      /** @type {HTMLElement | null} */
      let urlBox = hideBox.querySelector(':scope > a');
      if (urlBox) {
        // Make the box wider, to fit the textbox
        urlBox.style.display = 'inline-flex';
        urlBox.style.backgroundColor = 'rgba(255,255,255,0.7)';
        assertParent(assertParent(assertParent(urlBox))).style.backgroundColor = 'transparent';
      }
    }
    let thumbContainer = /** @type {HTMLDivElement} */ (createElementFromHTML('<div class="checkbox-container"></div>'));
    if (house) {
      setThumbValue(thumbContainer, house.value);
    }
    let descContainer = /** @type {ChildNode} */ (createElementFromHTML('<div class="desc-container"></div>'));
    insertBefore(thumbContainer, titleBox);
    insertAfter(descContainer, titleBox);
    let thumbsup = /** @type {HTMLDivElement} */ (createElementFromHTML('<div class="thumbsup" style="display:inline-block; color:transparent; cursor:pointer;">👍</div>'));
    let thumbsdown = /** @type {HTMLDivElement} */ (createElementFromHTML('<div class="thumbsdown" style="display:inline-block; color:transparent; cursor:pointer;">👎</div>'));
    let descDiv = /** @type {HTMLTextAreaElement} */ (createElementFromHTML('<textarea class="desc" style="resize:none; width:400px">' + desc + '</textarea>'));

    let price = toNumber(priceText);
    let floorArea = toNumber(floorAreaText);
    if (!isNaN(price) && !isNaN(floorArea)) {
      let pricePerFloorArea = Math.round(price/floorArea);
      priceText += `, €${pricePerFloorArea} per m²`;
    }

    thumbContainer.appendChild(thumbsup);
    thumbContainer.appendChild(thumbsdown);
    if (!isMapPopup) {
      thumbContainer.appendChild(createElementFromHTML('<span> ' + priceText + '</span>'));
    }

    thumbsup.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();

      let value = getThumbValue(thumbContainer);
      if (value === 1) {
        value = 0;
      } else {
        value = 1;
      }
      setThumbValue(thumbContainer, value);
      submitChange(url, thumbContainer, descDiv, hideBox);
    });
    thumbsdown.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();

      let value = getThumbValue(thumbContainer);
      if (value === -1) {
        value = 0;
      } else {
        value = -1;
      }
      setThumbValue(thumbContainer, value);
      submitChange(url, thumbContainer, descDiv, hideBox);
    });

    // When we click on thumbs or description box, don't follow the property link
    descContainer.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
    });

    descContainer.appendChild(descDiv);
    auto_grow(descDiv);
    descDiv.addEventListener('input', function() {
      submitChange(url, thumbContainer, descDiv, hideBox);
      auto_grow(this);
    });
  }

  /**
   * @param {HTMLElement} element
   */
  function auto_grow(element) {
    element.style.height = '5px';
    element.style.height = (element.scrollHeight)+'px';
  }

  /**
   *
   * @param {Element | undefined} box
   * @param {boolean} doShow
   * @returns
   */
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
          /** @type {HTMLElement} */
          (element).style.display = '';
        }
      }
    } else {
      for (let selector of selectors) {
        let elements = box.querySelectorAll(selector);
        for (let element of elements) {
          /** @type {HTMLElement} */
          (element).style.display = 'none';
        }
      }
    }
  }

  /**
   * @param {string} url
   * @param {HTMLDivElement} thumbContainer
   * @param {HTMLTextAreaElement} descElement
   * @param {Element | undefined} box
   */
  function submitChange(url, thumbContainer, descElement, box) {
    let value = getThumbValue(thumbContainer);
    let desc = descElement.value;

    showAndHide(box, value !== -1);

    let inList = value !== 0 || desc;

    if (inList) {
      houses[url] = {
        value: value,
        desc: desc,
      };
    } else {
      delete houses[url];
    }

    /** @type {StoreData} */
    let data = {
      version: 2,
      urls: houses,
    };
    GM_setValue(housesStoreIndex, JSON.stringify(data));
  }

  /**
   * Convert string to number, stripping out any non-digit characters. If there are no
   * digits, return NaN.
   * @param {string} str
   */
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

  /**
   * Get (and log) if the element exists
   * elementObject: { elementName: element }
   * @param {Object.<string, Element?>} elementObject
   * @returns
   */
  function elementExists(elementObject) {
    let elementName = Object.keys(elementObject)[0];
    let element = Object.values(elementObject)[0];
    let exists = Boolean(element);
    if (!exists) {
      logError(`Element ${elementName} does not exist`);
    }
    return exists;
  }

  /**
   * Create a DOM element from the given HTML string
   * @param {string} htmlString
   */
  function createElementFromHTML(htmlString) {
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return /** @type {ChildNode} */ (div.firstChild);
  }

  /**
   * @param {Node} newNode
   * @param {Node} referenceNode
   */
  function insertBefore(newNode, referenceNode) {
    if (referenceNode.parentNode) {
      referenceNode.parentNode.insertBefore(newNode, referenceNode);
    }
  }
  /**
   * @param {Node} newNode
   * @param {Node} referenceNode
   */
  function insertAfter(newNode, referenceNode) {
    if (referenceNode.parentNode) {
      referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    }
  }

  /**
   * @param {string} msg
   */
  function log(msg) {
    console.log(`daft_hide: ${msg}`);
  }
  /**
   * @param {string} msg
   */
  function logError(msg) {
    console.error(`daft_hide: ${msg}`);
  }

  /**
   * @param {*} oldData
   * @returns {StoreData}
   */
  function upgradeVersion2(oldData) {
    if ('version' in oldData) {
      return oldData;
    }

    /** @type {StoreData} */
    let newData = {
      version: 2,
      urls: {},
    };

    for (let url of Object.keys(oldData)) {
      newData.urls[url] = {
        value: oldData[url].doShow ? 1 : -1,
        desc: oldData[url].desc,
      };
    }

    return newData;
  }

  /**
   * Get parent element, asserting that it exists
   * @param {Element} element
   * @returns {HTMLElement}
   */
  function assertParent(element) {
    if (!element.parentElement) {
      throw Error('Failed to get parent element');
    }

    return element.parentElement;
  }

  /**
   * @param {HTMLDivElement} thumbContainer
   */
  function getThumbValue(thumbContainer) {
    if (thumbContainer.classList.contains('value1')) {
      return 1;
    }
    if (thumbContainer.classList.contains('value-1')) {
      return -1;
    }
    return 0;
  }

  /**
   * @param {HTMLDivElement} thumbContainer
   * @param {number} value
   */
  function setThumbValue(thumbContainer, value) {
    thumbContainer.classList.remove('value1', 'value0', 'value-1');
    thumbContainer.classList.add(`value${value}`);
  }
})();
