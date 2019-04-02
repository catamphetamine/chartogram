import {
	clearElement,
	commaJoin,
	getLowerSiblingDivisibleBy,
	divideInterval,
	throttle
} from './utility'

import Timeline from './Timeline'
import Togglers from './Togglers'
import Tooltip from './Tooltip'

const SVG_XMLNS = 'http://www.w3.org/2000/svg'

export default class Chartogram {
	constructor(rootNode, data, title = 'Title', props = {}) {
		this.props = {
			title,
			transitionDuration: 250,
			transitionEasing: 'easeOutQuad',
			gaugeTickMarksCount: 6,
			timelineWindowSize: 40,
			canvasWidth: 512,
			precisionFactor: Math.pow(10, props.precision || 3),
			months: MONTHS,
			weekdays: WEEKDAYS,
			...props
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
			${INITIAL_MARKUP.replace('{title}', this.props.title)}
			${Timeline.INITIAL_MARKUP}
			${Togglers.INITIAL_MARKUP}
		`

		this.tooltipContainer = this.rootNode.querySelector('.chartogram__plan')
		this.canvas = this.rootNode.querySelector('.chartogram__canvas')
		this.canvasWrapper = this.rootNode.querySelector('.chartogram__canvas-wrapper')
		this.xAxis = this.rootNode.querySelector('.chartogram__x')
		this.yAxis = this.rootNode.querySelector('.chartogram__y')

		// Render will be called after `.componentDidMount()`.
		this.state = this.getInitialState()
		this.updateAspectRatio()

		this.timeline = new Timeline(this.getTimelineProps())
		this.timeline.componentDidMount()

		this.togglers = new Togglers(this.getTogglersProps())
		this.togglers.componentDidMount()

		this.tooltip = new Tooltip(this.getTooltipProps())
		this.tooltip.componentDidMount()

		this.mountGridLines()
		this.mountGauges()
		this.mountGraphs()

		// Add window resize event listener.
		window.addEventListener('resize', this.onResizeThrottled)

		this.render()
	}

	componentWillUnmount() {
		this.timeline.componentWillUnmount()
		this.rootNode.classList.remove('chartogram')
		clearElement(this.rootNode)
		// Remove window resize event listener.
		window.removeEventListener('resize', this.onResizeThrottled)
		if (this.transition) {
			cancelAnimationFrame(this.transition)
		}
	}

	onResize = (event) => {
		this.setState({
			aspectRatio: this.getCanvasAspectRatio()
		}, false)
	}

	onResizeThrottled = throttle(this.onResize, 33)

	getCanvasAspectRatio() {
		const canvasDimensions = this.canvas.getBoundingClientRect()
		return canvasDimensions.width / canvasDimensions.height
	}

	setState(newState, renderTimeline = true) {
		if (newState.aspectRatio !== this.state.aspectRatio) {
			this.updateAspectRatio(newState.aspectRatio)
		}
		this.state = {
			...this.state,
			...newState
		}
		this.render()
		if (renderTimeline) {
			this.timeline.componentDidUpdate(this.getTimelineProps())
		}
		this.tooltip.componentDidUpdate(this.getTooltipProps())
	}

	getTimelineProps() {
		return {
			rootNode: this.rootNode,
			data: this.data,
			canvasWidth: this.props.canvasWidth,
			fixSvgCoordinate: this.fixSvgCoordinate,
			createPolylinePoints: this.createPolylinePoints,
			fromRatio: this.state.fromRatio,
			toRatio: this.state.toRatio,
			minY: this.state.minYGlobal,
			maxY: this.state.maxYGlobal,
			y: this.state.y,
			graphOpacity: this.state.graphOpacity,
			onChangeBounds: this.onChangeBounds
		}
	}

	getTogglersProps() {
		return {
			rootNode: this.rootNode,
			data: this.data,
			onToggle: this.onToggle
		}
	}

	getTooltipProps() {
		return {
			canvas: this.canvas,
			container: this.tooltipContainer,
			pointsContainer: this.canvasWrapper,
			weekdays: this.props.weekdays,
			months: this.props.months,
			canvasWidth: this.props.canvasWidth,
			aspectRatio: this.state.aspectRatio,
			mapX: this.mapX,
			fixSvgCoordinate: this.fixSvgCoordinate,
			minX: this.state.minX,
			maxX: this.state.maxX,
			maxY: this.state.maxY,
			xPoints: this.state.xPoints,
			y: this.state.y
		}
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
			graphOpacity: this.data.y.map(_ => 1)
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
		// Calculate visible min/max Y for the graphs being shown.
		let minY = Infinity
		let maxY = -Infinity
		for (const _y of y) {
			if (_y.isShown) {
				minY = Math.min(minY, _y.min)
				maxY = Math.max(maxY, _y.max)
			}
		}
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

	onToggle = (id) => {
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
			y: this.state.y
		})
		const { minY, maxY, minYGlobal, maxYGlobal } = this.calculateMinMaxY(this.state.y)
		this.transitionState(
			minY,
			maxY,
			minYGlobal,
			maxYGlobal,
			this.state.y.map(y => y.isShown ? 1 : 0)
		)
		return true
	}

	onChangeBounds = (from, to) => {
		const state = this.createState(from, to)
		const minY = state.minY
		const maxY = state.maxY
		delete state.minY
		delete state.maxY
		this.setState(state, false)
		this.transitionState(minY, maxY)
	}

	createPolylinePoints = (x, y) => {
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

	updateAspectRatio(aspectRatio = this.state.aspectRatio) {
		const { canvasWidth } = this.props
		// Set canvas `viewBox`.
		this.canvas.setAttribute('viewBox', `0 0 ${canvasWidth} ${this.fixSvgCoordinate(canvasWidth / aspectRatio)}`)
	}

	updateGridLine(i, y) {
		const { maxY } = this.state
		const line = this.gridLines[i]
		line.setAttribute('y1', this.fixSvgCoordinate(this.mapY(maxY - y)))
		line.setAttribute('y2', this.fixSvgCoordinate(this.mapY(maxY - y)))
	}

	render() {
		const { gaugeTickMarksCount } = this.props
		const { y, minX, maxX, minY, maxY, graphOpacity } = this.state
		// Calculate grid lines' coordinates.
		const minY_ = minY
		const maxY_ = getLowerSiblingDivisibleBy(maxY, 10)
		const yAxisScale = (maxY - minY) / (maxY_ - minY_)
		const yAxisTickMarks = divideInterval(minY_, maxY_, gaugeTickMarksCount)
		// Update grid lines.
		yAxisTickMarks.forEach((y, i) => this.updateGridLine(i, y))
		// Update graphs.
		let i = 0
		while (i < y.length) {
			const { isShown, graphPoints, color } = y[i]
			const opacity = graphOpacity[i]
			// Update graph.
			if (isShown || opacity > 0) {
				if (this.graphs[i]) {
					this.updateGraph(i, graphPoints, opacity)
				} else {
					this.mountGraph(i, graphPoints, color, opacity)
				}
			} else if (this.graphs[i]) {
				this.unmountGraph(i)
			}
			i++
		}
		// Update gauges.
		this.updateGauges(
			minX,
			maxX,
			minY_,
			maxY_,
			yAxisScale
		)
	}

	renderGraph(graphPoints, color, opacity = 1) {
		const graph = document.createElementNS(SVG_XMLNS, 'polyline')
		graph.setAttribute('stroke', color)
		graph.classList.add('chartogram__graph')
		this.updateGraph(graph, graphPoints, opacity)
		return graph
	}

	mountGridLines() {
		const { gaugeTickMarksCount } = this.props
		this.gridLines = []
		let i = 0
		while (i < gaugeTickMarksCount) {
			const line = this.renderGridLine(0)
			this.gridLines.push(line)
			this.canvas.appendChild(line)
			i++
		}
	}

	mountGraphs() {
		this.graphs = []
		const { y } = this.state
		y.forEach(({ graphPoints, color }, i) => {
			this.mountGraph(i, graphPoints, color)
		})
	}

	mountGraph(i, graphPoints, color, opacity) {
		const graph = this.renderGraph(graphPoints, color, opacity)
		this.graphs[i] = graph
		this.canvas.appendChild(graph)
	}

	unmountGraph(i) {
		this.canvas.removeChild(this.graphs[i])
		this.graphs[i] = undefined
	}

	updateGraph(graph, graphPoints, opacity) {
		const { xGraphPoints, maxY } = this.state
		if (typeof graph === 'number') {
			graph = this.graphs[graph]
		}
		graph.setAttribute('points', this.createPolylinePoints(
			xGraphPoints.map(this.mapX),
			graphPoints.map(y => this.mapY(maxY - y))
		).join(' '))
		if (opacity !== 1) {
			graph.style.opacity = opacity
		}
	}

	transitionState(minY, maxY, minYGlobal, maxYGlobal, graphOpacity) {
		const { transitionDuration: maxTransitionDuration } = this.props
		if (this.transition) {
			cancelAnimationFrame(this.transition)
		}
		let transitionDuration = maxTransitionDuration
		if (minY !== undefined) {
			const heightBefore = this.state.maxY - this.state.minY
			const deltaMaxY = Math.abs(maxY - this.state.maxY) / heightBefore
			const deltaMinY = Math.abs(minY - this.state.minY) / heightBefore
			const deltaY = Math.max(deltaMinY, deltaMaxY)
			transitionDuration = maxTransitionDuration * Math.max(0.2, Math.min(deltaY, 0.5) * 2)
		}
		if (!graphOpacity) {
			transitionDuration /= 2
		}
		const state = {
			transitionStartedAt: Date.now(),
			transitionDuration
		}
		if (minY !== undefined) {
			state.minYFrom = this.state.minY
			state.maxYFrom = this.state.maxY
			state.minYTo = minY
			state.maxYTo = maxY
		}
		if (graphOpacity !== undefined) {
			state.graphOpacityFrom = this.state.graphOpacity
			state.graphOpacityTo = graphOpacity
		}
		if (minYGlobal !== undefined) {
			state.minYGlobalFrom = this.state.minYGlobal
			state.maxYGlobalFrom = this.state.maxYGlobal
			state.minYGlobalTo = minYGlobal
			state.maxYGlobalTo = maxYGlobal
		}
		const shouldUpdateTimeline = graphOpacity !== undefined || minYGlobal !== undefined
		state.transitionUpdatesTimeline = shouldUpdateTimeline
		this.setState(state, shouldUpdateTimeline)
		// Place the following in a `setState()` callback in case of React.
		this.transition = requestAnimationFrame(this.transitionStateTick)
	}

	transitionStateTick = () => {
		const {
			transitionEasing
		} = this.props
		const {
			transitionStartedAt,
			transitionDuration,
			transitionUpdatesTimeline,
			graphOpacityFrom,
			graphOpacityTo,
			minYFrom,
			minYTo,
			maxYFrom,
			maxYTo,
			minYGlobalFrom,
			minYGlobalTo,
			maxYGlobalFrom,
			maxYGlobalTo
		} = this.state
		const elapsed = Date.now() - transitionStartedAt
		let ratio = Math.min(elapsed / transitionDuration, 1)
		ratio = EASING[transitionEasing](ratio)
		const state = {}
		if (minYTo !== undefined) {
			state.minY = minYFrom + (minYTo - minYFrom) * ratio
			state.maxY = maxYFrom + (maxYTo - maxYFrom) * ratio
			if (ratio === 1) {
				state.minYFrom = undefined
				state.minYTo = undefined
				state.maxYFrom = undefined
				state.maxYTo = undefined
			}
		}
		if (minYGlobalTo !== undefined) {
			state.minYGlobal = minYGlobalFrom + (minYGlobalTo - minYGlobalFrom) * ratio
			state.maxYGlobal = maxYGlobalFrom + (maxYGlobalTo - maxYGlobalFrom) * ratio
			if (ratio === 1) {
				state.minYGlobalFrom = undefined
				state.minYGlobalTo = undefined
				state.maxYGlobalFrom = undefined
				state.maxYGlobalTo = undefined
			}
		}
		if (graphOpacityTo !== undefined) {
			state.graphOpacity = graphOpacityTo.map((_, i) => graphOpacityFrom[i] + (graphOpacityTo[i] - graphOpacityFrom[i]) * ratio)
			if (ratio === 1) {
				state.graphOpacityFrom = undefined
				state.graphOpacityTo = undefined
			}
		}
		this.setState(state, transitionUpdatesTimeline)
		if (ratio < 1) {
			this.transition = requestAnimationFrame(this.transitionStateTick)
		} else {
			this.transition = undefined
		}
	}

	renderGridLine(y) {
		const { minX, maxX, minY, maxY } = this.state
		const line = document.createElementNS(SVG_XMLNS, 'line')
		line.classList.add('chartogram__grid-line')
		line.setAttribute('x1', this.fixSvgCoordinate(this.mapX(minX)))
		line.setAttribute('x2', this.fixSvgCoordinate(this.mapX(maxX)))
		line.setAttribute('y1', this.fixSvgCoordinate(this.mapY(maxY - y)))
		line.setAttribute('y2', this.fixSvgCoordinate(this.mapY(maxY - y)))
		return line
	}

	mountGauges() {
		const { gaugeTickMarksCount } = this.props
		let i = 0
		while (i < gaugeTickMarksCount) {
			this.xAxis.appendChild(document.createElement('div'))
			this.yAxis.appendChild(document.createElement('div'))
			i++
		}
	}

	updateGauges(minX, maxX, minY, maxY, yAxisScale) {
		const { months, gaugeTickMarksCount } = this.props
		this.updateGauge(this.xAxis, minX, maxX, gaugeTickMarksCount, (timestamp) => {
			const date = new Date(timestamp)
			return `${months[date.getMonth()]} ${date.getDate()}`
		})
		this.updateGauge(this.yAxis, minY, maxY, gaugeTickMarksCount)
		this.yAxis.style.height = `${100 / yAxisScale}%`
	}

	updateGauge(gauge, min, max, tickMarksCount, transform) {
		let i = 0
		while (i < tickMarksCount) {
			const tickMark = gauge.childNodes[i]
			let value = min + i * (max - min) / (tickMarksCount - 1)
			if (transform) {
				value = transform(value)
			}
			tickMark.textContent = value
			i++
		}
	}
}

const MONTHS = [
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

const WEEKDAYS = [
	'Sun',
	'Mon',
	'Tue',
	'Wed',
	'Thu',
	'Fri',
	'Sat'
]

const INITIAL_MARKUP = `
	<header class="chartogram__header">
		<h1 class="chartogram__title">{title}</h1>
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
`

// https://gist.github.com/gre/1650294
const EASING = {
	linear(t) {
		return t
	},
	easeInOutSin(t) {
		return (1 + Math.sin(Math.PI * t - Math.PI / 2)) / 2
	},
	easeInOutQuad(t) {
		return t<.5 ? 2*t*t : -1+(4-2*t)*t
	},
  easeInOutCubic(t) {
  	return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1
  },
  easeOutCubic(t) {
  	return (--t)*t*t+1
  },
  easeOutQuad(t) {
  	return t*(2-t)
  }
}