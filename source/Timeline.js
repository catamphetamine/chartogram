import {
	clearElement,
	commaJoin,
	simplifyGraph,
	throttle,
	setUpDrag
} from './utility'

export default class Timeline {
	constructor(props) {
		this.props = props
	}

	componentDidUpdate(props) {
		if (this.props !== props) {
			this.props = props
			this.state = {
				aspectRatio: this.getCanvasAspectRatio()
			}
			this.onChangeBounds(this.props.fromRatio, this.props.toRatio),
			this.render()
		}
	}

	componentDidMount() {
		const { rootNode } = this.props

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

		this.setUpTimelineWindowHandle('left')
		this.setUpTimelineWindowHandle('right')
		this.setUpTimelineWindow()

		// Add window resize event listener.
		window.addEventListener('resize', this.onResizeThrottled)

		this.onChangeBounds(this.props.fromRatio, this.props.toRatio)
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
		this.state = {
			...this.state,
			...newState
		}
		this.render()
	}

	getCanvasAspectRatio() {
		const timelineCanvasDimensions = this.timelineCanvas.getBoundingClientRect()
		return timelineCanvasDimensions.width / timelineCanvasDimensions.height
	}

	render() {
		const { canvasWidth, y, data, maxYGlobal, fixSvgCoordinate, createPolylinePoints, graphOpacity } = this.props
		const { aspectRatio } = this.state
		// Clear canvas.
		clearElement(this.timelineCanvas)
		// Set canvas `viewBox`.
		this.timelineCanvas.setAttribute('viewBox', `0 0 ${canvasWidth} ${fixSvgCoordinate(canvasWidth / aspectRatio)}`)
		// Draw graphs.
		let i = 0
		while (i < data.y.length) {
			const { id, color, points } = data.y[i]
			const opacity = graphOpacity[i]
			const isShown = y.find(_ => _.id === id).isShown
			if (isShown || opacity > 0) {
				const [_x, _y] = simplifyGraph(data.x.points, points, 80)
				const graph = document.createElement('polyline')
				graph.setAttribute('stroke', color)
				graph.setAttribute('points', createPolylinePoints(
					_x.map(this.mapX),
					_y.map(y => this.mapY(maxYGlobal - y))
				).join(' '))
				graph.classList.add('chartogram__graph')
				if (opacity !== 1) {
					graph.style.opacity = opacity
				}
				this.timelineCanvas.appendChild(graph)
			}
			i++
		}
		// A workaround to fix WebKit bug when it's not re-rendering the <svg/>.
		// https://stackoverflow.com/questions/30905493/how-to-force-webkit-to-update-svg-use-elements-after-changes-to-original
		this.timelineCanvas.innerHTML += ''
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
		const { canvasWidth, minYGlobal, maxYGlobal } = this.props
		const { aspectRatio } = this.state
		return ((y - minYGlobal) / (maxYGlobal - minYGlobal)) * canvasWidth / aspectRatio
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
			const ratio = (x - timelineCoordinates.left) / timelineCoordinates.width
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
`