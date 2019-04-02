import {
	clearElement,
	commaJoin,
	getLowerSiblingDivisibleBy,
	divideInterval,
	throttle,
	renderGaugeLabels
} from './utility'

import Timeline from './Timeline'
import Togglers from './Togglers'
import Tooltip from './Tooltip'

export default class Chartogram {
	constructor(rootNode, data, title = 'Title', props = {}) {
		this.props = {
			title,
			transitionDuration: 300,
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

		this.timeline = new Timeline(this.getTimelineProps())
		this.timeline.componentDidMount()

		this.togglers = new Togglers(this.getTogglersProps())
		this.togglers.componentDidMount()

		this.tooltip = new Tooltip(this.getTooltipProps())
		this.tooltip.componentDidMount()

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
	}

	onResize = (event) => {
		this.setState({
			aspectRatio: this.getCanvasAspectRatio(),
			canvasWidthPx: this.getCanvasWidthPx()
		}, false)
	}

	onResizeThrottled = throttle(this.onResize, 33)

	getCanvasAspectRatio() {
		const canvasDimensions = this.canvas.getBoundingClientRect()
		return canvasDimensions.width / canvasDimensions.height
	}

	getCanvasWidthPx() {
		const canvasDimensions = this.canvas.getBoundingClientRect()
		return canvasDimensions.width
	}

	setState(newState, renderTimeline = true) {
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
			minYGlobal: this.state.minYGlobal,
			maxYGlobal: this.state.maxYGlobal,
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
			canvasWidthPx: this.state.canvasWidthPx,
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
			canvasWidthPx: this.getCanvasWidthPx(),
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
		this.setState(this.createState(from, to), false)
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

	render() {
		const { canvasWidth, gaugeTickMarksCount } = this.props
		const { minX, maxX, minY, maxY, xGraphPoints, aspectRatio, graphOpacity } = this.state
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
		let i = 0
		while (i < this.state.y.length) {
			const { color, graphPoints, isShown } = this.state.y[i]
			const opacity = graphOpacity[i]
			// Draw chart.
			if (isShown || opacity > 0) {
				const graph = document.createElement('polyline')
				graph.setAttribute('stroke', color)
				graph.setAttribute('points', this.createPolylinePoints(
					xGraphPoints.map(this.mapX),
					graphPoints.map(y => this.mapY(maxY - y))
				).join(' '))
				graph.classList.add('chartogram__graph')
				if (opacity !== 1) {
					graph.style.opacity = opacity
				}
				this.canvas.appendChild(graph)
			}
			i++
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
	}

	transitionState(minY, maxY, minYGlobal, maxYGlobal, graphOpacity) {
		const { transitionDuration: maxTransitionDuration } = this.props
		if (this.transition) {
			cancelAnimationFrame(this.transition)
		}
		const heightBefore = this.state.maxY - this.state.minY
		const deltaMaxY = Math.abs(maxY - this.state.maxY) / heightBefore
		const deltaMinY = Math.abs(minY - this.state.minY) / heightBefore
		const deltaY = Math.max(deltaMinY, deltaMaxY)
		const transitionDuration = maxTransitionDuration * Math.max(0.1, Math.min(deltaY, 0.5) * 2)
		this.setState({
			graphOpacityFrom: this.state.graphOpacity,
			graphOpacityTo: graphOpacity,
			minYFrom: this.state.minY,
			maxYFrom: this.state.maxY,
			minYTo: minY,
			maxYTo: maxY,
			minYGlobalFrom: this.state.minYGlobal,
			maxYGlobalFrom: this.state.maxYGlobal,
			minYGlobalTo: minYGlobal,
			maxYGlobalTo: maxYGlobal,
			transitionStartedAt: Date.now(),
			transitionDuration
		})
		// Place in a `setState()` callback in case of React.
		this.transition = requestAnimationFrame(this.transitionStateTick)
	}

	transitionStateTick = () => {
		const {
			transitionEasing
		} = this.props
		const {
			transitionStartedAt,
			transitionDuration,
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
		this.setState({
			graphOpacity: graphOpacityTo.map((_, i) => graphOpacityFrom[i] + (graphOpacityTo[i] - graphOpacityFrom[i]) * ratio),
			minY: minYFrom + (minYTo - minYFrom) * ratio,
			maxY: maxYFrom + (maxYTo - maxYFrom) * ratio,
			minYGlobal: minYGlobalFrom + (minYGlobalTo - minYGlobalFrom) * ratio,
			maxYGlobal: maxYGlobalFrom + (maxYGlobalTo - maxYGlobalFrom) * ratio
		})
		if (ratio < 1) {
			this.transition = requestAnimationFrame(this.transitionStateTick)
		} else {
			this.transition = undefined
		}
	}

	createGridLine = (y) => {
		const { minX, maxX, minY, maxY } = this.state
		const line = document.createElement('line')
		line.classList.add('chartogram__grid-line')
		line.setAttribute('x1', this.fixSvgCoordinate(this.mapX(minX)))
		line.setAttribute('x2', this.fixSvgCoordinate(this.mapX(maxX)))
		line.setAttribute('y1', this.fixSvgCoordinate(this.mapY(maxY - y)))
		line.setAttribute('y2', this.fixSvgCoordinate(this.mapY(maxY - y)))
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