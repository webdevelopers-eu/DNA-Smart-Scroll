/**
 * DNA SMART SCROLL
 *
 * Scroll element into view if needed.
 *
 * Take in an account fixed and sticky elements.
 *
 * Syntax:
 *
 * $(el).smartScroll([DOMRect | "start" | "end" ]);
 *
 * Scroll parent elements of $(el) so the rectangle is visible.
 * Good if you want to focus on particular area withing the large element (e.g. line in large WYSYWIG area)
 *
 * Examples:
 *
 * $(el).smartScroll();
 * $(el).smartScroll(new DOMRect(0, 0, 100, 100));
 * $(el).smartScroll("start");
 * $(el).smartScroll("end");
 *
 * Ideally this extension should use scroll-padding CSS + plain Element.scrollIntoView() simple call but
 *
 *  - IE does not supported
 *  - Safari does not support scroll-padding (https://bugs.webkit.org/show_bug.cgi?id=179379)
 *  - there is no way to know scrolling stopped (https://github.com/w3c/csswg-drafts/issues/3744)
 *
 * Once the above is solvable then this plugin should be updated to be more effective.
 *
 *
 * @module     DNA
 * @author     Daniel Sevcik <sevcik@webdevelopers.cz>
 * @copyright  2020 Daniel Sevcik
 * @since      2020-11-23 13:05:47 UTC
 * @access     public
 */
$.fn.smartScroll = function(param) {
  // $('.smart-scroll-debug').remove();
  let el = this.get(0);
  while (el && !el.clientHeight) {
    el = el.parentElement;
  }
  if (!el) {
    console.warn('SmartScroll: Element %o has not dimensions!', this.get(0));
    debugger;
    return this;
  }

  const $parents = $(el).parents();
  const view = getView();
  const rect = el.getBoundingClientRect();
  const diff = getDiffY(param, rect, view);

  // Avoid duplicate re-runs
  if (!diff || el.smartScroll == diff) {
    return this;
  }
  el.smartScroll = diff;
  setTimeout(() => delete el.smartScroll, 500);

  scroll(el, diff);

  // Check if absolute elements changed and then issue one more fixed scroll command
  setTimeout(function() {
    const view2 = getView(view.blockingObjects);
    if (view2.y != view.y || view2.height != view2.height) {
      console.log("SmartScroll: Constraints changed %o -> %o", view, view2);
      scroll(el, getDiffY(param, el.getBoundingClientRect(), view2));
    }
  }, 500);

  return this;

  function scroll(el, diffY) {
    if (!diffY) return; // nowhere to scroll;

    var box = el.offsetParent;
    while (box && diffY) {
      const style = window.getComputedStyle(box, null);
      const overflow = window.getComputedStyle(box, null).overflowY;
      if (overflow == 'auto' || overflow == 'scroll' /* || overflow == 'visible' */ || box.scrollTop) { // scrollable?
	const currY = box.scrollTop;
	const maxScrollY = box.scrollHeight - box.clientHeight;
	const changeY = Math.max(-currY, Math.min(diffY, maxScrollY - currY));
	diffY -= changeY;
	animate(box, Math.max(0, currY + changeY));
      }
      box = box.offsetParent || box.parentElement;
    }

    if (diffY) { // reminder
      animate(window, Math.max(0, window.scrollY + diffY));
    }
  }

  function getView(candidates) {
    let blockingObjects = [];
    let view = new DOMRect(0, 0, $(window).width(), $(window).height());
    let screenView = view;

    // fixed
    const all = candidates || document.body.getElementsByTagName("*");
    for (var i = 0; i < all.length; i++) {
      const child = all[i];
      const style = window.getComputedStyle(child, null);
      if (style.getPropertyValue('position') == 'fixed') {
	// console.log("Scroll: Fixed: %o", child);
	view = trim(screenView, view, child);
	blockingObjects.push(child);
      }
    }

    // sticky
    const parents = $parents.get();
    for (var parentIdx = 0; parentIdx < parents.length; parentIdx++) {
      for (var childIdx = 0; childIdx < parents[parentIdx].childElementCount; childIdx++) {
	const child = parents[parentIdx].children[childIdx];
	const style = window.getComputedStyle(child, null);
	if (style.getPropertyValue('position') == 'sticky') {
	  // console.log("Scroll: Sticky: %o", child);
	  view = trim(screenView, view, child);
	  blockingObjects.push(child);
	}
      }
    }

    view.blockingObjects = blockingObjects;
    return view;
  }

  function trim(screenView, view, overlay) {
    let ret = view;
    const rect = overlay.getBoundingClientRect();

    // No dimensions
    if (!rect.height || !rect.width) {
      return ret;
    }

    // above/bellow
    if (rect.bottom < view.top || rect.top > view.bottom) {
      return ret;
    }

    // Probably whole-page cover - ignore or very small icon or something
    if (rect.height >= screenView.height * 0.8 || rect.width < view.width * 0.3) {
      return ret;
    }

    // Element's center is in the middle fifth of the page - view-centered element - probably popup or cover
    if (Math.abs((rect.height / 2 + rect.top) - (view.height / 2 + view.top)) < view.height / 5) {
      return ret;
    }

    // not parent
    if ($parents.filter(overlay).length) {
      return ret;
    }

    // closer to top or bottom?
    if ((rect.top + rect.bottom) / 2 < (view.top + view.bottom) / 2) {
      // top
      ret = new DOMRect(view.x, rect.bottom, view.width, view.height + view.y - rect.bottom);
    } else {
      // bottom
      ret = new DOMRect(view.x, view.y, view.width, rect.top - view.top);
    }

    if (!ret.height) {
      console.warn("SmartScroll: Unexpected viewport area %o, subtracting element %o", ret, overlay);
      debugger; // some error, rather return original view
      return view;
    }

    return ret;
  }

  // This has major disadvantage: we don't know when it stopped: https://github.com/w3c/csswg-drafts/issues/3744
  function animate(el, top) {
    // if (Math.floor(el.scrollTop || el.scrollY || 0) == Math.floor(top)) return;
    console.log('SmartScroll: Animating %s -> %s', el.scrollTop || el.scrollY || 0, top);
    el.scrollTo({top: top, behavior: 'smooth'});
  }

  function getDiffY(positionParam, targetRect, view) {
    let diffY = 0;
    let rect;

    if (positionParam == 'start') {
      rect = new DOMRect(targetRect.x, targetRect.y, targetRect.width, view.height);
    } else if (positionParam == 'end') {
      rect = new DOMRect(targetRect.x, targetRect.bottom - view.height, targetRect.width, view.height);
    } else {
      rect = positionParam instanceof DOMRect ? positionParam : targetRect;
    }

    if (Math.floor(rect.top) >= Math.floor(view.top) && Math.floor(rect.bottom) >= Math.floor(view.bottom)) {
      // scroll up - align top to top
      diffY = rect.top - Math.max(view.top, view.bottom - rect.height);
    } else if (Math.floor(rect.top) <= Math.floor(view.top) && Math.floor(rect.bottom) <= Math.floor(view.bottom)) {
      // scroll down - align bottom to bottom (for editor when focusing on bottom line it would scroll it down bellow screen)
      diffY = rect.bottom - view.bottom;
    } else {
      // it spans the whole screen so we don't know where to
      // scroll. User should use some small anchor then this large
      // elment when calling $.fn.smartScroll()
      console.log('SmartScroll: Not sure where to scroll. Element is too big for viewport %o', view);
    }

    return Math.round(diffY); // round it all it keeps makin diff 0<diff<1
  }
};
