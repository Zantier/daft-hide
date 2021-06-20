// ==UserScript==
// @name       daft.ie hide
// @namespace  http://daft-hide.daav.ee/
// @version    0.5
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
    var $box = $(ele);
    var $titleBox = $box.find('> .search_result_title_box');
    var $urlBox = $titleBox.find('> h2 > a');

    var price = $box.find('.info-box > *:first-child').text();
    var url = $urlBox.attr('href');

    initializeControls(url, $titleBox, price, $box);
  }

  // Show stuff on property page.
  function updatePropertyPage() {
    var $box = $('#address_box')
    if ($box.length == 0) {
      return;
    }

    var $titleBox = $box.find('h1');
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
    var $descDiv = $('<textarea class="desc" style="resize:none; width:550px">' + desc + '</textarea>');

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
      $box.find('> .image').show();
      $box.find('> .text-block').show();
    } else {
      $box.find('> .image').hide();
      $box.find('> .text-block').hide();
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
    return $('.box').not('.clear');
    // .filter(function(i, ele) {
      // return ele.children[0].nodeName == 'H2';
    // });
  }
})();
