const ctx = "@@InfiniteScroll";

var throttle = function(fn, delay) {
  var now, lastExec, timer, context, args; //eslint-disable-line

  var execute = function() {
    fn.apply(context, args);
    lastExec = now;
  };

  return function() {
    context = this;
    args = arguments;

    now = Date.now();

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    if (lastExec) {
      var diff = delay - (now - lastExec);
      if (diff < 0) {
        execute();
      } else {
        timer = setTimeout(() => {
          execute();
        }, diff);
      }
    } else {
      execute();
    }
  };
};

var getScrollTop = function(element) {
  if (element === window) {
    return Math.max(
      window.pageYOffset || 0,
      document.documentElement.scrollTop
    );
  }

  return element.scrollTop;
};

var getComputedStyle = document.defaultView.getComputedStyle;

var getScrollEventTarget = function(element) {
  var currentNode = element;
  // bugfix, see http://w3help.org/zh-cn/causes/SD9013 and http://stackoverflow.com/questions/17016740/onscroll-function-is-not-working-for-chrome
  while (
    currentNode &&
    currentNode.tagName !== "HTML" &&
    currentNode.tagName !== "BODY" &&
    currentNode.nodeType === 1
  ) {
    var overflowY = getComputedStyle(currentNode).overflowY;
    if (overflowY === "scroll" || overflowY === "auto") {
      return currentNode;
    }
    currentNode = currentNode.parentNode;
  }
  return window;
};

var getVisibleHeight = function(element) {
  if (element === window) {
    return document.documentElement.clientHeight;
  }

  return element.clientHeight;
};

var getElementTop = function(element) {
  if (element === window) {
    return getScrollTop(window);
  }
  return element.getBoundingClientRect().top + getScrollTop(window);
};

var isAttached = function(element) {
  var currentNode = element.parentNode;
  while (currentNode) {
    if (currentNode.tagName === "HTML") {
      return true;
    }
    if (currentNode.nodeType === 11) {
      return false;
    }
    currentNode = currentNode.parentNode;
  }
  return false;
};

var doBind = function() {
  if (this.binded) return; // eslint-disable-line
  this.binded = true;

  var directive = myInstance;
  var element = directive.el;

  var throttleDelayExpr = element.getAttribute(
    "infinite-scroll-throttle-delay"
  );
  var throttleDelay = 200;
  if (throttleDelayExpr) {
    throttleDelay = Number(
      directive.vm[throttleDelayExpr] || throttleDelayExpr
    );
    if (isNaN(throttleDelay) || throttleDelay < 0) {
      throttleDelay = 200;
    }
  }
  directive.throttleDelay = throttleDelay;

  directive.scrollEventTarget = getScrollEventTarget(element);
  directive.scrollListener = throttle(
    doCheck.bind(directive),
    directive.throttleDelay
  );
  directive.scrollEventTarget.addEventListener(
    "scroll",
    directive.scrollListener
  );

  var disabledExpr = element.getAttribute("infinite-scroll-disabled");
  var disabled = false;

  if (disabledExpr) {
    this.vm.$watch(disabledExpr, function(value) {
      directive.disabled = value;
      if (!value && directive.immediateCheck) {
        setTimeout(() => {
          doCheck.call(directive);
        });
      }
    });
    disabled = Boolean(directive.vm[disabledExpr]);
  }
  directive.disabled = disabled;

  var distanceExpr = element.getAttribute("infinite-scroll-distance");
  var distance = 0;
  if (distanceExpr) {
    distance = Number(directive.vm[distanceExpr] || distanceExpr);
    if (isNaN(distance)) {
      distance = 0;
    }
  }
  directive.distance = distance;

  var immediateCheckExpr = element.getAttribute(
    "infinite-scroll-immediate-check"
  );
  var immediateCheck = true;
  if (immediateCheckExpr) {
    immediateCheck = Boolean(directive.vm[immediateCheckExpr]);
  }
  directive.immediateCheck = immediateCheck;

  if (immediateCheck) {
    setTimeout(() => {
      doCheck.call(directive);
    });
  }

  var eventName = element.getAttribute("infinite-scroll-listen-for-event");
  if (eventName) {
    directive.vm.$on(eventName, function() {
      setTimeout(() => {
        doCheck.call(directive);
      });
    });
  }
};

var doCheck = function(force) {
  var scrollEventTarget = myInstance.scrollEventTarget;
  var element = myInstance.el;
  var distance = myInstance.distance;

  if (force !== true && myInstance.disabled) return; //eslint-disable-line
  var viewportScrollTop = getScrollTop(scrollEventTarget);
  var viewportBottom = viewportScrollTop + getVisibleHeight(scrollEventTarget);

  var shouldTrigger = false;

  if (scrollEventTarget === element) {
    shouldTrigger = scrollEventTarget.scrollHeight - viewportBottom <= distance;
  } else {
    var elementBottom =
      getElementTop(element) -
      getElementTop(scrollEventTarget) +
      element.offsetHeight +
      viewportScrollTop;

    shouldTrigger = viewportBottom + distance >= elementBottom;
  }

  if (shouldTrigger && myInstance.expression) {
    this.expression();
  }
};

var myInstance = null;

var myDirective = {
  mounted(el, binding, vnode) {
    el[ctx] = {
      el,
      vm: binding.instance,
      expression: binding.value,
    };
    myInstance = el[ctx];
    var args = arguments;

    el[ctx].vm.$nextTick(function() {
      if (isAttached(el)) {
        doBind.call(el[ctx], args);
      }

      el[ctx].bindTryCount = 0;

      var tryBind = function() {
        if (el[ctx].bindTryCount > 10) return; //eslint-disable-line
        el[ctx].bindTryCount++;
        if (isAttached(el)) {
          doBind.call(el[ctx], args);
        } else {
          setTimeout(tryBind, 50);
        }
      };

      tryBind();
    });
  },

  unmounted(el) {
    if (el && el[ctx] && el[ctx].scrollEventTarget)
      el[ctx].scrollEventTarget.removeEventListener(
        "scroll",
        el[ctx].scrollListener
      );
  },

  beforeUnmount() {
    directive.scrollEventTarget.removeEventListener(
      "scroll",
      directive.scrollListener
    );
  },
};

export default myDirective;