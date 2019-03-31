import {
	clearElement,
	commaJoin,
	getLowerSiblingDivisibleBy,
	divideInterval,
	renderGaugeLabels,
	throttle,
	simplifyGraph,
	setUpDrag
} from './utility'

export default class Chartogram {
	constructor(rootNode, data, title = 'Title', options = {}) {
		this.props = {
			title,
			gaugeTickMarksCount: 6,
			timelineWindowSize: 40,
			canvasWidth: 512,
			precisionFactor: Math.pow(10, options.precision || 3),
			months: [
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
			],
			weekdays: [
				'Sun',
				'Mon',
				'Tue',
				'Wed',
				'Thu',
				'Fri',
				'Sat'
			],
			...options
		}

		this.rootNode = rootNode

		this.data = {
			...data,
			minX: Math.min(...data.x.points),
			maxX: Math.max(...data.x.points),
			y: data.y.map(y => ({
				...y,
				min: Math.min(...y.points),
				max: Math.max(...y.points)
			}))
		}
	}

	componentDidMount() {
		this.rootNode.classList.add('chartogram')

		this.rootNode.innerHTML = `
			<header class="chartogram__header">
				<h1 class="chartogram__title">${this.props.title}</h1>
			</header>
			<div class="chartogram__plan-with-axes">
				<div class="chartogram__plan">
					<div class="chartogram__top-border"></div>
					<div class="chartogram__canvas-wrapper">
						<svg class="chartogram__canvas"></svg>
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

		this.tooltipContainer = this.rootNode.querySelector('.chartogram__plan')
		this.canvas = this.rootNode.querySelector('.chartogram__canvas')
		this.canvasWrapper = this.rootNode.querySelector('.chartogram__canvas-wrapper')
		this.xAxis = this.rootNode.querySelector('.chartogram__x')
		this.yAxis = this.rootNode.querySelector('.chartogram__y')
		this.timeline = this.rootNode.querySelector('.chartogram__timeline')
		this.timelineOverlayLeft = this.rootNode.querySelector('.chartogram__timeline-overlay-left')
		this.timelineWindowLeftHandle = this.rootNode.querySelector('.chartogram__timeline-window__left-handle')
		this.timelineWindow = this.rootNode.querySelector('.chartogram__timeline-window')
		this.timelineWindowDrag = this.rootNode.querySelector('.chartogram__timeline-window__drag')
		this.timelineWindowRightHandle = this.rootNode.querySelector('.chartogram__timeline-window__right-handle')
		this.timelineOverlayRight = this.rootNode.querySelector('.chartogram__timeline-overlay-right')
		this.timelineCanvas = this.rootNode.querySelector('.chartogram__timeline-canvas')

		this.setUpTimelineWindowHandle('left')
		this.setUpTimelineWindowHandle('right')
		this.setUpTimelineWindow()
		this.setUpCanvasTooltipListener()

		// Add graph togglers.
		const graphTogglers = this.rootNode.querySelector('.chartogram__chart-togglers')
		clearElement(graphTogglers)
		for (const y of this.data.y) {
			graphTogglers.appendChild(this.createGraphToggler(y))
		}

		// Render will be called after `.componentDidMount()`.
		this.state = this.getInitialState()

		this.updateTimelineBounds(this.state.fromRatio, this.state.toRatio)

		// Add window resize event listener.
		window.addEventListener('resize', this.onResizeThrottled)
	}

	componentWillUnmount() {
		// Remove window resize event listener.
		window.removeEventListener('resize', this.onResizeThrottled)
	}

	onResize = (event) => {
		this.setState({
			aspectRatio: this.getCanvasAspectRatio(),
			timelineAspectRatio: this.getTimelineCanvasAspectRatio()
		})
	}

	onResizeThrottled = throttle(this.onResize, 33)

	getCanvasAspectRatio() {
		const canvasDimensions = this.canvas.getBoundingClientRect()
		return canvasDimensions.width / canvasDimensions.height
	}

	getTimelineCanvasAspectRatio() {
		const timelineCanvasDimensions = this.timelineCanvas.getBoundingClientRect()
		return timelineCanvasDimensions.width / timelineCanvasDimensions.height
	}

	setState(newState, renderTimeline) {
		this.state = {
			...this.state,
			...newState
		}
		this.render(renderTimeline)
	}

	getInitialState() {
		const { timelineWindowSize } = this.props
		const { minX, maxX } = this.data
		let fromIndex
		if (this.data.x.points.length > timelineWindowSize) {
			fromIndex = this.data.x.points.length - timelineWindowSize
		} else {
			fromIndex = 0
		}
		const xFrom = this.data.x.points[fromIndex]
		const fromRatio = (xFrom - minX) / (maxX - minX)
		const toRatio = 1
		return {
			...this.createState(fromRatio, toRatio),
			aspectRatio: this.getCanvasAspectRatio(),
			timelineAspectRatio: this.getTimelineCanvasAspectRatio(),
			yScale: 1
		}
	}

	createState(fromRatio, toRatio) {
		const x = this.data.x
		const minX = this.data.minX + fromRatio * (this.data.maxX - this.data.minX)
		const maxX = this.data.minX + toRatio * (this.data.maxX - this.data.minX)
		let fromIndex
		if (minX === this.data.minX) {
			fromIndex = 0
		} else {
			fromIndex = x.points.findIndex(x => x > minX) - 1
		}
		let toIndex
		if (maxX === this.data.maxX) {
			toIndex = x.points.length - 1
		} else {
			toIndex = x.points.findIndex(x => x > maxX)
		}
		const xPoints = x.points.slice(fromIndex, toIndex + 1)
		const xGraphPoints = xPoints.slice()
		// Create X graph points.
		if (xPoints.length >= 2) {
			if (x.points[fromIndex] !== minX) {
				xGraphPoints[0] = minX
			}
			if (x.points[toIndex] !== maxX) {
				xGraphPoints[xGraphPoints.length - 1] = maxX
			}
		}
		const y = this.data.y.map((y, i) => {
			const points = this.data.y[i].points.slice(fromIndex, toIndex + 1)
			const graphPoints = points.slice()
			if (xPoints.length >= 2) {
				if (x.points[fromIndex] !== minX) {
					const beforeStartY = this.data.y[i].points[fromIndex]
					const startY = this.data.y[i].points[fromIndex + 1]
					const fromXExcludedTickRatio = (minX - this.data.x.points[fromIndex]) / (this.data.x.points[fromIndex + 1] - this.data.x.points[fromIndex])
					const startPoint = beforeStartY + (startY - beforeStartY) * fromXExcludedTickRatio
					graphPoints[0] = startPoint
				}
				if (x.points[toIndex] !== maxX) {
					const afterEndY = this.data.y[i].points[toIndex]
					const endY = this.data.y[i].points[toIndex - 1]
					const toXIncludedTickRatio = (maxX - this.data.x.points[toIndex - 1]) / (this.data.x.points[toIndex] - this.data.x.points[toIndex - 1])
					const endPoint = endY + (afterEndY - endY) * toXIncludedTickRatio
					graphPoints[graphPoints.length - 1] = endPoint
				}
			}
			return {
				...this.data.y[i],
				...(this.state ? this.state.y[i] : { isShown: true }),
				points,
				graphPoints,
				// Min Y is always 0 by design.
				min: 0,
				// min: Math.min(...graphPoints),
				max: Math.max(...graphPoints)
			}
		})
		return {
			minX,
			maxX,
			fromIndex,
			toIndex,
			fromRatio,
			toRatio,
			xPoints,
			xGraphPoints,
			...this.calculateMinMaxY(y),
			y
		}
	}

	calculateMinMaxY(y) {
		// Calculate timeline min/max Y for the graphs being shown.
		let minY = Infinity
		let maxY = -Infinity
		for (const _y of y) {
			if (_y.isShown) {
				minY = Math.min(minY, _y.min)
				maxY = Math.max(maxY, _y.max)
			}
		}
		// Min Y is always 0 by design.
		minY = 0
		// Calculate global min/max Y for the graphs being shown.
		let minYGlobal = Infinity
		let maxYGlobal = -Infinity
		for (const _y of this.data.y) {
			const isShown = y.find(_ => _.id === _y.id).isShown
			if (isShown) {
				minYGlobal = Math.min(minYGlobal, _y.min)
				maxYGlobal = Math.max(maxYGlobal, _y.max)
			}
		}
		// Min Y is always 0 by design.
		minYGlobal = 0
		return {
			minY,
			maxY,
			minYGlobal,
			maxYGlobal
		}
	}

	updateTimelineBounds(from, to) {
		this.setTimelineWindowLeft(from)
		this.setTimelineWindowRight(to)
	}

	updateBounds(from, to) {
		this.updateTimelineBounds(from, to)
		this.setState(this.createState(from, to), false)
	}

	createPolylinePoints(x, y) {
		// return commaJoin(x, y)
		return commaJoin(x.map(this.fixSvgCoordinate), y.map(this.fixSvgCoordinate))
	}

	// Firefox is buggy with too high and too fractional SVG coordinates.
	fixSvgCoordinate = (x) => {
		const { precisionFactor } = this.props
		return Math.round(x * precisionFactor) / precisionFactor
	}

	mapX = (x) => {
		const { canvasWidth } = this.props
		const { minX, maxX } = this.state
		return ((x - minX) / (maxX - minX)) * canvasWidth
	}

	mapY = (y) => {
		const { canvasWidth } = this.props
		const { minY, maxY, aspectRatio } = this.state
		return ((y - minY) / (maxY - minY)) * canvasWidth / aspectRatio
	}

	mapXForTimeline = (x) => {
		const { canvasWidth } = this.props
		const { minX, maxX } = this.data
		return ((x - minX) / (maxX - minX)) * canvasWidth
	}

	mapYForTimeline = (y) => {
		const { canvasWidth } = this.props
		const { minYGlobal, maxYGlobal, timelineAspectRatio } = this.state
		return ((y - minYGlobal) / (maxYGlobal - minYGlobal)) * canvasWidth / timelineAspectRatio
	}

	render(renderTimeline = true) {
		const { canvasWidth, gaugeTickMarksCount } = this.props
		const { minX, maxX, minY, maxY, yScale, xGraphPoints, aspectRatio } = this.state
		// Clear canvas.
		clearElement(this.canvas)
		// Set canvas `viewBox`.
		this.canvas.setAttribute('viewBox', `0 0 ${canvasWidth} ${this.fixSvgCoordinate(canvasWidth / aspectRatio)}`)
		// Calculate grid lines' coordinates.
		const minY_ = minY
		const maxY_ = getLowerSiblingDivisibleBy(maxY, 10)
		const yAxisScale = (maxY - minY) / (maxY_ - minY_)
		const yAxisTickMarks = divideInterval(minY_, maxY_, gaugeTickMarksCount)
		// Draw grid lines.
		for (const y of yAxisTickMarks) {
			this.canvas.appendChild(this.createGridLine(y))
		}
		// Draw charts.
		for (const { color, graphPoints, isShown } of this.state.y) {
			// Draw chart.
			if (isShown) {
				const graph = document.createElement('polyline')
				graph.setAttribute('stroke', color)
				graph.setAttribute('points', this.createPolylinePoints(
					xGraphPoints.map(this.mapX),
					graphPoints.map(y => this.mapY(maxY - y * yScale))
				).join(' '))
				graph.classList.add('chartogram__graph')
				this.canvas.appendChild(graph)
			}
		}
		// A workaround to fix WebKit bug when it's not re-rendering the <svg/>.
		// https://stackoverflow.com/questions/30905493/how-to-force-webkit-to-update-svg-use-elements-after-changes-to-original
		this.canvas.innerHTML += ''
		// Draw gauges.
		this.drawGauges(
			minX,
			maxX,
			minY_,
			maxY_,
			yAxisScale
		)
		// Draw timeline graph.
		if (renderTimeline) {
			this.renderTimeline()
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

	createGridLine = (y) => {
		const { minX, maxX, minY, maxY, yScale } = this.state
		const line = document.createElement('line')
		line.classList.add('chartogram__grid-line')
		line.setAttribute('x1', this.fixSvgCoordinate(this.mapX(minX)))
		line.setAttribute('x2', this.fixSvgCoordinate(this.mapX(maxX)))
		line.setAttribute('y1', this.fixSvgCoordinate(this.mapY(maxY - yScale * y)))
		line.setAttribute('y2', this.fixSvgCoordinate(this.mapY(maxY - yScale * y)))
		return line
	}

	drawGauges = (minX, maxX, minY, maxY, yAxisScale) => {
		const { gaugeTickMarksCount, months } = this.props
		clearElement(this.xAxis)
		clearElement(this.yAxis)
		renderGaugeLabels(this.xAxis, minX, maxX, gaugeTickMarksCount, (timestamp) => {
			const date = new Date(timestamp)
			return `${months[date.getMonth()]} ${date.getDate()}`
		})
		renderGaugeLabels(this.yAxis, minY, maxY, gaugeTickMarksCount)
		this.yAxis.style.height = `${100 / yAxisScale}%`
	}

	renderTimeline = () => {
		const { canvasWidth } = this.props
		const { x, y } = this.data
		const { timelineAspectRatio, maxYGlobal, yScale } = this.state
		// Clear canvas.
		clearElement(this.timelineCanvas)
		// Set canvas `viewBox`.
		this.timelineCanvas.setAttribute('viewBox', `0 0 ${canvasWidth} ${this.fixSvgCoordinate(canvasWidth / timelineAspectRatio)}`)
		for (const { id, color, points } of y) {
			const isShown = this.state.y.find(_ => _.id === id).isShown
			if (isShown) {
				const [_x, _y] = simplifyGraph(x.points, points, 80)
				const graph = document.createElement('polyline')
				graph.setAttribute('stroke', color)
				graph.setAttribute('points', this.createPolylinePoints(
					_x.map(this.mapXForTimeline),
					_y.map(y => this.mapYForTimeline(maxYGlobal - y * yScale))
				).join(' '))
				graph.classList.add('chartogram__graph')
				this.timelineCanvas.appendChild(graph)
			}
		}
		// A workaround to fix WebKit bug when it's not re-rendering the <svg/>.
		// https://stackoverflow.com/questions/30905493/how-to-force-webkit-to-update-svg-use-elements-after-changes-to-original
		this.timelineCanvas.innerHTML += ''
	}

	createGraphToggler = ({ id, name, color }) => {
		const toggler = document.createElement('button')
		toggler.setAttribute('type', 'button')
		toggler.classList.add('chartogram__chart-toggler')
		toggler.classList.add('chartogram__chart-toggler--on')
		toggler.classList.add('chartogram__reset-button')
		// Add check.
		const xmlns = 'http://www.w3.org/2000/svg'
		const check = document.createElementNS(xmlns, 'svg')
		check.setAttribute('viewBox', '0 0 19 19')
		check.setAttribute('class', 'chartogram__chart-toggler-check')
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
		checkCircle.setAttribute('class', 'chartogram__chart-toggler-check-circle')
		check.appendChild(checkCircle)
		// Add check mark.
		const checkMark = document.createElementNS(xmlns, 'path')
		checkMark.setAttribute('d', 'M13.64 4.94l-6.2 6.34-1.69-1.9c-.73-.63-1.89.1-1.36 1.06l2 3.38c.3.43 1.04.85 1.78 0 .32-.42 6.31-7.93 6.31-7.93.74-.84-.2-1.58-.84-.95z')
		checkMark.setAttribute('fill', 'white')
		checkMark.setAttribute('class', 'chartogram__chart-toggler-check-mark')
		check.appendChild(checkMark)
		// Add checkmark.
		toggler.appendChild(check)
		// Add graph name.
		toggler.appendChild(document.createTextNode(name))
		// On click.
		toggler.addEventListener('click', () => {
			const y = this.state.y.find(_ => _.id === id)
			// Won't allow hiding all graphs.
			if (y.isShown) {
				const graphsShown = this.state.y.filter(_ => _.isShown)
				if (graphsShown.length === 1) {
					return
				}
			}
			y.isShown = !y.isShown
			this.setState({
				...this.state,
				...this.calculateMinMaxY(this.state.y)
			})
			toggler.classList.toggle('chartogram__chart-toggler--on')
		})
		return toggler
	}

	setUpTimelineWindowHandle = (side) => {
		const handle = side === 'left' ? this.timelineWindowLeftHandle : this.timelineWindowRightHandle
		const handleWidth = parseFloat(getComputedStyle(this.timelineWindow).borderLeftWidth)
		let timelineCoordinates
		let minX
		let maxX
		let deltaX
		let startedX
		const onDrag = (x) => {
			x -= deltaX
			x = Math.max(Math.min(x, maxX), minX)
			const ratio = (x - timelineCoordinates.x) / timelineCoordinates.width
			if (side === 'left') {
				this.updateBounds(ratio, this.state.toRatio)
			} else {
				this.updateBounds(this.state.fromRatio, ratio)
			}
		}
		const onDragStart = (x) => {
			timelineCoordinates = this.timeline.getBoundingClientRect()
			const timelineWindowCoordinates = this.timelineWindow.getBoundingClientRect()
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

	setUpTimelineWindow = () => {
		let timelineCoordinates
		let timelineWindowCoordinates
		let minX
		let maxX
		let innerX
		const onDrag = (x) => {
			x -= innerX
			x = Math.max(Math.min(x, maxX), minX)
			const ratio = (x - timelineCoordinates.x) / timelineCoordinates.width
			this.updateBounds(ratio, ratio + timelineWindowCoordinates.width / timelineCoordinates.width)
		}
		const onDragStart = (x) => {
			timelineCoordinates = this.timeline.getBoundingClientRect()
			timelineWindowCoordinates = this.timelineWindow.getBoundingClientRect()
			innerX = x - timelineWindowCoordinates.x
			minX = timelineCoordinates.x
			maxX = timelineCoordinates.x + (timelineCoordinates.width - timelineWindowCoordinates.width)
		}
		return setUpDrag(this.timelineWindowDrag, onDragStart, onDrag)
	}

	setTimelineWindowLeft = (ratio) => {
		this.timelineOverlayLeft.style.right = `${100 * (1 - ratio)}%`
		this.timelineWindow.style.left = `${100 * ratio}%`
	}

	setTimelineWindowRight = (ratio) => {
		this.timelineOverlayRight.style.left = `${100 * ratio}%`
		this.timelineWindow.style.right = `${100 * (1 - ratio)}%`
	}

	setUpCanvasTooltipListener = () => {
		const { weekdays, months } = this.props
		let canvasDimensions
		let isIndexInBounds
		const onTrack = (screenX) => {
			const { minX, maxX, xPoints, y } = this.state
			const xScreenRatio = (screenX - canvasDimensions.x) / canvasDimensions.width
			const xPoint = minX + xScreenRatio * (maxX - minX)
			let xHigherIndex = xPoints.findIndex(_ => _ >= xPoint)
			let xLowerIndex = xHigherIndex - 1
			if (!isIndexInBounds(xHigherIndex)) {
				xHigherIndex = -1
			}
			if (!isIndexInBounds(xLowerIndex)) {
				xLowerIndex = -1
			}
			let xIndex
			if (xHigherIndex < 0) {
				if (xLowerIndex < 0) {
					return this.removeTooltip()
				} else {
					xIndex = xLowerIndex
				}
			} else {
				if (xLowerIndex < 0) {
					xIndex = xHigherIndex
				} else {
					const xLower = xPoints[xLowerIndex]
					const xHigher = xPoints[xHigherIndex]
					const deltaLower = xPoint - xLower
					const deltaHigher = xHigher - xPoint
					xIndex = deltaLower > deltaHigher ? xHigherIndex : xLowerIndex
				}
			}
			const x = xPoints[xIndex]
			if (x !== this.tooltipForX) {
				this.tooltipForX = x
				if (!this.tooltip) {
					this.addTooltip()
				}
				const date = new Date(x)
				this.tooltipDate.textContent = `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
				let i = 0
				for (const { isShown, points, name } of y) {
					if (isShown) {
						this.tooltipValues.childNodes[2 * i].textContent = points[xIndex]
						this.tooltipValues.childNodes[2 * i + 1].textContent = name
						i++
					}
				}
				const xRatio = (x - minX) / (maxX - minX)
				this.tooltip.style.left = `${xRatio * 100}%`
				this.updateTooltipPoints(xIndex, xRatio)
				this.updateTooltipLine(x)
			}
		}
		const onTrackStart = () => {
			canvasDimensions = this.canvas.getBoundingClientRect()
			isIndexInBounds = (index) => {
				const { xPoints } = this.state
				return index >= 0 && index < xPoints.length
			}
		}
		const onTouchStart = (event) => {
			// Ignore multitouch.
			if (event.touches.length > 1) {
				// Reset.
				return onTrackStop()
			}
			onTrackStart()
			this.canvas.addEventListener('touchend', onTrackStop)
			this.canvas.addEventListener('touchmove', onTouchMove)
			this.canvas.addEventListener('touchend', onTrackStop)
			this.canvas.addEventListener('touchcancel', onTrackStop)
			onTouchMove(event)
		}
		// Safari doesn't support pointer events.
		// https://caniuse.com/#feat=pointer
		this.canvas.addEventListener('touchstart', onTouchStart)
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
		const onTrackStop = () => {
			this.canvas.removeEventListener('pointermove', onPointerMove)
			this.canvas.removeEventListener('pointerleave', onTrackStop)
			this.canvas.removeEventListener('pointercancel', onTrackStop)
			this.canvas.removeEventListener('touchmove', onTouchMove)
			this.canvas.removeEventListener('touchend', onTrackStop)
			this.canvas.removeEventListener('touchcancel', onTrackStop)
			this.removeTooltip()
		}
		const onPointerEnter = () => {
			onTrackStart()
			this.canvas.addEventListener('pointermove', onPointerMove)
			this.canvas.addEventListener('pointerleave', onTrackStop)
			this.canvas.addEventListener('pointercancel', onTrackStop)
		}
		this.canvas.addEventListener('pointerenter', onPointerEnter)
		return () => {
			onTrackStop()
			this.canvas.removeEventListener(onPointerEnter)
			this.canvas.removeEventListener(onTouchStart)
		}
	}

	addTooltip = () => {
		const { y } = this.state
		// Create tooltip.
		this.tooltip = document.createElement('div')
		this.tooltip.classList.add('chartogram__tooltip')
		this.tooltipContainer.appendChild(this.tooltip)
		// Add tooltip title.
		this.tooltipDate = document.createElement('h1')
		this.tooltipDate.classList.add('chartogram__tooltip-header')
		this.tooltip.appendChild(this.tooltipDate)
		// Add graph values.
		this.tooltipValues = document.createElement('dl')
		this.tooltipValues.classList.add('chartogram__tooltip-values')
		this.tooltip.appendChild(this.tooltipValues)
		// Add graph values.
		for (const { isShown, color } of y) {
			if (isShown) {
				// Add graph value.
				const tooltipValue = document.createElement('dt')
				tooltipValue.style.color = color
				this.tooltipValues.appendChild(tooltipValue)
				// Add graph name.
				const tooltipName = document.createElement('dd')
				tooltipName.style.color = color
				this.tooltipValues.appendChild(tooltipName)
			}
		}
	}

	addTooltipLine = () => {
		const xmlns = 'http://www.w3.org/2000/svg'
		this.tooltipLine = document.createElementNS(xmlns, 'line')
		this.tooltipLine.setAttributeNS(null, 'class', 'chartogram__tooltip-line')
		this.canvas.insertBefore(this.tooltipLine, this.canvas.querySelector('polyline'))
	}

	removeTooltip = () => {
		if (this.tooltip) {
			this.tooltipForX = undefined
			this.tooltipContainer.removeChild(this.tooltip)
			this.tooltip = undefined
			this.removeTooltipPoints()
			this.removeTooltipLine()
		}
	}

	removeTooltipLine = () => {
		this.canvas.removeChild(this.tooltipLine)
		this.tooltipLine = undefined
	}

	addTooltipPoints = () => {
		this.tooltipPoints = []
		for (const y of this.state.y) {
			if (y.isShown) {
				const point = document.createElement('div')
				point.classList.add('chartogram__tooltip-point')
				point.style.color = y.color
				this.tooltipPoints.push(point)
				this.canvasWrapper.appendChild(point)
			}
		}
	}

	removeTooltipPoints = () => {
		for (const point of this.tooltipPoints) {
			this.canvasWrapper.removeChild(point)
		}
		this.tooltipPoints = undefined
	}

	updateTooltipLine = (x) => {
		const { canvasWidth } = this.props
		const { aspectRatio } = this.state
		if (!this.tooltipLine) {
			this.addTooltipLine()
		}
		this.tooltipLine.setAttributeNS(null, 'x1', this.fixSvgCoordinate(this.mapX(x)))
		this.tooltipLine.setAttributeNS(null, 'x2', this.fixSvgCoordinate(this.mapX(x)))
		this.tooltipLine.setAttributeNS(null, 'y1', 0)
		this.tooltipLine.setAttributeNS(null, 'y2', this.fixSvgCoordinate(canvasWidth / aspectRatio))
	}

	updateTooltipPoints = (xIndex, xRatio) => {
		const { maxY, y } = this.state
		if (!this.tooltipPoints) {
			this.addTooltipPoints()
		}
		let i = 0
		while (i < this.tooltipPoints.length) {
			const point = this.tooltipPoints[i]
			const _y = y[i].points[xIndex]
			const yRatio = _y / maxY
			point.style.left = `${xRatio * 100}%`
			point.style.bottom = `${yRatio * 100}%`
			i++
		}
	}
}