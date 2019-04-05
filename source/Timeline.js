import {
	clearElement,
	commaJoin,
	simplifyGraph,
	throttle,
	setUpDrag
} from './utility'

const TIMELINE_GRAPH_MAX_POINTS = 80
const SVG_XMLNS = 'http://www.w3.org/2000/svg'

export default class Timeline {
	constructor(props) {
		this.props = props
	}

	componentDidUpdate() {
		this.state = {
			aspectRatio: this.getCanvasAspectRatio()
		}
		this.onChangeBounds(this.props.fromRatio, this.props.toRatio),
		this.render()
	}

	componentDidMount(rootNode) {
		this.timeline = rootNode.querySelector('.chartogram__timeline')
		this.timelineOverlayLeft = rootNode.querySelector('.chartogram__timeline-overlay-left')
		this.timelineWindowLeftHandle = rootNode.querySelector('.chartogram__timeline-window__left-handle')
		this.timelineWindow = rootNode.querySelector('.chartogram__timeline-window')
		this.timelineWindowDrag = rootNode.querySelector('.chartogram__timeline-window__drag')
		this.timelineWindowRightHandle = rootNode.querySelector('.chartogram__timeline-window__right-handle')
		this.timelineOverlayRight = rootNode.querySelector('.chartogram__timeline-overlay-right')
		this.timelineCanvas = rootNode.querySelector('.chartogram__timeline-canvas')

		this.state = {
			aspectRatio: this.getCanvasAspectRatio()
		}

		this.updateAspectRatio()

		this.setUpTimelineWindowHandle('left')
		this.setUpTimelineWindowHandle('right')
		this.setUpTimelineWindow()

		// Add window resize event listener.
		window.addEventListener('resize', this.onResizeThrottled)

		this.onChangeBounds(this.props.fromRatio, this.props.toRatio)

		this.mountGraphs()

		this.render()
	}

	componentWillUnmount() {
		// Remove window resize event listener.
		window.removeEventListener('resize', this.onResizeThrottled)
	}

	onResize = (event) => {
		this.setState({
			aspectRatio: this.getCanvasAspectRatio()
		})
	}

	onResizeThrottled = throttle(this.onResize, 33)

	setState = (newState) => {
		if (newState.aspectRatio !== this.state.aspectRatio) {
			this.updateAspectRatio(newState.aspectRatio)
		}
		this.state = {
			...this.state,
			...newState
		}
		this.render()
	}

	updateAspectRatio(aspectRatio = this.state.aspectRatio) {
		const { canvasWidth, fixSvgCoordinate } = this.props
		// Set canvas `viewBox`.
		this.timelineCanvas.setAttribute('viewBox', `0 0 ${canvasWidth} ${fixSvgCoordinate(canvasWidth / aspectRatio)}`)
	}

	getCanvasAspectRatio() {
		const timelineCanvasDimensions = this.timelineCanvas.getBoundingClientRect()
		return timelineCanvasDimensions.width / timelineCanvasDimensions.height
	}

	render() {
		const { y, data, graphOpacity } = this.props
		// Update graphs.
		let i = 0
		while (i < data.y.length) {
			const { id, points, color } = data.y[i]
			const isShown = y.find(_ => _.id === id).isShown
			const opacity = graphOpacity[i]
			// Update graph.
			if (isShown || opacity > 0) {
				const [_x, _y] = simplifyGraph(data.x.points, points, TIMELINE_GRAPH_MAX_POINTS)
				if (this.graphs[i]) {
					this.updateGraph(i, _x, _y, opacity)
				} else {
					this.mountGraph(i, _x, _y, color, opacity)
				}
			} else if (this.graphs[i]) {
				this.unmountGraph(i)
			}
			i++
		}
	}

	renderGraph(x, y, color, opacity = 1) {
		const graph = document.createElementNS(SVG_XMLNS, 'polyline')
		graph.setAttribute('stroke', color)
		graph.setAttribute('fill', 'none')
		this.updateGraph(graph, x, y, opacity)
		graph.setAttribute('class', 'chartogram__graph')
		return graph
	}

	mountGraphs() {
		this.graphs = []
		const { data } = this.props
		data.y.forEach(({ points, color }, i) => {
			this.mountGraph(i, data.x.points, points, color)
		})
	}

	mountGraph(i, x, y, color, opacity) {
		const graph = this.renderGraph(x, y, color, opacity)
		this.graphs[i] = graph
		this.timelineCanvas.appendChild(graph)
	}

	unmountGraph(i) {
		this.timelineCanvas.removeChild(this.graphs[i])
		this.graphs[i] = undefined
	}

	updateGraph(graph, x, y, opacity) {
		const { maxY, createPolylinePoints } = this.props
		if (typeof graph === 'number') {
			graph = this.graphs[graph]
		}
		graph.setAttribute('points', createPolylinePoints(
			x.map(this.mapX),
			y.map(y => this.mapY(maxY - y))
		).join(' '))
		if (opacity !== 1) {
			graph.style.opacity = opacity
		}
	}

	onChangeBounds(from, to) {
		this.setTimelineWindowLeft(from)
		this.setTimelineWindowRight(to)
	}

	updateBounds(from, to) {
		this.props.onChangeBounds(from, to)
		this.props.fromRatio = from
		this.props.toRatio = to
		this.onChangeBounds(from, to)
	}

	mapX = (x) => {
		const { canvasWidth, data } = this.props
		const { minX, maxX } = data
		return ((x - minX) / (maxX - minX)) * canvasWidth
	}

	mapY = (y) => {
		const { canvasWidth, minY, maxY } = this.props
		const { aspectRatio } = this.state
		return ((y - minY) / (maxY - minY)) * canvasWidth / aspectRatio
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
			let ratio = (x - timelineCoordinates.left) / timelineCoordinates.width
			// Due to CSS em -> px rounding precision `ratio` may
			// sometimes be out of bounds on the edges of the timeline.
			// For example, for the right timeline window handle
			// its width may be "6.39844" but the collapsed timeline window
			// width may be "12.796875" which is "6.3984375" x2.
			ratio = Math.min(Math.max(ratio, 0), 1)
			if (side === 'left') {
				this.updateBounds(ratio, this.props.toRatio)
			} else {
				this.updateBounds(this.props.fromRatio, ratio)
			}
		}
		const onDragStart = (x) => {
			timelineCoordinates = this.timeline.getBoundingClientRect()
			const timelineWindowCoordinates = this.timelineWindow.getBoundingClientRect()
			if (side === 'left') {
				minX = timelineCoordinates.left
				maxX = timelineWindowCoordinates.left + timelineWindowCoordinates.width - 2 * handleWidth
				deltaX = x - timelineWindowCoordinates.left
			} else {
				minX = timelineWindowCoordinates.left + 2 * handleWidth
				maxX = timelineCoordinates.left + timelineCoordinates.width
				deltaX = x - (timelineWindowCoordinates.left + timelineWindowCoordinates.width)
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
			const ratio = (x - timelineCoordinates.left) / timelineCoordinates.width
			this.updateBounds(ratio, ratio + timelineWindowCoordinates.width / timelineCoordinates.width)
		}
		const onDragStart = (x) => {
			timelineCoordinates = this.timeline.getBoundingClientRect()
			timelineWindowCoordinates = this.timelineWindow.getBoundingClientRect()
			innerX = x - timelineWindowCoordinates.left
			minX = timelineCoordinates.left
			maxX = timelineCoordinates.left + (timelineCoordinates.width - timelineWindowCoordinates.width)
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
}

Timeline.INITIAL_MARKUP = `
	<div class="chartogram__timeline">
		<div class="chartogram__timeline-canvas-padding">
			<svg class="chartogram__timeline-canvas"></svg>
		</div>
		<div class="chartogram__timeline-overlay-left"></div>
		<div class="chartogram__timeline-overlay-right"></div>
		<div class="chartogram__timeline-window">
			<button type="button" class="chartogram__reset-button chartogram__timeline-window__drag"></button>
			<button type="button" class="chartogram__reset-button chartogram__timeline-window__left-handle"></button>
			<button type="button" class="chartogram__reset-button chartogram__timeline-window__right-handle"></button>
		</div>
	</div>
`