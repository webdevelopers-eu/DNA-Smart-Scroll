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
    const view = getView(el);
    // $('<div class="smart-scroll-debug" style="background: rgba(255,0,0,0.2); position: fixed;"></div>').appendTo('body').css({
    // "top": view.top,
    // "left": view.left,
    // "height": view.height + "px",
    // "width": view.width + "px"
    // });
    const objRect = el.getBoundingClientRect();
    let rect;

    if (param == 'start') {
	rect = new DOMRect(objRect.x, objRect.y, objRect.width, view.height);
    } else if (param == 'end') {
	rect = new DOMRect(objRect.x, objRect.bottom - view.height, objRect.width, view.height);
    } else {
	rect = param instanceof DOMRect ? param : objRect;
    }

    let newY = 0;
    if (Math.floor(rect.top) >= Math.floor(view.top) && Math.floor(rect.bottom) >= Math.floor(view.bottom)) {
	// scroll up - align top to top
	scroll(el, rect.top - Math.max(view.top, view.bottom - rect.height));
    } else if (Math.floor(rect.top) <= Math.floor(view.top) && Math.floor(rect.bottom) <= Math.floor(view.bottom)) {
	// scroll down - align bottom to bottom (for editor when focusing on bottom line it would scroll it down bellow screen)
	scroll(el, rect.bottom - view.bottom);
    } else {
	// it spans the whole screen so we don't know where to
	// scroll. User should use some small anchor then this large
	// elment when calling $.fn.smartScroll()
	console.log('SmartScroll: Not sure where to scroll. Element %o is too big for viewport %o', el, view);
    }
    // console.log("Scroll: Plan %s -> %s, view %o, element %o", rect.top, newY, view, el);
    return this;

    function scroll(el, diffY) {
	var box = el.offsetParent;
	while (box && diffY) {
	    const style = window.getComputedStyle(box, null);
	    const overflow = window.getComputedStyle(box, null).overflowY;
	    if (overflow == 'auto' || overflow == 'scroll') {
		const currY = box.scrollTop;
		const maxScrollY = box.scrollHeight - box.offsetHeight;
		const changeY = Math.min(diffY, maxScrollY - currY);
		diffY -= changeY;
		console.log('SmartScroll: Animating %s -> %s, %o', el.scrollTop, currY + changeY, el);
		box.scrollTo({
		    top: Math.max(0, currY + changeY),
		    behavior: 'smooth'
		});
	    }
	    box = box.offsetParent || box.parentElement;
	}

	if (diffY) { // last resort
	    window.scroll({
		top: Math.max(0, window.scrollY + diffY),
		behavior: 'smooth'
	    });
	}
    }

    function getView(el) {
	let view = new DOMRect(0, 0, $(window).width(), $(window).height());
	let screenView = view;

	// fixed
	const all = document.body.getElementsByTagName("*");
	for (var i = 0; i < all.length; i++) {
	    const child = all[i];
	    const style = window.getComputedStyle(child, null);
	    if (style.getPropertyValue('position') == 'fixed') {
		// console.log("Scroll: Fixed: %o", child);
		view = trim(screenView, view, child);
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
		}
	    }
	}

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
};
