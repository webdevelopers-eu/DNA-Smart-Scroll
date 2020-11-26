# DNA-Smart-Scroll
Scroll any element into view while honoring the fixed and sticky positioned elements on the screen.

# Usage

`$(anyElement).smartScroll();`

Really, that's it. It will scroll the element into visible view if
needed. If the element is already visible then it will do nothing.

`$(anyElement).smartScroll("start");`

This will make sure that the top part of the element is visible.

`$(anyElement).smartScroll("end");`

Guess what the "end" will do.

`$(anyElement).smartScroll(new DOMRect(100, 100, 200, 10));`

Scroll this `DOMRect(x, y, width, height)` into view by scrolling
`anyElement` or its parents if they are scrollable.
