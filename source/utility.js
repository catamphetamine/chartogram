export function clearElement(element) {
	while(element.firstChild) {
		element.removeChild(element.firstChild)
	}
}

export function commaJoin(a, b) {
	return a.map((ai, i) => `${ai},${b[i]}`)
}

export function getLowerSiblingDivisibleBy(n, divider) {
	n = Math.floor(n)
	while (true) {
		if (n < divider) {
			return divider
		}
		if (n % divider === 0) {
			return n
		}
		n--
	}
}

export function divideInterval(min, max, GAUGE_TICK_MARKS_COUNT) {
	const points = new Array(GAUGE_TICK_MARKS_COUNT)
	let i = 0
	while (i < GAUGE_TICK_MARKS_COUNT) {
		points[i] = min + i * (max - min) / (GAUGE_TICK_MARKS_COUNT - 1)
		i++
	}
	return points
}

export function throttle(func, interval) {
	let timeout
	let executedAt = 0
	let scheduled = function() {
		timeout = undefined
		executedAt = Date.now()
		func()
	}
	return function() {
		const now = Date.now()
		const remaining = interval - (now - executedAt)
		if (remaining <= 0) {
			if (timeout) {
				clearTimeout(timeout)
				timeout = undefined
			}
			executedAt = now
			func()
		} else if (!timeout) {
			timeout = setTimeout(scheduled, remaining)
		}
	}
}

export function simplifyGraph(x, y, maxPoints, yMax = Math.max(...y), threshold = 0.025, i = 0, _x = new Array(x.length), _y = new Array(x.length), _i = 0) {
	if (i + 2 > x.length - 1) {
		while (i < y.length) {
			_x[_i] = x[i]
			_y[_i] = y[i]
			_i++
			i++
		}
		_x = _x.slice(0, _i)
		_y = _y.slice(0, _i)
		if (_x.length <= maxPoints) {
			return [_x, _y]
		} else {
			if (x.length / _x.length < 1.1) {
				threshold = Math.min(threshold + 0.025, 1)
			}
			return simplifyGraph(_x, _y, maxPoints, yMax, threshold)
		}
	}
	const y0 = (y[i + 2] + y[i]) / 2
	if (Math.abs(y0 - y[i + 1]) / yMax < threshold) {
		_x[_i] = x[i]
		_x[_i + 1] = x[i + 2]
		_y[_i] = y[i]
		_y[_i + 1] = y[i + 2]
		return simplifyGraph(x, y, maxPoints, yMax, threshold, i + 2, _x, _y, _i + 1)
	} else {
		_x[_i] = x[i]
		_x[_i + 1] = x[i + 1]
		_x[_i + 2] = x[i + 2]
		_y[_i] = y[i]
		_y[_i + 1] = y[i + 1]
		_y[_i + 2] = y[i + 2]
		return simplifyGraph(x, y, maxPoints, yMax, threshold, i + 2, _x, _y, _i + 2)
	}
}

export function setUpDrag(element, onDragStart, onDrag) {
	function onTouchMove(event) {
		onDrag(
			event.changedTouches[0].clientX,
			event.changedTouches[0].clientY
		)
	}
	function onPointerMove(event) {
		onDrag(event.clientX, event.clientY)
	}
	function onDragStop() {
		window.removeEventListener('pointermove', onPointerMove)
		window.removeEventListener('touchmove', onTouchMove)
		window.removeEventListener('pointerup', onDragStop)
		window.removeEventListener('pointercancel', onDragStop)
		window.removeEventListener('touchend', onDragStop)
		window.removeEventListener('touchcancel', onDragStop)
	}
	function onTouchStart(event) {
		// Ignore multitouch.
		if (event.touches.length > 1) {
			// Reset.
			return onDragStop()
		}
		onDragStart(
			event.changedTouches[0].clientX,
			event.changedTouches[0].clientY
		)
		window.addEventListener('touchmove', onTouchMove)
		window.addEventListener('touchend', onDragStop)
		window.addEventListener('touchcancel', onDragStop)
	}
	// Safari doesn't support pointer events.
	// https://caniuse.com/#feat=pointer
	element.addEventListener('touchstart', onTouchStart)
	function onPointerDown(event) {
		onDragStart(event.clientX, event.clientY)
		window.addEventListener('pointermove', onPointerMove)
		window.addEventListener('pointerup', onDragStop)
		window.addEventListener('pointercancel', onDragStop)
	}
	element.addEventListener('pointerdown', onPointerDown)
	return () => {
		onDragStop()
		element.removeEventListener(onPointerDown)
		element.removeEventListener(onTouchStart)
	}
}

export function setUpTouchMove(element, _onTrackStart, _onTrack, _onTrackStop) {
	let elementBounds
	function onTrack(x, y) {
		_onTrack(x, y, elementBounds)
	}
	function onTrackStart() {
		elementBounds = element.getBoundingClientRect()
		_onTrackStart()
	}
	function onTouchStart(event) {
		// Ignore multitouch.
		if (event.touches.length > 1) {
			// Reset.
			return onTrackStop()
		}
		onTrackStart()
		element.addEventListener('touchend', onTrackStop)
		element.addEventListener('touchmove', onTouchMove)
		element.addEventListener('touchend', onTrackStop)
		element.addEventListener('touchcancel', onTrackStop)
		onTouchMove(event)
	}
	// Safari doesn't support pointer events.
	// https://caniuse.com/#feat=pointer
	element.addEventListener('touchstart', onTouchStart)
	function onTouchMove(event) {
		const x = event.changedTouches[0].clientX
		const y = event.changedTouches[0].clientY
		// Emulate 'pointerleave' behavior.
		if (x < elementBounds.left ||
			x > elementBounds.left + elementBounds.width ||
			y < elementBounds.top ||
			y > elementBounds.top + elementBounds.height) {
			onTrackStop()
		} else {
			onTrack(x, y)
		}
	}
	function onPointerMove(event) {
		onTrack(event.clientX, event.clientY)
	}
	function onTrackStop() {
		element.removeEventListener('pointermove', onPointerMove)
		element.removeEventListener('pointerleave', onTrackStop)
		element.removeEventListener('pointercancel', onTrackStop)
		element.removeEventListener('touchmove', onTouchMove)
		element.removeEventListener('touchend', onTrackStop)
		element.removeEventListener('touchcancel', onTrackStop)
		_onTrackStop()
	}
	function onPointerEnter() {
		onTrackStart()
		element.addEventListener('pointermove', onPointerMove)
		element.addEventListener('pointerleave', onTrackStop)
		element.addEventListener('pointercancel', onTrackStop)
	}
	element.addEventListener('pointerenter', onPointerEnter)
	return () => {
		onTrackStop()
		element.removeEventListener(onPointerEnter)
		element.removeEventListener(onTouchStart)
	}
}