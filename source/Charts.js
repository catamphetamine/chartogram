import {
	clearElement,
	divideInterval,
	throttle
} from './utility'

import Tooltip from './Tooltip'

const SVG_XMLNS = 'http://www.w3.org/2000/svg'

export default class Charts {
	constructor(props) {
		this.props = props
	}

	componentDidMount(rootNode) {
		this.canvasWrapper = rootNode.querySelector('.chartogram__canvas-wrapper')
		this.canvas = rootNode.querySelector('.chartogram__canvas')
		this.xAxis = rootNode.querySelector('.chartogram__x')
		this.yAxis = rootNode.querySelector('.chartogram__y')
		this.tooltipContainer = rootNode.querySelector('.chartogram__plan')

		this.state = {
			aspectRatio: this.getCanvasAspectRatio(),
			canvasWidthPx: this.canvas.getBoundingClientRect().width
		}

		this.updateAspectRatio()

		this.mountGridLines()
		this.mountXAxis()
		this.mountYAxis()
		this.mountGraphs()

		this.tooltip = new Tooltip(this.getTooltipProps())
		this.tooltip.componentDidMount(rootNode)

		this.render()

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
			canvasWidthPx: this.canvas.getBoundingClientRect().width
		})
	}

	onResizeThrottled = throttle(this.onResize, 33)

	setState(newState) {
		const previousState = this.state
		this.state = {
			...this.state,
			...newState
		}
		this.componentDidUpdate(this.props, previousState)
	}

	componentDidUpdate(previousProps, previousState) {
		if (previousState) {
			if (this.state.aspectRatio !== previousState.aspectRatio) {
				this.updateAspectRatio(this.state.aspectRatio)
			}
			// If canvas width has changed then remount X axis.
			if (this.state.canvasWidthPx !== previousState.canvasWidthPx) {
				clearElement(this.xAxis)
				this.mountXAxis()
			}
		}
		this.render()
		this.tooltip.props = this.getTooltipProps()
		this.tooltip.componentDidUpdate()
	}

	getTooltipProps() {
		return {
			canvas: this.canvas,
			container: this.tooltipContainer,
			pointsContainer: this.canvasWrapper,
			formatX: this.props.formatX,
			formatY: this.props.formatY,
			canvasWidth: this.props.canvasWidth,
			aspectRatio: this.state.aspectRatio,
			mapX: this.mapX,
			fixSvgCoordinate: this.props.fixSvgCoordinate,
			minX: this.props.minX,
			maxX: this.props.maxX,
			maxY: this.props.maxY,
			xPoints: this.props.xPoints,
			y: this.props.y
		}
	}

	mapX = (x) => {
		const { canvasWidth, minX, maxX } = this.props
		return ((x - minX) / (maxX - minX)) * canvasWidth
	}

	mapY = (y) => {
		const { canvasWidth, minY, maxY } = this.props
		const { aspectRatio } = this.state
		return ((y - minY) / (maxY - minY)) * canvasWidth / aspectRatio
	}

	updateAspectRatio(aspectRatio = this.state.aspectRatio) {
		const { canvasWidth, fixSvgCoordinate } = this.props
		// Set canvas `viewBox`.
		this.canvas.setAttribute('viewBox', `0 0 ${canvasWidth} ${fixSvgCoordinate(canvasWidth / aspectRatio)}`)
	}

	getCanvasAspectRatio() {
		const canvasDimensions = this.canvas.getBoundingClientRect()
		return canvasDimensions.width / canvasDimensions.height
	}

	render() {
		const { yAxisTickMarksCount, y, minX, maxX, minY, maxY, maxYGaugeMark, graphOpacity } = this.props
		// Calculate grid lines' coordinates.
		const minY_ = minY
		const maxY_ = maxYGaugeMark
		const yAxisScale = (maxY - minY) / (maxY_ - minY_)
		const yAxisTickMarks = divideInterval(minY_, maxY_, yAxisTickMarksCount)
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
		this.updateAxes(
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

	renderGridLine(y) {
		const { fixSvgCoordinate, minX, maxX, minY, maxY } = this.props
		const line = document.createElementNS(SVG_XMLNS, 'line')
		line.classList.add('chartogram__grid-line')
		line.setAttribute('x1', fixSvgCoordinate(this.mapX(minX)))
		line.setAttribute('x2', fixSvgCoordinate(this.mapX(maxX)))
		line.setAttribute('y1', fixSvgCoordinate(this.mapY(maxY - y)))
		line.setAttribute('y2', fixSvgCoordinate(this.mapY(maxY - y)))
		return line
	}

	mountGridLines() {
		const { yAxisTickMarksCount } = this.props
		this.gridLines = []
		let i = 0
		while (i < yAxisTickMarksCount) {
			const line = this.renderGridLine(0)
			this.gridLines.push(line)
			this.canvas.appendChild(line)
			i++
		}
	}

	mountXAxis() {
		const xGaugeTickMarksCount = this.getXGaugeTickMarksCount()
		let i = 0
		while (i < xGaugeTickMarksCount) {
			this.xAxis.appendChild(document.createElement('div'))
			i++
		}
	}

	getXGaugeTickMarksCount() {
		const { xAxisTickMarkWidth } = this.props
		const { canvasWidthPx } = this.state
		let count = canvasWidthPx / xAxisTickMarkWidth
		if (count > 2) {
			count = Math.pow(count - 2, 0.75)
		} else {
			count = 0
		}
		return 2 + Math.floor(count)
	}

	mountYAxis() {
		const { yAxisTickMarksCount } = this.props
		let i = 0
		while (i < yAxisTickMarksCount) {
			this.yAxis.appendChild(document.createElement('div'))
			i++
		}
	}

	mountGraphs() {
		this.graphs = []
		const { y } = this.props
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
		const { createPolylinePoints, xGraphPoints, maxY } = this.props
		if (typeof graph === 'number') {
			graph = this.graphs[graph]
		}
		graph.setAttribute('points', createPolylinePoints(
			xGraphPoints.map(this.mapX),
			graphPoints.map(y => this.mapY(maxY - y))
		).join(' '))
		if (opacity !== 1) {
			graph.style.opacity = opacity
		}
	}

	updateGridLine(i, y) {
		const { fixSvgCoordinate, maxY } = this.props
		const line = this.gridLines[i]
		line.setAttribute('y1', fixSvgCoordinate(this.mapY(maxY - y)))
		line.setAttribute('y2', fixSvgCoordinate(this.mapY(maxY - y)))
	}

	updateAxes(minX, maxX, minY, maxY, yAxisScale) {
		const { formatX, formatY } = this.props
		this.updateAxis(this.xAxis, minX, maxX, formatX)
		this.updateAxis(this.yAxis, minY, maxY, formatY)
		this.yAxis.style.height = `${100 / yAxisScale}%`
	}

	updateAxis(gauge, min, max, transform) {
		const tickMarksCount = gauge.childNodes.length
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

Charts.INITIAL_MARKUP = `
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