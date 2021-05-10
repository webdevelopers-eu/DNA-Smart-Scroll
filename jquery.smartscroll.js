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

    let $parents = $(el).parents();
    let view = getView();
    let blockingObjects = view.blockingObjects;
    let antiLoop = [];

    scroll(el, getDiffY(param, el.getBoundingClientRect(), view))
	.done(function() { // test at the end if conditions changed
	    scroll(el, getDiffY(param, el.getBoundingClientRect(), getView(/*blockingObjects*/)));
	})
	.fail(function() {
	    console.warn('SmartScroll: Scrolling interrupted.');
	});

    return this;

    function scroll(el, diffY) {
	if (!diffY || antiLoop.indexOf(diffY) != -1) {
	    console.log("SmartScroll: loop detected %s => %o", diffY, antiLoop);
	    return $.when(); // loop?
	}
	antiLoop.push(diffY);

	console.log("SmartScroll: scroll(%s, %s), anti loop %o", el.tagName || 'window', diffY, antiLoop);
	let dfds = [];

	var box = el.offsetParent;
	while (box && diffY) {
	    let style = window.getComputedStyle(box, null);
	    let overflow = window.getComputedStyle(box, null).overflowY;
	    if (overflow == 'auto' || overflow == 'scroll' /* || overflow == 'visible' */ || box.scrollTop) { // scrollable?
		let currY = box.scrollTop;
		let maxScrollY = box.scrollHeight - box.clientHeight;
		let changeY = Math.max(-currY, Math.min(diffY, maxScrollY - currY));
		diffY -= changeY;
		dfds.push(animate(box, Math.max(0, currY + changeY), changeY));
	    }
	    box = box.offsetParent || box.parentElement;
	}

	if (diffY) { // reminder
	    dfds.push(animate(window, Math.max(0, window.scrollY + diffY), diffY));
	}

	return $.when.apply($, dfds);
    }

    function getView(blockingObjects) {
	blockingObjects = blockingObjects || findBlockingObjects();
	let view = new DOMRect(0, 0, $(window).width(), $(window).height());
	let screenView = view;

	for (var i = 0; i < blockingObjects.length; i++) {
	    let child = blockingObjects[i];
	    view = trimView(screenView, view, child);
	}

	view.blockingObjects = blockingObjects;
	return view;
    }

    function findBlockingObjects() {
	let blockingObjects = [];

	// fixed
	let all = document.body.getElementsByTagName("*");
	for (var i = 0; i < all.length; i++) {
	    let child = all[i];
	    let style = window.getComputedStyle(child, null);
	    let position = style.getPropertyValue('position');

	    if (position == 'fixed') {
		blockingObjects.push(child);
	    } else if (position == 'sticky' && $parents.is(child.parentNode)) {
		blockingObjects.push(child);
	    }
	}

	return blockingObjects;
    }

    function trimView(screenView, view, overlay) {
	let ret = view;
	let rect = overlay.getBoundingClientRect();

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
    function animate(el, top, diffY) {
	let dfd = $.Deferred();
	let speed = 1000; // Math.min(1000, Math.abs(diffY) / window.innerHeight * 1000); // speed one screen per 3 second
	let userInterrupt = $.fn.smartScroll.userInterrupt;
	let from = el.scrollTop || el.scrollY || 0;

	if (from == top) return dfd.resolve();

	// console.log('SmartScroll: Animating %s -> %s (diff %s), speed %s (target %o)', from, top, diffY, speed, el);
	// el.scrollTo({top: top, behavior: 'smooth'});
	$(el instanceof Window ? 'body, html' : el)
	    .animate({"scrollTop": top}, {
		"progress": function(anim, progress, remainingMs) {
		    if (userInterrupt != $.fn.smartScroll.userInterrupt) {
			$(this).stop();
			dfd.reject();
		    }
		},
		"complete": function() {dfd.resolve();},
		"duration": speed
	    });

	return dfd;
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

	return diffY;
    }
};

// To abort scrolling on user initiated scroll
$.fn.smartScroll.userInterrupt = 0;
$('html, body')
    .on("scroll mousedown wheel DOMMouseScroll mousewheel keyup touchmove", function(){
	$.fn.smartScroll.userInterrupt++;
    });
