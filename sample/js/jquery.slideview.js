(function() {
  
  var pluginName = "slideview";
  
  var defaults = {
    
    contentSelector: '> .slideview-content',
    scrollStyle: 'position', 
    
    transition: {
      type: 'swipe', 
      duration: 500, 
      easing: 'swing'
    },
    
    mouseDragging: true, 
    transitionInterruptable: false, 
    userInteraction: true, 
    endless: false, 
    maxTouchTime: 250,
    
    // playback
    autoStart: false, 
    showDuration: 4000, 
    
    // load management
    slideSelector: '.slide', 
    
    offset: 0, 
    limit: 2, 
    
    // callbacks
    slideLoaded: null, 
    slideBefore: null, 
    slideComplete: null, 
    slide: null,
    
    preloadImages: true,

    nextButton: '.slideview-next',
    prevButton: '.slideview-prev',
    buttonDisabledClass: 'slideview-button-disabled',
    
    pagination: '.slideview-pagination',
    paginationActiveClass: 'slideview-pagination-active',
    paginationItem: function(index) {
      return $('<a class="slideview-pagination-item"></a>');
    }
  };
  
  
  var isTouch = 'ontouchstart' in window;
  
  
  // unsigned mod result
  function amod(x, m) {
    var r = x % m;
    r = r < 0 ? r + m : r;
    return r;
  } 
    
  // decodes html entities
  function decodeEntities(input) {
    var y = document.createElement('textarea');
    y.innerHTML = input;
    return y.value;
  }

  /**
   * Compare two arrays if they are equal even if they have different order.
   *
   * @link http://stackoverflow.com/a/7726509
   */
  function arrayCompare(a, b) {
    return $(a).not(b).get().length === 0 && $(b).not(a).get().length === 0;
  }
    
  /* Image Loading */
  
  // detects if an image has been loaded
  function isImageComplete(img, dataSourceAttribute) {

    var dataSourceAttribute = dataSourceAttribute || 'source';
    
    if (!img) return true;

    var src = img.getAttribute('src');

    if (src) {
      
      if (typeof(img.complete) != "undefined") {
        return img.complete === true;
      } else if (img.naturalHeight && img.naturalWidth) {
          return true;
      }
      return false;
    
    } else if (dataSourceAttribute && $(img).data(dataSourceAttribute)) {
      return false;
    }
      
    return true;

  }
  
  
  // detects if all child images have been loaded
  function isAllImageComplete(element) {
    var result = true;
    $('img', element).each(function(index, object) {
      if (result && !isImageComplete(this)) {
        result = false;
      }
    });
    return result;
  }
  
  
  // detects if element is in browser viewport
  function inViewport (element) {

    var $element = $(element);
    var $win = $(window); 
 
    var viewport = {
        top : $win.scrollTop(),
        left : $win.scrollLeft()
    };
    viewport.right = viewport.left + $win.width();
    viewport.bottom = viewport.top + $win.height();
     
    var bounds = $element.offset();
    bounds.right = bounds.left + $element.outerWidth();
    bounds.bottom = bounds.top + $element.outerHeight();
    
    return bounds.left >= viewport.left && bounds.right <= viewport.right;
    
  }
 
  var getVendorStyle = (function() {
    var cache = {};
    return function (styleName) {
      if (typeof cache[styleName] != 'undefined') return cache[styleName];
      var result = null, vendorPrefixes = ['Webkit', 'Moz', 'O', 'Ms'], elem = document.createElement('div');
      document.documentElement.appendChild(elem);
      if (typeof (elem.style[styleName]) == 'string') result = styleName;
      if (!result) {
        var capitalized = styleName.substring(0, 1).toUpperCase() + styleName.substring(1);
        for (var i = 0; i < vendorPrefixes.length; i++) {
          var prop = vendorPrefixes[i] + capitalized;
          if (typeof elem.style[prop] == 'string') {
            result = prop;
            break;
          }
        }
      }
      cache[styleName] = result;
      elem.parentNode.removeChild(elem);
      return result;
    };
  })();
 
  // get translate values. for relative values, bounds can be specified
  function getTranslate(string, width, height, depth) {
    var x = y = z = 0; 
    var match = string.match(/^translate(?:3d)?\(([-\d]*)([a-z%]*)?,([-\d]*)([a-z%]*)?(?:,\s*([-\d]*)([a-z%]*)?)?\)/);
    if (match) {
      var xv = match[1], xu = match[2], yv = match[3], yu = match[4], zv = match[5], zu = match[6];
      x = xu == "%" ? xv / 100 * width : parseFloat(xv);
      y = yu == "%" ? yv / 100 * height : parseFloat(yv);
      z = zu == "%" ? zv / 100 * depth : parseFloat(zv);
    }
    return {
      x: x, 
      y: y, 
      z: z
    };
  }
  
  // parse the transform matrix
  function getTransformMatrix(string) {
    var result = { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
    var p = ['a', 'b', 'c', 'd', 'x', 'y'];
    if (typeof string == "string") {
      var match = string.match(/^matrix\(\s*(-?\d*),?\s*(-?\d*),?\s*(-?\d*),?\s*(-?\d*),?\s*(-?[\d\.]*)(?:px)?,?\s*(-?[\d\.]*)(?:px)?/);
      if (match) for (var i = 0; i < p.length; i++) result[p[i]] = parseInt(match[i + 1]);
    }
    return result;
  }
    
  // detects the element's position
  function getElementPosition(elem, style) {

    var $elem = $(elem), x = 0, y = 0;
    
    switch (style) {
      
      case 'position':

        x = parseFloat($elem.css('left'));
        y = parseFloat($elem.css('top'));
        
        break;

      case 'transform': 
      case 'transform3d': 

        var transformStyle = getVendorStyle('transform');
        var styleValue = $elem.css(transformStyle);
        var matrix = getTransformMatrix(styleValue);
        if (matrix) {
          x = matrix.x; 
          y = matrix.y;
        }
        
        break;
        
    }
    
    x = !isNaN(x) ? x : 0;
    y = !isNaN(y) ? y : 0;
      
    return {x: x, y: y};
  }
    
  // sets the elements position using the specified style
  function setElementPosition(elem, left, top, style) {
    
    switch (style) {
      
      case 'position': 
        
        elem.style.left = left;
        elem.style.top = top;
        
        break;
        
      case 'transform': 
      case 'transform3d': 
        
        var transformStyle = getVendorStyle('transform');
        var translateMethod = style == 'transform3d' ? 'translate3d' : 'translate';
        var styleValue = translateMethod + "(" + left + ", " + top + ")";
        var styleValue;
        if (style == 'transform3d') {
           styleValue = "translate3d(" + left + ", " + top + ",0)";
        } else {
           styleValue = "translate(" + left + ", " + top + ")";
        }
        
        elem.style[transformStyle] = styleValue;
        break; 
    }

  }
 
  
  
  /* SlideView Plugin */
 
  // keep track of all instances to find content over the document
  var slideViews = []; 
  
  var pluginClass = function SlideView(element, options) {
    
    
    // private local variables
    
    var slideView = this;
    var $element = $(element);
    
    var container = null;
    var $container = null;
 
    var invalidateFlag = true;
    
    var items = [];
    
    var scrollPosition = null;

    var currentTransition = null;
    var currentTransitions = {};
    
    var lastItem = null;
    var currentItem = null;
    
    var currentSlide = null;
    var queuedSlide = null;
    
    var _layoutItems = null;
    var _items = null;
    
    var animatePlugin = "animate";
    
    var _currentItem = 0;
    
    var slideIndex = 0;
    
    // local methods
    
    var optionsCache = {};
    var paginationItems = [];
    
    function updateControls() {
      var nextButton = getOptionElement('nextButton');
      var prevButton = getOptionElement('prevButton');
      var pagination = getOptionElement('pagination');
      var slideIndex = this.getSlideIndex();
      var size = this.size();
      if (nextButton) {
        var $nextButton = $(nextButton);
        if (slideIndex === size - 1) {
          $nextButton.addClass(options.buttonDisabledClass);
        } else {
          $nextButton.removeClass(options.buttonDisabledClass);
        }
      }
      if (prevButton) {
        var $prevButton = $(prevButton);
        if (slideIndex === 0 && !options.endless) {
          $prevButton.addClass(options.buttonDisabledClass);
        } else {
          $prevButton.removeClass(options.buttonDisabledClass);
        }
      }
      if (pagination) {
        var $pagination = $(pagination);
        if (paginationItems.length !== this.size()) {
          $(paginationItems).remove();
          paginationItems = (Array.apply(null, {length: this.size()}).map(Number.call, Number)).map(options.paginationItem);
          $pagination.append(paginationItems);
        }
        $(paginationItems).each(function(index) {
          if (index === slideIndex) {
            $(this).addClass(options.paginationActiveClass);
          } else {
            $(this).removeClass(options.paginationActiveClass);
          }
        });
      }
    }
    
    function updateOptions() {
      updateControls.call(this);
    }
    
    function getOptionElement(name) {
      var value = options[name]; 
      var control = value ? $(value)[0] : null;
      var cached = optionsCache[name];
      if (cached && (cached.value !== control || cached.option !== value)) {
        if (cached.parentNode) {
          cached.parentNode.removeChild(cached);
        }
        delete optionsCache[name];
      } else if (cached) {
        control = cached.value;
      }
      if (!$element.has(control).length === 0) {
        $element.append(control);
      }
      optionsCache[name] = {value: control, option: value};
      return control;
    }
    
    
    // TODO: Make container dynamic option
    function getContainer() {
      return $(options.contentSelector)[0];
    }
    
    // collection view implementation
    
    // detects if the specified element is a valid item
    function isItem(elem) {
      return elem.nodeType == 1
        && $.inArray(elem.localName.toLowerCase(), ["br", "script", "link", "map"]) == -1;
    }
    
    // returns the item's index
    this.indexOf = function(item) {
      for (var i = 0; i < items.length; i++) if (items[i] == item) return i;
    };
    
    this.get = function(index) {
      return items[index];
    };
    
    this.size = function() {
      return items.length;
    };
    
    this.add = function(item, index) {
      item = item instanceof jQuery ? item.get(0) : item;
      if (typeof index === 'number') {
        items.splice(index, 0, item);
      } else {
        items.push(item);
      }
      this.invalidate();
      itemsChanged.call(this);
    };
    
    this.remove = function(item) {
      items.splice(this.indexOf(item), 1);
      this.invalidate();
      itemsChanged.call(this);
    };
    
    this.removeAll = function() {
      for (var i = 0; i < this.size(); i++) {
        invalidateFlag = false;
        this.remove(this.get(i));
        invalidateFlag = true;
        i--;
      }
      this.invalidate();
    };
    
    this.addAll = function(collection, index) {
      index = typeof index == 'number' ? index : this.size();
      for (var i = 0; i < collection.length; i++) {
        invalidateFlag = false;
        this.add(collection[i], index + i);
        invalidateFlag = true;
      }
      this.invalidate();
    };
    
    this.replaceAll = function(collection) {
      invalidateFlag = false;
      for (var i = 0; i < this.size(); i++) {
        this.remove(this.get(i));
        i--;
      }
      invalidateFlag = true;
      this.addAll(collection);
      this.invalidate();
    };
    
    this.invalidate = function() {
      if (!invalidateFlag) return;
      layout.call(this);
      var lItems = getLayoutItems();
      if (lItems != items) {
        // TODO: irregular layout
      } else {
       var s = getScrollPosition();
       var scrollIndex = getScrollPosition().x / element.clientWidth;
       var item = getItemAtScrollPosition(s.x, s.y);
       var itemIndex = this.indexOf(item);
       var itemDiff = itemIndex - scrollIndex;
       if (itemDiff != 0) {
         setScrollPosition((scrollIndex + itemDiff) * element.clientWidth, s.y);
         layoutItems.call(this);
       }
      }
    };
    
    this.setOptions = function(opts) {
      if (opts.items) {
        this.replaceAll(opts.items);
      }
      options = $.extend(options, opts);
      this.invalidate();
    };
    
    this.getOptions = function() {
      return options;
    };
    
    function getOption(name) {
      return $(element).data(name) || options[name];
    }

    function getItemAtScrollPosition(x, y) {
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var p = getElementPosition(item, options.scrollStyle);
        if ($(item).is(":visible") && p.x >= x && p.x < x + element.clientWidth) {
          return item;
        }
      }
      return null;
    }

    function invalidateScrollPosition() {
      scrollPosition = null;
    }
    
    function getScrollPosition() {
      // if (!scrollPosition) {
        // compute scroll position
        var s = getElementPosition(container, options.scrollStyle);
        scrollPosition = {
          x: -s.x, y: -s.y
        };
      // }
      return scrollPosition;
    }

    var scrollDirection = 0;

    function setScrollPosition(x, y, duration) {
      
      var transitionOptions = options.transition;
      
      duration = typeof duration == "number" ? duration : typeof duration == "boolean" ? duration ? transitionOptions.duration : 0 : 0;
      
      var s = getScrollPosition();

      x = typeof x == "number" && !isNaN(x) ? x : 0;
      y = typeof y == "number" && !isNaN(y) ? y : 0;
      
      if (!options.endless) {
        if (x < 0) {
          x = 0;
        } else if (x > (slideView.size() - 1) * element.clientWidth) {
          x = (slideView.size() - 1) * element.clientWidth;
        }
      }
      
      scrollDirection = s.x > x ? -1 : s.x < x ? 1 : 0;

      var xp = -x / element.clientWidth * 100;
      var yp = -y / element.clientHeight * 100;
 
      if ($container.is(":animated")) {
        // TODO: do nothing if a transition to this position is already running
        $container.stop();
      }

      if (duration == 0 || s.x == x && s.y == y) {
        
        // no transition
        if (s.x != x || s.y != y) {
          setElementPosition(container, xp + "%", yp + "%", options.scrollStyle);
          scrollPosition = {x: x, y: y};
        }
        
        if (s.x != x || s.y == y) {
          // Scroll Position has changed
          scrollComplete();
        }
        
      } else {
        
        // transition
        
        
        var properties = {};
        switch (options.scrollStyle) {
          
          case 'position': 
            properties = {
              left: xp + "%", 
              top: yp + "%"
            };
            break;
            
          case 'transform':
          case 'transform3d': 
          
            var transformStyle = getVendorStyle('transform');
            var transformValue = "translate(" + xp + "%" + "," + yp + "%)";
            if (options.scrollStyle == "transform3d") {
              transformValue = "translate3d(" + xp + "%" + "," + yp + "%,0)";
            }
            properties[transformStyle] = transformValue; 
        }
        
        animateScroll(properties, options.transition);
        scrollPosition = {x: x, y: y};
        layoutItems();
        
      }
      
      
    }
    
    
    function animateScroll(properties, opts) {

      var animationOptions = {};
      $.extend(animationOptions, opts, {
        complete: function() {
          if (opts.complete) opts.complete.apply(this, arguments);
          scrollComplete();
        }
      });
      
      animationOptions.queue = false;
      $container[animatePlugin](properties, animationOptions);
    }
    
    function getCurrentItem() {
      invalidateScrollPosition();
      var s = getScrollPosition();
      var elem = getItemAtScrollPosition(s.x, s.y);
      return elem;
    }
    
    function getCurrentIndex() {
      return slideView.indexOf(getCurrentItem());
    }
    
    function getVisibleItems(scrollPosition) {
      var s = typeof scrollPosition == 'number' ? scrollPosition : getScrollPosition();
      var vItems = [];
      var currentItem = null;
      for (var i = 0; i < items.length; i++) {
        var elem = items[i];
        var p = getElementPosition(elem, options.scrollStyle);
        if (elem.style.display != 'none' && p.x > s.x - element.clientWidth && p.x < s.x + element.clientWidth) {
          vItems.push({item: elem, scrollIndex: p.x / element.clientWidth});
        }
      }
      return vItems;
    }
    
    function swipeTo(item, transitionOptions) {
      
      var duration  = transitionOptions.duration;
      var direction = transitionOptions.direction;
      
      if (duration === 0) {
        setScrollPosition(slideView.indexOf(item) * element.clientWidth, 0, duration);
        return;
      }

      var items = getLayoutItems();
      
      var s = getScrollPosition();
      var p = getElementPosition(item, options.scrollStyle);
      
      var currentPage = Math.floor(s.x / element.clientWidth);
      
      var currentItem = getCurrentItem();
      var currentIndex = $.inArray(currentItem, items);
      
      var itemIndex = slideView.indexOf(item);
      
      // TODO: duration = 0
      // get view items 

      var vItems = getVisibleItems(s);
      if (vItems.length == 0) {
        invalidateLayoutItems();
        layoutItems();
        vItems = getVisibleItems(s);
        if (vItems.length == 0) {
          // error: at this point the view must have visible items
          return;
        }
      }

      var vMinScrollIndex = vItems[0].scrollIndex;
      var vMaxScrollIndex = vItems[vItems.length - 1].scrollIndex;
      
      // invisible views should scroll instantly
      duration = !inViewport(element) ? 0 : duration;
      direction = typeof direction == "number" ? direction : itemIndex < currentIndex ? -1 : itemIndex > currentIndex ? 1 : 0;
      
      // check for direct neighbors
      
      var currentNextIndex = (currentIndex + 1) % items.length;
      currentNextIndex = currentNextIndex < 0 ? currentNextIndex + items.length : currentNextIndex;
      var currentNextItem = items[currentNextIndex];
      
      var currentPrevIndex = (currentIndex - 1) % items.length;
      currentPrevIndex = currentPrevIndex < 0 ? currentPrevIndex + items.length : currentPrevIndex;
      var currentPrevItem = items[currentPrevIndex];
      
      var scrollOffset = s.x / element.clientWidth - currentPage;
       
      if (direction > 0 && currentNextItem == item) {
        setScrollPosition((currentPage + 1) * element.clientWidth, 0, duration);
        return;
      } else if (direction < 0 && currentPrevItem == item) {
        setScrollPosition((currentPage - 1) * element.clientWidth, 0, duration);
        return;
      }
     

      var lItems = [];
      var mItems = items.slice();
      
      if (direction == 0) {
         return;
      }
      
      if (direction > 0) {
        
        // forward

        for (var i = vMinScrollIndex; i <= vMinScrollIndex + items.length; i++) {

          var m = i % items.length;
          m = m < 0 ? m + items.length : m;
          elem = items[m];

          if (i > vMaxScrollIndex && i <= vMaxScrollIndex + 2) {

            var me = (itemIndex + i - vMaxScrollIndex - 1) % items.length;
            me = me < 0 ? me + items.length : me;
            elem = slideView.get(me);
            
          }
          
          while ($.inArray(elem, lItems) >= 0 && mItems.length > 0) {
            elem = mItems.shift();
          }
          if (lItems.indexOf(elem) === -1) {
            lItems[m] = elem;
          }
        }
 
      } else if (direction < 0) {
        
        // backward
        
        for (var i = currentPage; i > currentPage - items.length; i--) {

          var m = i % items.length;
          m = m < 0 ? m + items.length : m;
          elem = items[m];
            
          if (i < currentPage && i >= currentPage - 2) {
            
            mItems.push(elem);
            var me = (itemIndex + i - currentPage + 1) % items.length;
            var me = me < 0 ? me + items.length : me;
            elem = slideView.get(me);
            
          }
          while ($.inArray(elem, lItems) >= 0 && mItems.length > 0) {
            elem = mItems.shift();
          }
          if (lItems.indexOf(elem) === -1) {
            lItems[m] = elem;
          }
        }
        
      }
      
      setLayoutItems(lItems);
      
      setScrollPosition((currentPage + direction) * element.clientWidth, 0, duration);
     
    }
    
    
    function slideTo(item, transition) {
      
      var slideItem = slideView.get(slideIndex);
      
      if (slideItem === item) {
        //console.log("same item do nothing");
        return;
      }
      
      // reset playback timer
      window.clearTimeout(playTimeoutID);
      
      // merge options
      var opts = {};
      $.extend(opts, options.transition, transition);
      
      // callback
      slideBefore.call(this, item);
      
      // Update slideindex
      
      slideIndex = slideView.indexOf(item);
      
      slide.call(this, item);
      
      // perform slide
      switch (opts.type) {

        case 'fade': 
          fadeTo.call(this, item, opts);
          break;
          
        case 'swipe': 
          swipeTo.call(this, item, opts);
          break;
        
        case 'scroll': 
          scrollTo.call(this, item, opts);
          break;
          
        case 'none': 
        default:
          // TODO: none
          //slideComplete.call(this);
      }
      
            
    }
    

    function validateLayoutItems() {
      
      if (!_layoutItems) return;
      
      var s = getScrollPosition();
      var hasValidOrder = true;
      var items = getLayoutItems(); 
      var vItems = [];
      var vIndex = null;
        for (var i = 0; i < items.length; i++) {
          var elem = items[i];
          var p = getElementPosition(elem, options.scrollStyle);
          if ($(elem).is(":visible") && p.x > s.x - element.clientWidth && p.x < s.x + element.clientWidth) {
            var eIndex = amod(slideView.indexOf(elem), items.length);
            if (vIndex == null) {
            vIndex = eIndex;
            } else {
              vIndex = amod(vIndex++, items.length);
              if (vIndex == eIndex) {
                //hasValidOrder = true;
              } else {
                hasValidOrder = false;
                break;
              }
            }
          }
        }
        
        if (hasValidOrder) {
          
          // order is valid
          var scrollIndex = Math.floor(s.x / element.clientWidth);
          var offset = s.x / element.clientWidth - scrollIndex;
          
          var elem = getItemAtScrollPosition(s.x, 0);
          var itemIndex = slideView.indexOf(elem);
          var x = (itemIndex + offset) * element.clientWidth;
          
          //if (scrollIndex != itemIndex) {
            invalidateLayoutItems();
            setScrollPosition(x, 0, 0);
            
            //layoutItems();
          //}
          
          return true;
      
        } else {
          // order is invalid
          return false;
        }
    }
    
    function invalidateLayoutItems() {
      _layoutItems = null;
    }
    
    function setLayoutItems(items) {
      _layoutItems = items;
    }
    
    function getLayoutItems() {
      if (!_layoutItems) {
        return items;
      }
      return _layoutItems;
    }
    
    function layoutItems() {

      invalidateScrollPosition();
      
      var s = getScrollPosition();
      
      var scrollIndex = Math.floor(s.x / element.clientWidth);
      var scrollOffset = s.x / element.clientWidth - scrollIndex;
 
      var lItems = getLayoutItems();

      // maximum number of displayed items is 3
      var minScrollIndex = scrollIndex - 1;
      var maxScrollIndex = scrollIndex + 1;
     
      if (lItems.length == 1) {
        minScrollIndex = scrollIndex;
        maxScrollIndex = scrollIndex;
      } else if (lItems.length == 2) {
        var sd = scrollOffset != 0 ? scrollOffset : scrollDirection;
        minScrollIndex = sd < 0 ? scrollIndex - 1 : scrollIndex;
        maxScrollIndex = sd < 0 ? scrollIndex : scrollIndex + 1;
      } else {
        minScrollIndex = scrollIndex - 1;
        maxScrollIndex = scrollIndex + 1;
      }
        
      for (var x = minScrollIndex; x < minScrollIndex + lItems.length; x++) {

        var m = x % slideView.size();
        m = m < 0 ? m + slideView.size() : m;
        
        var item = lItems[m];
        var $item = $(item);
        
        var y = 0;
        
        if (x >= minScrollIndex && x <= maxScrollIndex) {
            
            if (item.parentNode != container) {
              container.appendChild(item);
            }
            
            $item.css({
              position: 'absolute', 
              width: '100%'
            });
            
            item.style.display = "";
            
            var p = getElementPosition(item, options.scrollStyle);
            
            setElementPosition(item, x * 100 + "%", y + "px", options.scrollStyle);
            
            // load slide
            if (!isSlideLoaded(item)) {
              loadSlide(item);
            }
          
        } else {
          
          // hide
          $item.css('display', 'none');
        }
        
        // TODO: option resetScroll
        // if item is currently not visible reset content scroll
        var isVisibleAtScrollPosition = x + element.clientWidth > s.x && x < s.x + element.clientWidth;
        isVisibleAtScrollPosition = x + 1 > s.x / element.clientWidth && x < s.x / element.clientWidth + 1;
        
        if (!isVisibleAtScrollPosition) {
          item.scrollTop = 0;
          // TODO: reset content scroll on nested slideviews
        }
        
      }
      
    
    }
  
    // CSS LAYOUT
    function layout() {
      
      var elemCSS = {
        overflow: 'hidden'
      };
      
      //elemCSS[getVendorStyle('userSelect')] = "none";
      
      $element.css(elemCSS);
      
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var itemCSS = {
          width: '100%',
          height: '100%', 
          overflow: 'auto', 
          WebkitOverflowScrolling: 'touch'
        };
        //itemCSS[getVendorStyle('userSelect')] = "none";
        $(item).css(itemCSS);
      }
    }
    
    // internal callbacks
    
    function transitionStart(type, inItem, outItem) {
      currentTransitions[type] = {
        inItem: inItem, 
        outItem: outItem
      };
    }
    
    function transitionEnd(type) {
      var f = currentTransitions[type];
      var i = slideView.indexOf(f.inItem);
      delete currentTransitions[type];
      validateLayoutItems.call(slideView);
      setScrollPosition(i * element.clientWidth, 0, 0);
      // layoutItems.call(this);
    }
    
    function scrollComplete() {
      if (typeof options.scrollComplete == 'function') {
        options.scrollComplete.call(slideView);
      }
      
      scrollDirection = 0;
      validateLayoutItems();
      var s = getScrollPosition();
      
      if (s.x % element.clientWidth == 0) {
        layoutItems.call(this);
        var currentItem = getCurrentItem();
        slideComplete();
      }
      
    }
    
    
    // Callbacks
    var slideCallback = false;
    
    function itemsChanged() {
      updateControls.call(this);
    }
    
    
    function slide(item) {
      slideCallback = true;
      updateControls.call(slideView);
      if (typeof options.slide == "function") {
        options.slide.call(slideView, item);
      }
    }
    
    function slideBefore(item) {
      if (slideCallback && typeof options.slideBefore == "function") {
        options.slideBefore.call(slideView, item);
      }
    }
   
    function slideComplete() {
      
      var currentItem = getCurrentItem();
      _currentItem = currentItem;
       
      // playback
      if (slideView.isPlaying()) {
        window.clearTimeout(playTimeoutID);
        playTimeoutID = window.setTimeout(function() {
          slideView.next();
        }, options.showDuration);
      }
      
      // TODO: location control
      // TODO: navigation links
      if (currentSlide != currentItem) {
        
        currentSlide = currentItem;
        

        // callback
        if (slideCallback && typeof options.slideComplete == "function") {
          options.slideComplete.call(slideView, currentItem);
        }
      
        if (queuedSlide && queuedSlide.item != currentItem) {
            
          var item = queuedSlide.item, transition = queuedSlide.transition;
          queuedSlide = null;
          slideTo(item, transition);
          
        } else {
          
          queuedSlide = null;
          
        }
      }
    }

    // public methods
    
    this.getCurrentIndex = function() {
      return getCurrentIndex();
    };
    
    this.getCurrentItem = function() {
      return getCurrentItem();
    };
    
    this.getSlideIndex = function() {
      return slideIndex;
    };
    
    this.slideTo = function(item, transition) {
      
      if (typeof item == "number") {
        var index = item;
        if (options.endless) {
          index = amod(item, slideView.size());
        }
        item = slideView.get(index);
      }

      if (!item) return;

      if ($container.is(':animated')) {
        queuedSlide = {item: item, transition: transition};
      } else {
        slideTo(item, transition);
      }
      
    };

    this.next = function() {
      this.slideTo(this.getSlideIndex() + 1, {
        direction: 1
      });
    };
    
    this.previous = function() {
      this.slideTo(this.getSlideIndex() - 1, {
        direction: -1
      });
    };
    
    var playTimeoutID = null;
    var playing = false;
    
    this.start = function() {
      playing = true;
    };
    
    this.stop = function() {
      playing = true;
      window.clearTimeout(playTimeoutID);
    };
    
    this.isPlaying = function() {
      return playing;
    };
  
    /* User Interaction */

    function initKeyboardInteraction() {
      
      // keyboard navigation
      
      var hasMouseFocus = false;
      
      $(element).bind('mouseenter', function(event) {
        hasMouseFocus = true;
      });
      
      $(element).bind('mouseleave', function(event) {
        hasMouseFocus = false;
      });
      
      $(document).bind('keydown', function(event) {
        
        if (event.target.tabIndex >= 0) {
          return;
        }
        
        if (hasMouseFocus) {
          switch (event.which) {
            case 39: 
              slideView.next();
              // event.preventDefault();
              break;
            case 37: 
              slideView.previous();
              // event.preventDefault();
              break;
          }
        }
      });
 
    }

    function initMouseWheelInteraction() {

      $element = $(element);
      
      var mouseWheelEndTimeout = null;
      var mouseWheelCount = 0;
      
      
      $element.bind('onmousewheel' in window ? 'mousewheel' : 'DOMMouseScroll', function(event) {

        var preventDefault = false;
        
        if (event.target, $(container).has($(event.target)).length === 0) {
          return;
        }
    
        // get mouse wheel vector
        var oEvent = event.originalEvent;
        var wheelDeltaX;
        var wheelDeltaY;
        if (!window.opera && 'wheelDeltaX' in oEvent) {
          wheelDeltaX = oEvent.wheelDeltaX;
          wheelDeltaY = oEvent.wheelDeltaY;
            
        } else if (!window.opera && 'detail' in oEvent) {
          if (oEvent.axis === 2) { 
            // Vertical
            wheelDeltaY = -oEvent.detail * 12;
            wheelDeltaX = 0;
          } else { 
            // Horizontal
            wheelDeltaX = -oEvent.detail * 12;
            wheelDeltaY = 0;
          }
        } else if ('wheelDelta' in oEvent) {
          // ie / opera
          wheelDeltaX = 0;
          wheelDeltaY = sh > 0 ? oEvent.wheelDelta : 0;
        }
        
        var dx = wheelDeltaX ? - wheelDeltaX / 12 : 0;
        var dy = - wheelDeltaY / 12;
  
        var o = dy == 0 ? Math.abs(dx) : Math.abs(dx) / Math.abs(dy);
        
        
        if (mouseWheelEndTimeout != null) {
          
            window.clearTimeout(mouseWheelEndTimeout);
            mouseWheelEndTimeout = null;
            
        } else {
           
           
           if (o > 0 && dx != 0) {
            
                if (dx > 0) {

                  slideView.next({
                    type: 'swipe'
                  });
                  
                } else if (dx < 0) {

                  slideView.previous({
                    type: 'swipe'
                  });
                  
                }
            }

        }
        
        if (o > 0 && dx != 0) {
          preventDefault = true;
        }
        
        mouseWheelEndTimeout = window.setTimeout(function() {
          mouseWheelEndTimeout = null;
        }, 100);

      
        if (currentTransition) {
            preventDefault = true;
        }
    
        if (preventDefault) {
            
          if (event.preventDefault) {
              event.preventDefault();
              event.stopPropagation();
          }
          
          event.returnValue = false;
          event.cancelBubbles = true;
          return false;     
        }
      
      });
    }
  
  
    function initTouchInteraction() {
      
      var mouseDragging = options.mouseDragging;
  
      var touchStartPos = null, touchStartTime = null, touchCurrentPos = null, touchInitialVector = null, cancelClicks;
      var initialDirection;
     
      var touchStartEvent = isTouch ? 'touchstart' : mouseDragging ? ' mousedown' : null;
      var touchMoveEvent = isTouch ? 'touchmove' : mouseDragging ? ' mousemove' : null;
      var touchEndEvent = isTouch ? 'touchend' : mouseDragging ? ' mouseup' : null;
      var touchMoved = false;
      
      $element.bind(touchStartEvent, function(event) {
        
        if (event.target, $(container).has($(event.target)).length === 0) {
          return;
        }
        
        if($container.is(':animated')) {
          $container.stop();
        }
        
        var touchEvent = event.originalEvent;
        var touch = event.type == 'touchstart' ? touchEvent.changedTouches[0] : touchEvent;
        touchStartPos = touchCurrentPos = {x: touch.clientX, y: touch.clientY};
        touchStartTime = new Date().getTime();
        initialDirection = null;
        touchMoved = false;
      
        if (event.type == 'mousedown') {
          
          event.preventDefault();
          
          window.setTimeout(function() {
            $(event.target).focus();
          }, 100);
          
          event.stopPropagation();
          
        }
        
        // reset playback timer
        window.clearTimeout(playTimeoutID);
  
      });
      
      $element.bind(touchMoveEvent, function(event) {
        
        // touch move
  
        if (touchCurrentPos != null) {
          
          touchMoved = true;
          
          var touchEvent = event.originalEvent;
          
          var touch = event.type == 'touchmove' ? touchEvent.changedTouches[0] : touchEvent;
          var touchX = touch.clientX;
          var touchY = touch.clientY;
          
          var dx = (touchX - touchCurrentPos.x) * -1;
          var dy = (touchY - touchCurrentPos.y) * -1;
  
          touchCurrentPos = {x: touchX, y: touchY};
          
          var o = dy == 0 ? Math.abs(dx) : Math.abs(dx) / Math.abs(dy);
  
          if (initialDirection == null) {
            initialDirection = o;
          }
          
          if (initialDirection >= 1) {
  
            if (dx != 0) {
  
                var s = getScrollPosition();
  
                setScrollPosition(s.x + dx, 0, 0);
                
                layoutItems();
            }
  
            event.preventDefault();
    
          } else  {
          
          }
        }
  
      });
      
      
      $(document).bind(touchEndEvent, function(event) {
      //$element.bind(touchEndEvent, function(event) {
        
        // touch end
        if (touchCurrentPos != null) {   
      
          var touchEvent = event.originalEvent;
  
          var currentIndex = slideView.indexOf(currentItem);
          var newIndex = currentIndex;
            
          var dx = touchCurrentPos.x - touchStartPos.x;
          var dy = touchCurrentPos.y - touchStartPos.y;
  
          var maxTouchTime = options.maxTouchTime;
          
          var touchTime = new Date().getTime() - touchStartTime;
      
          var clw = element.clientWidth;
          var clh = element.clientHeight;
          
          var v = touchInitialVector;
          
          var o = Math.abs(dx) / Math.abs(dy);
          
          touchCurrentPos = null;
          
          // TODO: dynamic duration based on momentum
          var duration = options.transition.duration;
          
          invalidateScrollPosition();
  
          if (o >= 1 && dx != 0) {
  
            var s = getScrollPosition();
            var ns = {x: s.x, y: s.y};
            
            if (touchTime < maxTouchTime) {
              
              ns.x = dx < 0 ? 
                Math.ceil(s.x / clw) * clw : dx > 0 ?
                Math.floor(s.x / clw) * clw : Math.round(s.x / clw) * clw;
  
            } else {
              
              var scrollOffset = s.x / clw - Math.round(s.x / clw);
              
              ns.x = dx > 0 && scrollOffset > 0.5 < 0 ? 
                Math.ceil(s.x / clw) * clw : dx < 0 && scrollOffset < -0.5 ?
                Math.floor(s.x / clw) * clw : Math.round(s.x / clw) * clw;
  
            }
            
            // TODO: call slideTo
            //var e = getItemAtScrollPosition(ns.x, ns.y);
            //slideView.slideTo(e, {transition: 'swipe', duration: duration});
            var item = getItemAtScrollPosition(ns.x, ns.y);
            slideIndex = slideView.indexOf(item);
            slide(item);
            setScrollPosition(ns.x, ns.y, duration);
            
          }
          
        }
        
      });  
  
  
      $element.bind('click', function(event) {
        if (touchMoved) {
          touchMoved = false;
          event.preventDefault();
          event.stopPropagation();
        }
      });
  
    }

    
    /* Load Management */
   
    var readySlides = [];
    
    function isSlideReady(item) {
        var $item = $(item);
        var src = $item.data('src');
        return !src
          || src == window.location.href 
          || $.inArray(item, readySlides) >= 0;
    }
    
    function slideReady(item) {
      if ($.inArray(item, readySlides) == -1) {
        readySlides.push(item);
        
        if (typeof options.slideReady == "function") {
          options.slideReady.call(slideView, item);
        }
        if (!options.preloadImages || isAllImageComplete(item)) {
           slideLoaded.call(slideView, item);
        } else {
          loadImages(item);
        }
      }
    }
    
    function isSlideLoaded(item) {
      return $(item).data('src') == window.location.href || isSlideReady(item) && (!options.preloadImages || isAllImageComplete(item));
    }
    
    function slideLoaded(item) {
      $(item).removeClass('loading');
      if (options.slideLoaded == "function") options.slideLoaded.call(slideView, item);
    }
        
    function loadSlide(item) {
      if ($(item).hasClass('loading')) return;
      if (!isSlideReady(item)) {
          loadContent(item, function(elem) {
            slideReady.call(slideView, elem);
          });
      } else if (!isSlideLoaded(item)) {
        loadImages(item);
      } else {
          // complete
      }
    }
    
    function loadImages(item) {
      
      $item = $(item);

      if (isAllImageComplete(item)) {
        return;
      }

      $item.addClass('loading');
      
      var children = null;

      $('img', item).bind('load error', function(event) {

          if (event.type == 'error') {
            // image error
          }
       
          var complete = true;
          for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (!isAllImageComplete(child)) {
              complete = false;
            }
          }
          
          if (complete) {
            // images complete
            // restore children
            if (children != null) {
              /*
              for (var i = 0; i < children.length; i++) {
                var child = children[i];
                if (child.nodeType == 1) {
                  child.style.display = "";
                }
                item.appendChild(child);
              }
              */
              slideLoaded.call(slideView, item);
            }
            
          }
          
      });
      
      children = [];
      /*
      if ($.inArray(item, items) == -1) {
        for (var i = 0; i < item.childNodes.length; i++) {
          var child = item.childNodes[i];
          children.push( child );
          if (child.nodeType == 1) {
            console.log("hide item");
            child.style.display = "none";
          } else {
            item.removeChild(child);
            i--;
          }
        }
      }*/
      
    }
    
    function loadContent(item, callback) {
      var $item = $(item);
      $item.addClass('loading');
      var url = $item.data('src');
      $.ajax({
        url: url, 
        dataType: 'html'
      }).success(function(data, status, xhr) {
        var elem = null;
        var htmlElements = $.parseHTML(data);
        var title = "";
        $(htmlElements).each(function() {
          var importNode = null;
          var $this = $(this);
          if ($this.is(options.slideSelector)) {
            importNode = this; 
          } else {
            importNode = $this.find(options.slideSelector)[0];
          }
          if (importNode) {
            elem = document.importNode(importNode, true);
          }
          if ($this.is('title')) {
            title = $this.text();
          }
        });
        
        if (elem) {
  
          var $elem = $(elem);
          // replace attributes
          for (var i = 0; i < elem.attributes; i++) {
            $item.attr(elem.attributes[i].nodeName, elem.attributes[i].nodeValue);
          }
          // remove unique id
          $item.removeAttr("id");
          
          // replace content
          $item.html($elem.html());
          
          // add css classes
          var cssClasses = elem.className.split(/\s+/);
          for (var i = 0; i < cssClasses.length; i++) {
            $item.addClass(cssClasses[i]);
          }
          
          if (title) {
            $item.data('title', title);
          }
          
          //$item.removeClass('loading');
          
          if (callback) {
            // callback
            callback.call(this, item);
          }
  
        } else {
          console.warn('content element not found - selector: ' + options.slideSelector);
        }
  
      });
    }
  
    function initControls() {
      var touchEndEvent = isTouch ? 'touchend' : 'click';
      $element.bind(touchEndEvent, function(event) {
        var nextButton = getOptionElement('nextButton');
        var prevButton = getOptionElement('prevButton');
        var pagination = getOptionElement('pagination');
        if ($(nextButton).is(event.target) || $(nextButton).has(event.target).length) {
          slideView.next();
        }
        if ($(prevButton).is(event.target) || $(prevButton).has(event.target).length) {
          slideView.previous();
        }
        if (pagination) {
          var slideIndex = $(paginationItems).index($(paginationItems).filter(function(index) {
            if ($(this).is(event.target) || $(this).has(event.target).length) {
              return true;
            };
          }));
          if (slideIndex !== -1) {
            slideView.slideTo(slideIndex);
          }
        }
      });
    }

    /* INIT */
  
    function init() {
      
      items = [];
      
      animatePlugin = 'animate';
      
      // css transform fallback
      if (options.scrollStyle.indexOf('transform') >= 0) {
        var transformStyle = getVendorStyle('transform');
        if (!transformStyle) {
          options.scrollStyle = 'position';
        }
      }
      
      
      $element.css({
        overflow: 'hidden'
      });
      
      // init container
      $container = $(options.contentSelector, $element);
      container = $container[0];
      
      // Collect initial items
      var initialItemsParent = container || element;
      var initialItems = [];
      for (var i = 0; i < initialItemsParent.childNodes.length; i++) {
        var child = initialItemsParent.childNodes[i];
        if (isItem(child)) {
          initialItems.push(child);
        } else {
          initialItemsParent.removeChild(child);
          i--;
        }
      }
      
      if (!container) {
        container = element.ownerDocument.createElement('div');
        $container = $(container);
        $element.append(container);
      }
      
      $container.css({
        position: 'relative', 
        left: 0, 
        top: 0, 
        width: '100%', 
        height: '100%'
      });
      
      // add items to container
      for (var i = 0; i < initialItems.length; i++) {
        var item = initialItems[i];
        container.appendChild(item);
        items.push(item);
      }
    
      // init interaction
      if (options.userInteraction) {
        
        if (isTouch || options.mouseDragging) {
          // init touch interaction only if touch available or mousedragging activated
          initTouchInteraction();
        }
      
        initKeyboardInteraction();
        initMouseWheelInteraction();
      }
      
      initControls();
      
      layoutItems.call(this);

      // init playback
      if (options.autoStart) {
        this.start();
      }
      
      _currentItem = this.get(options.slideIndex || 0);
      
      //invalidateSource.call(this);
      
      updateOptions.call(this);
    
    }
    // init plugin
    init.call(this);
    
  };
  
  // bootstrap plugin
 
  $.fn[pluginName] = function(options) {
       
    options = $.extend({}, defaults, options);

    return this.each(function() {
        var instance = $(this).data(pluginName);
        if (!instance) {
          instance = $(this).data(pluginName, new pluginClass(this, options));
        } else {
          instance.setOptions(options);
        }
        
        return $(this);
    });
  };
  
  
})(jQuery, window);