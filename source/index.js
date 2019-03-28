export default function chartogram(rootNode, data, title = 'Title', options = {}) {
	// clearElement(rootNode)
	rootNode.innerHTML = `
		<header class="chartogram__header">
			<h1 class="chartogram__title">${title}</h1>
		</header>
		<div class="chartogram__plan-with-axes">
			<div class="chartogram__plan">
				<div class="chartogram__top-border"></div>
				<div class="chartogram__canvas-wrapper">
					<svg class="chartogram__canvas" preserveAspectRatio="none"></svg>
					<div class="chartogram__x"></div>
					<div class="chartogram__y-wrapper">
						<div class="chartogram__y"></div>
					</div>
				</div>
			</div>
		</div>
		<div class="chartogram__timeline">
			<div class="chartogram__timeline-canvas-padding">
				<svg class="chartogram__timeline-canvas" preserveAspectRatio="none"></svg>
			</div>
			<div class="chartogram__timeline-overlay-left"></div>
			<div class="chartogram__timeline-overlay-right"></div>
			<div class="chartogram__timeline-window">
				<button type="button" class="chartogram__reset-button chartogram__timeline-window__drag"></button>
				<button type="button" class="chartogram__reset-button chartogram__timeline-window__left-handle"></button>
				<button type="button" class="chartogram__reset-button chartogram__timeline-window__right-handle"></button>
			</div>
		</div>
		<div class="chartogram__chart-togglers"></div>
	`

	rootNode.classList.add('chartogram')

	const GAUGE_TICK_MARKS_COUNT = options.gaugeMarkTicksCount || 6
	const TIMELINE_WINDOW_SIZE = options.timelineWindowSize || 40
	const TIMELINE_CHART_MAX_POINTS = options.timelineChartMaxPoints || 80

	const MONTHS = options.months || [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	]

	const WEEKDAYS = options.weekdays || [
		'Sun',
		'Mon',
		'Tue',
		'Wed',
		'Thu',
		'Fri',
		'Sat'
	]

	const tooltipContainer = document.querySelector('.chartogram__plan')
	const canvas = document.querySelector('.chartogram__canvas')
	const canvasWrapper = document.querySelector('.chartogram__canvas-wrapper')
	const xAxis = document.querySelector('.chartogram__x')
	const yAxis = document.querySelector('.chartogram__y')
	const timeline = document.querySelector('.chartogram__timeline')
	const timelineOverlayLeft = document.querySelector('.chartogram__timeline-overlay-left')
	const timelineWindowLeftHandle = document.querySelector('.chartogram__timeline-window__left-handle')
	const timelineWindow = document.querySelector('.chartogram__timeline-window')
	const timelineWindowDrag = document.querySelector('.chartogram__timeline-window__drag')
	const timelineWindowRightHandle = document.querySelector('.chartogram__timeline-window__right-handle')
	const timelineOverlayRight = document.querySelector('.chartogram__timeline-overlay-right')
	const timelineCanvas = document.querySelector('.chartogram__timeline-canvas')

	let timelineWindowFrom
	let timelineWindowTo
	let showGraphs
	let showGraphsNext
	let timelineWindowGraphs
	let timelineWindowMinX
	let timelineWindowMaxX
	let timelineWindowMinY
	let timelineWindowMaxY
	let timelineWindowX
	let tooltip
	let tooltipDate
	let tooltipValues
	let tooltipForX
	let tooltipPoints
	let tooltipLine

	// A stub for possible animations.
	let yScale = 1

	setUpTimelineWindowHandle('left')
	setUpTimelineWindowHandle('right')
	setUpTimelineWindow()

	normalizeDataPoints()
	displayGraphs()
	setUpCanvas()

	function clearElement(element) {
		while(element.firstChild) {
			element.removeChild(element.firstChild)
		}
	}

	function commaJoin(a, b) {
		return a.map((ai, i) => `${ai},${b[i]}`)
	}

	function createPolylinePoints(x, y) {
		// return commaJoin(x, y)
		return commaJoin(x.map(fixSvgCoordinate), y.map(fixSvgCoordinate))
	}

	// Firefox is buggy with too high and too fractional SVG coordinates.
	function fixSvgCoordinate(x) {
		return Math.round(x * Number.MAX_SAFE_INTEGER) / Number.MAX_SAFE_INTEGER
	}

	function getLowerSiblingDivisibleBy(n, divider) {
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

	function divideInterval(min, max) {
		const points = new Array(GAUGE_TICK_MARKS_COUNT)
		let i = 0
		while (i < GAUGE_TICK_MARKS_COUNT) {
			points[i] = min + i * (max - min) / (GAUGE_TICK_MARKS_COUNT - 1)
			i++
		}
		return points
	}

	function drawGauge(element, min, max, transform) {
		let i = 0
		while (i < GAUGE_TICK_MARKS_COUNT) {
			const tickMark = document.createElement('div')
			let value = min + i * (max - min) / (GAUGE_TICK_MARKS_COUNT - 1)
			if (transform) {
				value = transform(value)
			}
			tickMark.appendChild(document.createTextNode(value))
			element.appendChild(tickMark)
			i++
		}
	}

	// Chrome and Firefox can't handle timestamps in milliseconds for point coordinates (draws nothing).
	// Reducing timestamps to lower numbers to work around that bug.
	function normalizeDataPoints() {
		normalizePoints([data.x])
		normalizePoints(data.y)
	}

	function normalizePoints(all) {
		const isX = all[0] === data.x
		let min = Infinity
		let max = -Infinity
		for (const one of all) {
			if (isX) {
				one.min = one.points[0]
				one.max = one.points[one.points.length - 1]
			} else {
				// For Y min is always 0 by design.
				one.min = 0
				// one.min = Math.min(...one.points)
				one.max = Math.max(...one.points)
			}
			min = Math.min(min, one.min)
			max = Math.max(max, one.max)
		}
		// For Y min is always 0 by design.
		if (!isX) {
			min = 0
		}
		const shift = min
		const scale = max - min
		for (const one of all) {
			one.normalized = {
				points: one.points.map(_ => (_ - shift) / scale),
				shift,
				scale
			}
		}
	}

	function displayGraphs() {
		showGraphs = {}
		for (const y of data.y) {
			showGraphs[y.id] = true
		}
		showGraphsNext = undefined
		if (data.x.points.length > TIMELINE_WINDOW_SIZE) {
			const xMin = data.x.points[0]
			const xMax = data.x.points[data.x.points.length - 1]
			const xFrom = data.x.points[data.x.points.length - TIMELINE_WINDOW_SIZE]
			timelineWindowFrom = (xFrom - xMin) / (xMax - xMin)
		} else {
			timelineWindowFrom = 0
		}
		timelineWindowTo = 1
		updateTimelineWindow()
		drawGraphs(true)
		tooltipLine = undefined
		// Add graph togglers.
		const graphTogglers = document.querySelector('.chartogram__chart-togglers')
		clearElement(graphTogglers)
		for (const y of data.y) {
			graphTogglers.appendChild(createGraphToggler(y))
		}
	}

	function drawGraphs(redrawTimeline) {
		// Clear canvas.
		clearElement(canvas)
		// Calculate bounds.
		const xPoints = data.x.points
		const minXOverall = xPoints[0]
		const maxXOverall = xPoints[xPoints.length - 1]
		const deltaX = maxXOverall - minXOverall
		const minX = minXOverall + timelineWindowFrom * deltaX
		const maxX = maxXOverall - (1 - timelineWindowTo) * deltaX
		let minXIndex = xPoints.findIndex(x => x > minX) - 1
		if (minXIndex < 0) {
			minXIndex = 0
		}
		let maxXIndex = xPoints.findIndex(x => x > maxX)
		if (maxXIndex < 0) {
			maxXIndex = xPoints.length - 1
		}
		timelineWindowX = data.x.normalized.points.slice(minXIndex, maxXIndex + 1)
		// let minY = Infinity
		// Min Y is always 0 by design.
		const minY = 0
		let maxY = -Infinity
		timelineWindowGraphs = []
		for (const y of data.y) {
			if (!showGraphs[y.id]) {
				continue
			}
			const points = y.points.slice(minXIndex, maxXIndex + 1)
			// Min Y is always 0 by design.
			const min = 0
			// const min = Math.min(...points)
			const max = Math.max(...points)
			timelineWindowGraphs.push({
				...y,
				points,
				min,
				max,
				normalized: {
					...y.normalized,
					points: y.normalized.points.slice(minXIndex, maxXIndex + 1)
				}
			})
			// minY = Math.min(minY, ...points)
			maxY = Math.max(maxY, ...points)
		}
		// Set canvas `viewBox`.
		const minXNormalized = (minX - data.x.normalized.shift) / data.x.normalized.scale
		const maxXNormalized = (maxX - data.x.normalized.shift) / data.x.normalized.scale
		const minYNormalized = (minY - data.y[0].normalized.shift) / data.y[0].normalized.scale
		const maxYNormalized = (maxY - data.y[0].normalized.shift) / data.y[0].normalized.scale
		canvas.setAttribute('viewBox', `${minXNormalized} ${minYNormalized} ${maxXNormalized - minXNormalized} ${maxYNormalized - minYNormalized}`)
		// Calculate grid lines' coordinates.
		const minY_ = 0
		const maxY_ = getLowerSiblingDivisibleBy(maxY, 10)
		const yAxisScale = (maxY - minY) / (maxY_ - minY)
		const yAxisTickMarks = divideInterval(minY_, maxY_)
		// Draw grid lines.
		for (const y of yAxisTickMarks) {
			canvas.appendChild(createGridLine(
				(y - data.y[0].normalized.shift) / data.y[0].normalized.scale,
				minXNormalized,
				maxXNormalized,
				minYNormalized,
				maxYNormalized
			))
		}
		// Trim X axis.
		const _x = timelineWindowX.slice()
		const _minX = _x[0]
		const _maxX = _x[_x.length - 1]
		const trimLeftRatio = (minXNormalized - _minX) / (_x[1] - _minX)
		const trimRightRatio = (_maxX - maxXNormalized) / (_maxX - _x[_x.length - 2])
		_x[0] = minXNormalized
		_x[_x.length - 1] = maxXNormalized
		// Draw charts.
		for (const { id, color, normalized: { points } } of timelineWindowGraphs) {
			// Trim chart.
			const _y = points.slice()
			const _minY = _y[0]
			const _maxY = _y[_y.length - 1]
			_y[0] = _minY + (_y[1] - _minY) * trimLeftRatio
			_y[_y.length - 1] = _maxY - (_maxY - _y[_y.length - 2]) * trimRightRatio
			// Draw chart.
			const graph = document.createElement('polyline')
			graph.setAttribute('stroke', color)
			graph.setAttribute('points', createPolylinePoints(_x, _y.map(y => maxYNormalized - yScale * y)).join(' '))
			graph.classList.add('chartogram__graph')
			canvas.appendChild(graph)
		}
		// A workaround to fix WebKit bug when it's not re-rendering the <svg/>.
		// https://stackoverflow.com/questions/30905493/how-to-force-webkit-to-update-svg-use-elements-after-changes-to-original
		canvas.innerHTML += ''
		// Draw gauges.
		drawGauges(
			minX,
			maxX,
			minY_,
			maxY_,
			yAxisScale
		)
		// Draw timeline graph.
		timelineWindowMinY = minYNormalized
		timelineWindowMaxY = maxYNormalized
		timelineWindowMinX = minXNormalized
		timelineWindowMaxX = maxXNormalized
		if (redrawTimeline) {
			drawTimeline()
		}
	}

	// function animateScale(scale) {
	// 	console.log(scale)
	// 	animateScaleTo = scale
	// 	animateScaleStartedAt = Date.now()
	// 	previousYScale = yScale
	// 	requestAnimationFrame(animateScaleTick)
	// }

	// function animateScaleTick() {
	// 	const elapsed = Date.now() - animateScaleStartedAt
	// 	yScale = previousYScale + (animateScaleTo - previousYScale) * elapsed / 300
	// 	drawGraphs(true)
	// 	if (elapsed < 300) {
	// 		requestAnimationFrame(animateScaleTick)
	// 	}
	// }

	function createGridLine(y, minX, maxX, minY, maxY) {
		const line = document.createElement('line')
		line.classList.add('chartogram__grid-line')
		line.setAttribute('x1', fixSvgCoordinate(minX))
		line.setAttribute('x2', fixSvgCoordinate(maxX))
		line.setAttribute('y1', fixSvgCoordinate((maxY - minY) - y))
		line.setAttribute('y2', fixSvgCoordinate((maxY - minY) - y))
		return line
	}

	function drawGauges(minX, maxX, minY, maxY, yAxisScale) {
		clearElement(xAxis)
		clearElement(yAxis)
		drawGauge(xAxis, minX, maxX, (timestamp) => {
			const date = new Date(timestamp)
			return `${MONTHS[date.getMonth()]} ${date.getDate()}`
		})
		drawGauge(yAxis, minY, maxY)
		yAxis.style.height = `${100 / yAxisScale}%`
	}

	function simplifyGraph(x, y, maxPoints, yMax = Math.max(...y), threshold = 0.025, i = 0, _x = new Array(x.length), _y = new Array(x.length), _i = 0) {
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

	function drawTimeline() {
		const x = data.x.normalized.points
		const graphs = data.y.filter(_ => showGraphs[_.id])
		const minX = 0
		const maxX = 1
		const minY = (Math.min(...graphs.map(_ => _.min)) - graphs[0].normalized.shift)  / graphs[0].normalized.scale
		const maxY = (Math.max(...graphs.map(_ => _.max)) - graphs[0].normalized.shift)  / graphs[0].normalized.scale
		clearElement(timelineCanvas)
		// Set canvas `viewBox`.
		timelineCanvas.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`)
		for (const { id, color, normalized: { points } } of graphs) {
			const [_x, _y] = simplifyGraph(x, points, 80)
			const graph = document.createElement('polyline')
			graph.setAttribute('stroke', color)
			graph.setAttribute('points', createPolylinePoints(_x, _y.map(y => (maxY - minY) - y)).join(' '))
			graph.classList.add('chartogram__graph')
			timelineCanvas.appendChild(graph)
		}
		// A workaround to fix WebKit bug when it's not re-rendering the <svg/>.
		// https://stackoverflow.com/questions/30905493/how-to-force-webkit-to-update-svg-use-elements-after-changes-to-original
		timelineCanvas.innerHTML += ''
	}

	function createGraphToggler({ id, name, color }) {
		const toggler = document.createElement('button')
		toggler.setAttribute('type', 'button')
		toggler.classList.add('chartogram__chart-toggler')
      toggler.classList.add('chartogram__chart-toggler--on')
		toggler.classList.add('chartogram__reset-button')
		// Add check.
		const xmlns = 'http://www.w3.org/2000/svg'
      const check = document.createElementNS(xmlns, 'svg')
      check.setAttributeNS(null, 'viewBox', '0 0 19 19')
      check.classList.add('chartogram__chart-toggler-check')
      // Add background circle.
      const backgroundCircle = document.createElementNS(xmlns, 'circle')
      backgroundCircle.setAttribute('cx', '9.5')
      backgroundCircle.setAttribute('cy', '9.5')
      backgroundCircle.setAttribute('r', '9.5')
      backgroundCircle.setAttribute('fill', color)
      check.appendChild(backgroundCircle)
      // Add check circle.
      const checkCircle = document.createElementNS(xmlns, 'circle')
      checkCircle.setAttribute('cx', '9.5')
      checkCircle.setAttribute('cy', '9.5')
      checkCircle.setAttribute('r', '8')
      checkCircle.classList.add('chartogram__chart-toggler-check-circle')
      check.appendChild(checkCircle)
      // Add check mark.
      const checkMark = document.createElementNS(xmlns, 'path')
      checkMark.setAttribute('d', 'M13.64 4.94l-6.2 6.34-1.69-1.9c-.73-.63-1.89.1-1.36 1.06l2 3.38c.3.43 1.04.85 1.78 0 .32-.42 6.31-7.93 6.31-7.93.74-.84-.2-1.58-.84-.95z')
      checkMark.setAttribute('fill', 'white')
      checkMark.classList.add('chartogram__chart-toggler-check-mark')
      check.appendChild(checkMark)
		// Add checkmark.
		toggler.appendChild(check)
		// Add graph name.
		toggler.appendChild(document.createTextNode(name))
		// On click.
		toggler.addEventListener('click', () => {
			const show = !showGraphs[id]
			// Won't allow hiding all graphs.
			if (!show) {
				const graphsShown = Object.keys(showGraphs).filter(id => showGraphs[id] !== false).length
				if (graphsShown === 1) {
					return
				}
			}
			showGraphs[id] = show
			drawGraphs(true)
			toggler.classList.toggle('chartogram__chart-toggler--on')
		})
		return toggler
	}

	function getMaxY(graphs) {
		let maxY = 0
		for (const graph of graphs) {
			maxY = Math.max(maxY, ...graph.points)
		}
		return maxY
	}

	function setUpTimelineWindowHandle(side) {
		const handle = side === 'left' ? timelineWindowLeftHandle : timelineWindowRightHandle
		let handleWidth = parseFloat(getComputedStyle(timelineWindow).borderLeftWidth)
		let timelineCoordinates
		let minX
		let maxX
		let deltaX
		let startedX
		function onDrag(x) {
			x = x - deltaX
			x = Math.max(Math.min(x, maxX), minX)
			x = (x - timelineCoordinates.x) / timelineCoordinates.width
			if (side === 'left') {
				timelineWindowFrom = x
			} else {
				timelineWindowTo = x
			}
			updateTimelineWindow()
		}
		function onDragStart(x) {
			timelineCoordinates = timeline.getBoundingClientRect()
			const timelineWindowCoordinates = timelineWindow.getBoundingClientRect()
			if (side === 'left') {
				minX = timelineCoordinates.x
				maxX = timelineWindowCoordinates.x + timelineWindowCoordinates.width - 2 * handleWidth
				deltaX = x - timelineWindowCoordinates.x
			} else {
				minX = timelineWindowCoordinates.x + 2 * handleWidth
				maxX = timelineCoordinates.x + timelineCoordinates.width
				deltaX = x - (timelineWindowCoordinates.x + timelineWindowCoordinates.width)
			}
		}
		return setUpDrag(handle, onDragStart, onDrag)
	}

	function setUpTimelineWindow() {
		let timelineCoordinates
		let timelineWindowCoordinates
		let minX
		let maxX
		let innerX
		function onDrag(x) {
			x = x - innerX
			x = Math.max(Math.min(x, maxX), minX)
			x = (x - timelineCoordinates.x) / timelineCoordinates.width
			timelineWindowFrom = x
			timelineWindowTo = x + timelineWindowCoordinates.width / timelineCoordinates.width
			updateTimelineWindow()
		}
		function onDragStart(x) {
			timelineCoordinates = timeline.getBoundingClientRect()
			timelineWindowCoordinates = timelineWindow.getBoundingClientRect()
			innerX = x - timelineWindowCoordinates.x
			minX = timelineCoordinates.x
			maxX = timelineCoordinates.x + (timelineCoordinates.width - timelineWindowCoordinates.width)
		}
		return setUpDrag(timelineWindowDrag, onDragStart, onDrag)
	}

	function setUpDrag(element, onDragStart, onDrag) {
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

	function setTimelineWindowLeft(x) {
		timelineOverlayLeft.style.right = `${100 * (1 - x)}%`
		timelineWindow.style.left = `${100 * x}%`
	}

	function setTimelineWindowRight(x) {
		timelineOverlayRight.style.left = `${100 * x}%`
		timelineWindow.style.right = `${100 * (1 - x)}%`
	}

	function updateTimelineWindow() {
		setTimelineWindowLeft(timelineWindowFrom)
		setTimelineWindowRight(timelineWindowTo)
		drawGraphs(false)
	}

	function setUpCanvas() {
		let canvasDimensions
		let isIndexInBounds
		function onTrack(screenX) {
			const xScreenRatio = (screenX - canvasDimensions.x) / canvasDimensions.width
			let x = timelineWindowMinX + xScreenRatio * (timelineWindowMaxX - timelineWindowMinX)
			let xHigherIndex = timelineWindowX.findIndex(_ => _ >= x)
			let xLowerIndex = xHigherIndex - 1
			if (!isIndexInBounds(xHigherIndex)) {
				xHigherIndex = -1
			}
			if (!isIndexInBounds(xLowerIndex)) {
				xLowerIndex = -1
			}
			if (xHigherIndex < 0) {
				if (xLowerIndex < 0) {
					return removeTooltip()
				} else {
					x = timelineWindowX[xLowerIndex]
				}
			} else {
				if (xLowerIndex < 0) {
					x = timelineWindowX[xHigherIndex]
				} else {
					const xLower = timelineWindowX[xLowerIndex]
					const xHigher = timelineWindowX[xHigherIndex]
					const deltaLower = x - xLower
					const deltaHigher = xHigher - x
					x = deltaLower > deltaHigher ? xHigher : xLower
				}
			}
			if (x !== tooltipForX) {
				tooltipForX = x
				if (!tooltip) {
					addTooltip()
				}
				const date = new Date(x * data.x.normalized.scale + data.x.normalized.shift)
				tooltipDate.textContent = `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`
				const xIndex = timelineWindowX.indexOf(x)
				let i = 0
				while (2 * i < tooltipValues.childNodes.length) {
					tooltipValues.childNodes[2 * i].textContent = timelineWindowGraphs[i].points[xIndex]
					tooltipValues.childNodes[2 * i + 1].textContent = data.y[i].name
					i++
				}
				const xRatio = (x - timelineWindowMinX) / (timelineWindowMaxX - timelineWindowMinX)
				tooltip.style.left = `${xRatio * 100}%`
				updateTooltipPoints(xIndex, xRatio)
				updateTooltipLine(x)
			}
		}
		function onTrackStart() {
			canvasDimensions = canvas.getBoundingClientRect()
			isIndexInBounds = (index) => {
				if (index < 0) {
					return false
				}
				return timelineWindowX[index] >= timelineWindowMinX &&
						timelineWindowX[index] <= timelineWindowMaxX
			}
		}
		function onTouchStart(event) {
			// Ignore multitouch.
			if (event.touches.length > 1) {
				// Reset.
				return onTrackStop()
			}
			onTrackStart()
			canvas.addEventListener('touchend', onTrackStop)
			canvas.addEventListener('touchmove', onTouchMove)
			canvas.addEventListener('touchend', onTrackStop)
			canvas.addEventListener('touchcancel', onTrackStop)
			onTouchMove(event)
		}
		// Safari doesn't support pointer events.
		// https://caniuse.com/#feat=pointer
		canvas.addEventListener('touchstart', onTouchStart)
		function onTouchMove(event) {
			const x = event.changedTouches[0].clientX
			const y = event.changedTouches[0].clientY
			// Emulate 'pointerleave' behavior.
			if (x < canvasDimensions.x ||
				x > canvasDimensions.x + canvasDimensions.width ||
				y < canvasDimensions.y ||
				y > canvasDimensions.y + canvasDimensions.height) {
				onTrackStop()
			} else {
				onTrack(x, y)
			}
		}
		function onPointerMove(event) {
			onTrack(event.clientX, event.clientY)
		}
		function onTrackStop() {
			canvas.removeEventListener('pointermove', onPointerMove)
			canvas.removeEventListener('pointerleave', onTrackStop)
			canvas.removeEventListener('pointercancel', onTrackStop)
			canvas.removeEventListener('touchmove', onTouchMove)
			canvas.removeEventListener('touchend', onTrackStop)
			canvas.removeEventListener('touchcancel', onTrackStop)
			removeTooltip()
		}
		function onPointerEnter() {
			onTrackStart()
			canvas.addEventListener('pointermove', onPointerMove)
			canvas.addEventListener('pointerleave', onTrackStop)
			canvas.addEventListener('pointercancel', onTrackStop)
		}
		canvas.addEventListener('pointerenter', onPointerEnter)
		return () => {
			onTrackStop()
			canvas.removeEventListener(onPointerEnter)
			canvas.removeEventListener(onTouchStart)
		}
	}

	function addTooltip() {
		// Create tooltip.
		tooltip = document.createElement('div')
		tooltip.classList.add('chartogram__tooltip')
		tooltipContainer.appendChild(tooltip)
		// Add tooltip title.
		tooltipDate = document.createElement('h1')
		tooltipDate.classList.add('chartogram__tooltip-header')
		tooltip.appendChild(tooltipDate)
		// Add graph values.
		tooltipValues = document.createElement('dl')
		tooltipValues.classList.add('chartogram__tooltip-values')
		tooltip.appendChild(tooltipValues)
		// Add graph values.
		for (const y of data.y) {
			if (showGraphs[y.id]) {
				// Add graph value.
				const tooltipValue = document.createElement('dt')
				tooltipValue.style.color = y.color
				tooltipValues.appendChild(tooltipValue)
				// Add graph name.
				const tooltipName = document.createElement('dd')
				tooltipName.style.color = y.color
				tooltipValues.appendChild(tooltipName)
			}
		}
	}

	function removeTooltip() {
		if (tooltip) {
			tooltipForX = undefined
			tooltipContainer.removeChild(tooltip)
			tooltip = undefined
			removeTooltipPoints()
			removeTooltipLine()
		}
	}

	function addTooltipLine() {
		const xmlns = 'http://www.w3.org/2000/svg'
		tooltipLine = document.createElementNS(xmlns, 'line')
		tooltipLine.setAttributeNS(null, 'class', 'chartogram__tooltip-line')
		canvas.insertBefore(tooltipLine, canvas.querySelector('polyline'))
	}

	function removeTooltipLine() {
		canvas.removeChild(tooltipLine)
		tooltipLine = undefined
	}

	function addTooltipPoints() {
		tooltipPoints = []
		let i = 0
		while (i < timelineWindowGraphs.length) {
			const point = document.createElement('div')
			point.classList.add('chartogram__tooltip-point')
			point.style.color = timelineWindowGraphs[i].color
			tooltipPoints.push(point)
			canvasWrapper.appendChild(point)
			i++
		}
	}

	function removeTooltipPoints() {
      for (const point of tooltipPoints) {
      	canvasWrapper.removeChild(point)
      }
      tooltipPoints = undefined
	}

	function updateTooltipLine(x) {
		if (!tooltipLine) {
			addTooltipLine()
		}
      tooltipLine.setAttributeNS(null, 'x1', fixSvgCoordinate(x))
      tooltipLine.setAttributeNS(null, 'x2', fixSvgCoordinate(x))
      tooltipLine.setAttributeNS(null, 'y1', fixSvgCoordinate(timelineWindowMinY))
      tooltipLine.setAttributeNS(null, 'y2', fixSvgCoordinate(timelineWindowMaxY))
	}

	function updateTooltipPoints(xIndex, xRatio) {
		if (!tooltipPoints) {
			addTooltipPoints()
		}
		let i = 0
		while (i < tooltipPoints.length) {
			const point = tooltipPoints[i]
			point.style.left = `${xRatio * 100}%`
			const y = timelineWindowGraphs[i].normalized.points[xIndex]
			const yRatio = y / timelineWindowMaxY
			point.style.bottom = `${yRatio * 100}%`
			i++
		}
	}
}