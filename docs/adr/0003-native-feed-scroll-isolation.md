# Keep Feed Scrolling Independent of Main-Thread Work

The Feed Panel uses native overflow scrolling. Its scroll container already declares `overscroll-behavior-y: contain` and `touch-action: pan-y pinch-zoom`; these CSS rules own boundary containment. Do not install cancelable wheel or touchmove handlers on the topic scrolling area solely to prevent scroll chaining into the underlying page.

A non-passive wheel handler can make the first input in a scroll gesture wait for the main thread, even when the handler itself is inexpensive. This couples scrolling to unrelated Discourse message-bus/rendering work. Removing that handler reduces this coupling without changing feed queries, loaded depth, retention, or head/away reading-state rules.

Passive scroll listeners still update the head action and request older topics near the bottom. Those callbacks, new content loading, and other page JavaScript must wait while the main thread is blocked; native scrolling only keeps already-rendered content movable. The category tab bar retains its separate vertical-wheel-to-horizontal mapping, which still requires JavaScript.

The regression check in `tools/check-scroll-isolation.py` extracts the actual scroll setup and CSS into an isolated Chrome fixture. It checks native wheel/touch boundaries (including content shorter than the viewport), loading after listener rebinding, absence of the renderer-main acknowledgement on the first wheel, and continued scrolling during a controlled main-thread block. Continuous scrolling alone is not sufficient evidence: Chrome may allow an already-started gesture to continue even with the old non-passive handler.
