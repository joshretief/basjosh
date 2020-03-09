var Webflow = __webpack_require__(0);

Webflow.define('touch', module.exports = function ($) {
  var api = {};
  var getSelection = window.getSelection; // Delegate all legacy 'tap' events to 'click'

  $.event.special.tap = {
    bindType: 'click',
    delegateType: 'click'
  };

  api.init = function (el) {
    el = typeof el === 'string' ? $(el).get(0) : el;
    return el ? new Touch(el) : null;
  };

  function Touch(el) {
    var active = false;
    var useTouch = false;
    var thresholdX = Math.min(Math.round(window.innerWidth * 0.04), 40);
    var startX;
    var lastX;
    el.addEventListener('touchstart', start, false);
    el.addEventListener('touchmove', move, false);
    el.addEventListener('touchend', end, false);
    el.addEventListener('touchcancel', cancel, false);
    el.addEventListener('mousedown', start, false);
    el.addEventListener('mousemove', move, false);
    el.addEventListener('mouseup', end, false);
    el.addEventListener('mouseout', cancel, false);

    function start(evt) {
      // We don’t handle multi-touch events yet.
      var touches = evt.touches;

      if (touches && touches.length > 1) {
        return;
      }

      active = true;

      if (touches) {
        useTouch = true;
        startX = touches[0].clientX;
      } else {
        startX = evt.clientX;
      }

      lastX = startX;
    }

    function move(evt) {
      if (!active) {
        return;
      }

      if (useTouch && evt.type === 'mousemove') {
        evt.preventDefault();
        evt.stopPropagation();
        return;
      }

      var touches = evt.touches;
      var x = touches ? touches[0].clientX : evt.clientX;
      var velocityX = x - lastX;
      lastX = x; // Allow swipes while pointer is down, but prevent them during text selection

      if (Math.abs(velocityX) > thresholdX && getSelection && String(getSelection()) === '') {
        triggerEvent('swipe', evt, {
          direction: velocityX > 0 ? 'right' : 'left'
        });
        cancel();
      }
    }

    function end(evt) {
      if (!active) {
        return;
      }

      active = false;

      if (useTouch && evt.type === 'mouseup') {
        evt.preventDefault();
        evt.stopPropagation();
        useTouch = false;
        return;
      }
    }

    function cancel() {
      active = false;
    }

    function destroy() {
      el.removeEventListener('touchstart', start, false);
      el.removeEventListener('touchmove', move, false);
      el.removeEventListener('touchend', end, false);
      el.removeEventListener('touchcancel', cancel, false);
      el.removeEventListener('mousedown', start, false);
      el.removeEventListener('mousemove', move, false);
      el.removeEventListener('mouseup', end, false);
      el.removeEventListener('mouseout', cancel, false);
      el = null;
    } // Public instance methods


    this.destroy = destroy;
  } // Wrap native event to supoprt preventdefault + stopPropagation


  function triggerEvent(type, evt, data) {
    var newEvent = $.Event(type, {
      originalEvent: evt
    });
    $(evt.target).trigger(newEvent, data);
  } // Listen for touch events on all nodes by default.


  api.instance = api.init(document); // Export module

  return api;
});

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
 // @wf-will-never-add-flow-to-this-file

/* global window, document */

/* eslint-disable no-var */

/**
 * Webflow: Slider component
 */

var Webflow = __webpack_require__(0);

var IXEvents = __webpack_require__(11);

Webflow.define('slider', module.exports = function ($, _) {
  var api = {};
  var tram = $.tram;
  var $doc = $(document);
  var $sliders;
  var designer;
  var inApp = Webflow.env();
  var namespace = '.w-slider';
  var dot = '<div class="w-slider-dot" data-wf-ignore />';
  var ix = IXEvents.triggers;
  var fallback;
  var inRedraw; // -----------------------------------
  // Module methods

  api.ready = function () {
    designer = Webflow.env('design');
    init();
  };

  api.design = function () {
    designer = true;
    init();
  };

  api.preview = function () {
    designer = false;
    init();
  };

  api.redraw = function () {
    inRedraw = true;
    init();
  };

  api.destroy = removeListeners; // -----------------------------------
  // Private methods

  function init() {
    // Find all sliders on the page
    $sliders = $doc.find(namespace);

    if (!$sliders.length) {
      return;
    }

    $sliders.each(build);
    inRedraw = null;

    if (fallback) {
      return;
    }

    removeListeners();
    addListeners();
  }

  function removeListeners() {
    Webflow.resize.off(renderAll);
    Webflow.redraw.off(api.redraw);
  }

  function addListeners() {
    Webflow.resize.on(renderAll);
    Webflow.redraw.on(api.redraw);
  }

  function renderAll() {
    $sliders.filter(':visible').each(render);
  }

  function build(i, el) {
    var $el = $(el); // Store slider state in data

    var data = $.data(el, namespace);

    if (!data) {
      data = $.data(el, namespace, {
        index: 0,
        depth: 1,
        el: $el,
        config: {}
      });
    }

    data.mask = $el.children('.w-slider-mask');
    data.left = $el.children('.w-slider-arrow-left');
    data.right = $el.children('.w-slider-arrow-right');
    data.nav = $el.children('.w-slider-nav');
    data.slides = data.mask.children('.w-slide');
    data.slides.each(ix.reset);

    if (inRedraw) {
      data.maskWidth = 0;
    } // Disable in old browsers


    if (!tram.support.transform) {
      data.left.hide();
      data.right.hide();
      data.nav.hide();
      fallback = true;
      return;
    } // Remove old events


    data.el.off(namespace);
    data.left.off(namespace);
    data.right.off(namespace);
    data.nav.off(namespace); // Set config from data attributes

    configure(data); // Add events based on mode

    if (designer) {
      data.el.on('setting' + namespace, handler(data));
      stopTimer(data);
      data.hasTimer = false;
    } else {
      data.el.on('swipe' + namespace, handler(data));
      data.left.on('click' + namespace, previousFunction(data));
      data.right.on('click' + namespace, next(data)); // Start timer if autoplay is true, only once

      if (data.config.autoplay && !data.hasTimer) {
        data.hasTimer = true;
        data.timerCount = 1;
        startTimer(data);
      }
    } // Listen to nav events


    data.nav.on('click' + namespace, '> div', handler(data)); // Remove gaps from formatted html (for inline-blocks)

    if (!inApp) {
      data.mask.contents().filter(function () {
        return this.nodeType === 3;
      }).remove();
    } // If slider or any parent is hidden, temporarily show for measurements (https://github.com/webflow/webflow/issues/24921)


    var $elHidden = $el.filter(':hidden');
    $elHidden.show();
    var $elHiddenParents = $el.parents(':hidden');
    $elHiddenParents.show(); // Run first render

    render(i, el); // If slider or any parent is hidden, reset after temporarily showing for measurements

    $elHidden.css('display', '');
    $elHiddenParents.css('display', '');
  }

  function configure(data) {
    var config = {};
    config.crossOver = 0; // Set config options from data attributes

    config.animation = data.el.attr('data-animation') || 'slide';

    if (config.animation === 'outin') {
      config.animation = 'cross';
      config.crossOver = 0.5;
    }

    config.easing = data.el.attr('data-easing') || 'ease';
    var duration = data.el.attr('data-duration');
    config.duration = duration != null ? parseInt(duration, 10) : 500;

    if (isAttrTrue(data.el.attr('data-infinite'))) {
      config.infinite = true;
    }

    if (isAttrTrue(data.el.attr('data-disable-swipe'))) {
      config.disableSwipe = true;
    }

    if (isAttrTrue(data.el.attr('data-hide-arrows'))) {
      config.hideArrows = true;
    } else if (data.config.hideArrows) {
      data.left.show();
      data.right.show();
    }

    if (isAttrTrue(data.el.attr('data-autoplay'))) {
      config.autoplay = true;
      config.delay = parseInt(data.el.attr('data-delay'), 10) || 2000;
      config.timerMax = parseInt(data.el.attr('data-autoplay-limit'), 10); // Disable timer on first touch or mouse down

      var touchEvents = 'mousedown' + namespace + ' touchstart' + namespace;

      if (!designer) {
        data.el.off(touchEvents).one(touchEvents, function () {
          stopTimer(data);
        });
      }
    } // Use edge buffer to help calculate page count


    var arrowWidth = data.right.width();
    config.edge = arrowWidth ? arrowWidth + 40 : 100; // Store config in data

    data.config = config;
  }

  function isAttrTrue(value) {
    return value === '1' || value === 'true';
  }

  function previousFunction(data) {
    return function () {
      change(data, {
        index: data.index - 1,
        vector: -1
      });
    };
  }

  function next(data) {
    return function () {
      change(data, {
        index: data.index + 1,
        vector: 1
      });
    };
  }

  function select(data, value) {
    // Select page based on slide element index
    var found = null;

    if (value === data.slides.length) {
      init();
      layout(data); // Rebuild and find new slides
    }

    _.each(data.anchors, function (anchor, index) {
      $(anchor.els).each(function (i, el) {
        if ($(el).index() === value) {
          found = index;
        }
      });
    });

    if (found != null) {
      change(data, {
        index: found,
        immediate: true
      });
    }
  }

  function startTimer(data) {
    stopTimer(data);
    var config = data.config;
    var timerMax = config.timerMax;

    if (timerMax && data.timerCount++ > timerMax) {
      return;
    }

    data.timerId = window.setTimeout(function () {
      if (data.timerId == null || designer) {
        return;
      }

      next(data)();
      startTimer(data);
    }, config.delay);
  }

  function stopTimer(data) {
    window.clearTimeout(data.timerId);
    data.timerId = null;
  }

  function handler(data) {
    return function (evt, options) {
      options = options || {};
      var config = data.config; // Designer settings

      if (designer && evt.type === 'setting') {
        if (options.select === 'prev') {
          return previousFunction(data)();
        }

        if (options.select === 'next') {
          return next(data)();
        }

        configure(data);
        layout(data);

        if (options.select == null) {
          return;
        }

        select(data, options.select);
        return;
      } // Swipe event


      if (evt.type === 'swipe') {
        if (config.disableSwipe) {
          return;
        }

        if (Webflow.env('editor')) {
          return;
        }

        if (options.direction === 'left') {
          return next(data)();
        }

        if (options.direction === 'right') {
          return previousFunction(data)();
        }

        return;
      } // Page buttons


      if (data.nav.has(evt.target).length) {
        change(data, {
          index: $(evt.target).index()
        });
      }
    };
  }

  function change(data, options) {
    options = options || {};
    var config = data.config;
    var anchors = data.anchors; // Set new index

    data.previous = data.index;
    var index = options.index;
    var shift = {};

    if (index < 0) {
      index = anchors.length - 1;

      if (config.infinite) {
        // Shift first slide to the end
        shift.x = -data.endX;
        shift.from = 0;
        shift.to = anchors[0].width;
      }
    } else if (index >= anchors.length) {
      index = 0;

      if (config.infinite) {
        // Shift last slide to the start
        shift.x = anchors[anchors.length - 1].width;
        shift.from = -anchors[anchors.length - 1].x;
        shift.to = shift.from - shift.x;
      }
    }

    data.index = index; // Select page nav

    var active = data.nav.children().eq(data.index).addClass('w-active');
    data.nav.children().not(active).removeClass('w-active'); // Hide arrows

    if (config.hideArrows) {
      data.index === anchors.length - 1 ? data.right.hide() : data.right.show();
      data.index === 0 ? data.left.hide() : data.left.show();
    } // Get page offset from anchors


    var lastOffsetX = data.offsetX || 0;
    var offsetX = data.offsetX = -anchors[data.index].x;
    var resetConfig = {
      x: offsetX,
      opacity: 1,
      visibility: ''
    }; // Transition slides

    var targets = $(anchors[data.index].els);
    var prevTargs = $(anchors[data.previous] && anchors[data.previous].els);
    var others = data.slides.not(targets);
    var animation = config.animation;
    var easing = config.easing;
    var duration = Math.round(config.duration);
    var vector = options.vector || (data.index > data.previous ? 1 : -1);
    var fadeRule = 'opacity ' + duration + 'ms ' + easing;
    var slideRule = 'transform ' + duration + 'ms ' + easing; // Trigger IX events

    if (!designer) {
      targets.each(ix.intro);
      others.each(ix.outro);
    } // Set immediately after layout changes (but not during redraw)


    if (options.immediate && !inRedraw) {
      tram(targets).set(resetConfig);
      resetOthers();
      return;
    } // Exit early if index is unchanged


    if (data.index === data.previous) {
      return;
    } // Cross Fade / Out-In


    if (animation === 'cross') {
      var reduced = Math.round(duration - duration * config.crossOver);
      var wait = Math.round(duration - reduced);
      fadeRule = 'opacity ' + reduced + 'ms ' + easing;
      tram(prevTargs).set({
        visibility: ''
      }).add(fadeRule).start({
        opacity: 0
      });
      tram(targets).set({
        visibility: '',
        x: offsetX,
        opacity: 0,
        zIndex: data.depth++
      }).add(fadeRule).wait(wait).then({
        opacity: 1
      }).then(resetOthers);
      return;
    } // Fade Over


    if (animation === 'fade') {
      tram(prevTargs).set({
        visibility: ''
      }).stop();
      tram(targets).set({
        visibility: '',
        x: offsetX,
        opacity: 0,
        zIndex: data.depth++
      }).add(fadeRule).start({
        opacity: 1
      }).then(resetOthers);
      return;
    } // Slide Over


    if (animation === 'over') {
      resetConfig = {
        x: data.endX
      };
      tram(prevTargs).set({
        visibility: ''
      }).stop();
      tram(targets).set({
        visibility: '',
        zIndex: data.depth++,
        x: offsetX + anchors[data.index].width * vector
      }).add(slideRule).start({
        x: offsetX
      }).then(resetOthers);
      return;
    } // Slide - infinite scroll


    if (config.infinite && shift.x) {
      tram(data.slides.not(prevTargs)).set({
        visibility: '',
        x: shift.x
      }).add(slideRule).start({
        x: offsetX
      });
      tram(prevTargs).set({
        visibility: '',
        x: shift.from
      }).add(slideRule).start({
        x: shift.to
      });
      data.shifted = prevTargs;
    } else {
      if (config.infinite && data.shifted) {
        tram(data.shifted).set({
          visibility: '',
          x: lastOffsetX
        });
        data.shifted = null;
      } // Slide - basic scroll


      tram(data.slides).set({
        visibility: ''
      }).add(slideRule).start({
        x: offsetX
      });
    } // Helper to move others out of view


    function resetOthers() {
      targets = $(anchors[data.index].els);
      others = data.slides.not(targets);

      if (animation !== 'slide') {
        resetConfig.visibility = 'hidden';
      }

      tram(others).set(resetConfig);
    }
  }

  function render(i, el) {
    var data = $.data(el, namespace);

    if (!data) {
      return;
    }

    if (maskChanged(data)) {
      return layout(data);
    }

    if (designer && slidesChanged(data)) {
      layout(data);
    }
  }

  function layout(data) {
    // Determine page count from width of slides
    var pages = 1;
    var offset = 0;
    var anchor = 0;
    var width = 0;
    var maskWidth = data.maskWidth;
    var threshold = maskWidth - data.config.edge;

    if (threshold < 0) {
      threshold = 0;
    }

    data.anchors = [{
      els: [],
      x: 0,
      width: 0
    }];
    data.slides.each(function (i, el) {
      if (anchor - offset > threshold) {
        pages++;
        offset += maskWidth; // Store page anchor for transition

        data.anchors[pages - 1] = {
          els: [],
          x: anchor,
          width: 0
        };
      } // Set next anchor using current width + margin


      width = $(el).outerWidth(true);
      anchor += width;
      data.anchors[pages - 1].width += width;
      data.anchors[pages - 1].els.push(el);
    });
    data.endX = anchor; // Build dots if nav exists and needs updating

    if (designer) {
      data.pages = null;
    }

    if (data.nav.length && data.pages !== pages) {
      data.pages = pages;
      buildNav(data);
    } // Make sure index is still within range and call change handler


    var index = data.index;

    if (index >= pages) {
      index = pages - 1;
    }

    change(data, {
      immediate: true,
      index: index
    });
  }

  function buildNav(data) {
    var dots = [];
    var $dot;
    var spacing = data.el.attr('data-nav-spacing');

    if (spacing) {
      spacing = parseFloat(spacing) + 'px';
    }

    for (var i = 0; i < data.pages; i++) {
      $dot = $(dot);

      if (data.nav.hasClass('w-num')) {
        $dot.text(i + 1);
      }

      if (spacing != null) {
        $dot.css({
          'margin-left': spacing,
          'margin-right': spacing
        });
      }

      dots.push($dot);
    }

    data.nav.empty().append(dots);
  }

  function maskChanged(data) {
    var maskWidth = data.mask.width();

    if (data.maskWidth !== maskWidth) {
      data.maskWidth = maskWidth;
      return true;
    }

    return false;
  }

  function slidesChanged(data) {
    var slidesWidth = 0;
    data.slides.each(function (i, el) {
      slidesWidth += $(el).outerWidth(true);
    });

    if (data.slidesWidth !== slidesWidth) {
      data.slidesWidth = slidesWidth;
      return true;
    }

    return false;
  } // Export module


  return api;
});

/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// @wf-will-never-add-flow-to-this-file

/* globals window, document */

/* eslint-disable no-var */
// eslint-disable-next-line strict


var IXEvents = __webpack_require__(12);

function dispatchCustomEvent(element, eventName) {
  var event = document.createEvent('CustomEvent');
  event.initCustomEvent(eventName, true, true, null);
  element.dispatchEvent(event);
}
/**
 * Webflow: IX Event triggers for other modules
 */


var $ = window.jQuery;
var api = {};
var namespace = '.w-ix';
var eventTriggers = {
  reset: function reset(i, el) {
    IXEvents.triggers.reset(i, el);
  },
  intro: function intro(i, el) {
    IXEvents.triggers.intro(i, el);
    dispatchCustomEvent(el, 'COMPONENT_ACTIVE');
  },
  outro: function outro(i, el) {
    IXEvents.triggers.outro(i, el);
    dispatchCustomEvent(el, 'COMPONENT_INACTIVE');
  }
};
api.triggers = {};
api.types = {
  INTRO: 'w-ix-intro' + namespace,
  OUTRO: 'w-ix-outro' + namespace
};
$.extend(api.triggers, eventTriggers);
module.exports = api;

/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// @wf-will-never-add-flow-to-this-file

/* globals window */

/* eslint-disable no-var */

/**
 * Webflow: IX Event triggers for other modules
 */
// eslint-disable-next-line strict


var $ = window.jQuery;
var api = {};
var eventQueue = [];
var namespace = '.w-ix';
var eventTriggers = {
  reset: function reset(i, el) {
    el.__wf_intro = null;
  },
  intro: function intro(i, el) {
    if (el.__wf_intro) {
      return;
    }

    el.__wf_intro = true;
    $(el).triggerHandler(api.types.INTRO);
  },
  outro: function outro(i, el) {
    if (!el.__wf_intro) {
      return;
    }

    el.__wf_intro = null;
    $(el).triggerHandler(api.types.OUTRO);
  }
};
api.triggers = {};
api.types = {
  INTRO: 'w-ix-intro' + namespace,
  OUTRO: 'w-ix-outro' + namespace
}; // Trigger any events in queue + restore trigger methods

api.init = function () {
  var count = eventQueue.length;

  for (var i = 0; i < count; i++) {
    var memo = eventQueue[i];
    memo[0](0, memo[1]);
  }

  eventQueue = [];
  $.extend(api.triggers, eventTriggers);
}; // Replace all triggers with async wrapper to queue events until init


api.async = function () {
  for (var key in eventTriggers) {
    var func = eventTriggers[key];

    if (!eventTriggers.hasOwnProperty(key)) {
      continue;
    } // Replace trigger method with async wrapper


    api.triggers[key] = function (i, el) {
      eventQueue.push([func, el]);
    };
  }
}; // Default triggers to async queue


api.async();
module.exports = api;

/***/ })
/******/ ]);
