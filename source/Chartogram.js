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
			gaugeTickMarksCount: 6,
			timelineWindowSize: 40,
			canvasWidth: 512,
			precisionFactor: Math.pow(10, props.precision || 3),
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
		this.rootNode.classList.remove('chartogram')
		clearElement(this.rootNode)
		// Remove window resize event listener.
		window.removeEventListener('resize', this.onResizeThrottled)
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
			yScale: this.state.yScale,
			onChangeBounds: this.onChangeBounds
		}
	}

	getTogglersProps() {
		return {
			rootNode: this.rootNode,
			data: this.data,
			onToggle: (id) => {
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
					y: this.state.y,
					...this.calculateMinMaxY(this.state.y)
				})
				return true
			}
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
	}

	// animateScale(scale) {
	// 	this.setState({
	// 		yScaleFrom: this.state.yScale,
	// 		yScale,
	// 		yScaleTransitionStartedAt: Date.now()
	// 	}) = scale
	// 	requestAnimationFrame(this.transitionScaleTick)
	// }

	// transitionScaleTick = () => {
	// 	const { yScaleTransitionStartedAt, yScaleFrom, yScale } = this.state
	// 	const elapsed = Date.now() - yScaleTransitionStartedAt
	// 	const ratio = Math.min(elapsed / 300, 1)
	// 	this.setState({
	// 		yScaleTransitioned: yScaleFrom + (yScale - yScaleFrom) * ratio
	// 	})
	// 	if (ratio < 1) {
	// 		requestAnimationFrame(this.transitionScaleTick)
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
}