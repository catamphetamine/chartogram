import { setUpTouchMove } from './utility'

const SVG_XMLNS = 'http://www.w3.org/2000/svg'

export default class Tooltip {
	constructor(props) {
		this.props = props
	}

	componentDidMount() {
		this.unlisten = this.setUpListener()
	}

	componentWillUnmount() {
		this.unlisten()
		this.unmount()
	}

	componentDidUpdate() {
		// Ignored.
	}

	setUpListener = () => {
		const { canvas } = this.props
		setUpTouchMove(
			canvas,
			() => {},
			this.onTrack,
			() => this.unmount()
		)
	}

	onTrack = (screenX, screenY, canvasDimensions) => {
		const { minX, maxX, xPoints } = this.props
		const xScreenRatio = (screenX - canvasDimensions.left) / canvasDimensions.width
		const xPoint = minX + xScreenRatio * (maxX - minX)
		let xHigherIndex = xPoints.findIndex(_ => _ >= xPoint)
		let xLowerIndex = xHigherIndex - 1
		if (xHigherIndex < 0 || xHigherIndex >= xPoints.length) {
			xHigherIndex = -1
		}
		if (xLowerIndex < 0 || xLowerIndex >= xPoints.length) {
			xLowerIndex = -1
		}
		let xIndex
		if (xHigherIndex < 0) {
			if (xLowerIndex < 0) {
				return this.unmount()
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
				this.mount()
			}
			this.updateTooltip(x, xIndex, canvasDimensions.width)
		}
	}

	mount() {
		const { container } = this.props
		this.tooltip = this.renderTooltip()
		container.appendChild(this.tooltip)
		this.mountPoints()
		if (!this.isLineRendered()) {
			this.mountLine()
		}
	}

	unmount() {
		if (!this.tooltip) {
			return
		}
		const { container } = this.props
		this.tooltipForX = undefined
		container.removeChild(this.tooltip)
		this.tooltip = undefined
		this.unmountPoints()
		if (this.isLineRendered()) {
			this.unmountLine()
		}
	}

	mountLine() {
		const { canvas } = this.props
		this.line = this.renderLine()
		canvas.insertBefore(this.line, canvas.querySelector('polyline'))
	}

	unmountLine = () => {
		const { canvas } = this.props
		canvas.removeChild(this.line)
		this.line = undefined
	}

	mountPoints = () => {
		const { pointsContainer } = this.props
		this.points = this.renderPoints()
		for (const point of this.points) {
			pointsContainer.appendChild(point)
		}
	}

	unmountPoints = () => {
		const { pointsContainer } = this.props
		for (const point of this.points) {
			pointsContainer.removeChild(point)
		}
		this.points = undefined
	}

	renderTooltip() {
		const { y } = this.props
		// Create tooltip.
		const tooltip = document.createElement('div')
		tooltip.classList.add('chartogram__tooltip')
		// Add tooltip title.
		const tooltipDate = document.createElement('h1')
		tooltipDate.classList.add('chartogram__tooltip-header')
		tooltip.appendChild(tooltipDate)
		// Add graph values.
		const tooltipValues = document.createElement('dl')
		tooltipValues.classList.add('chartogram__tooltip-values')
		tooltip.appendChild(tooltipValues)
		// Add graph values.
		for (const { isShown, color } of y) {
			if (isShown) {
				// Add graph value.
				const tooltipValue = document.createElement('dt')
				tooltipValue.style.color = color
				tooltipValues.appendChild(tooltipValue)
				// Add graph name.
				const tooltipName = document.createElement('dd')
				tooltipName.style.color = color
				tooltipValues.appendChild(tooltipName)
			}
		}
		return tooltip
	}

	renderLine() {
		const line = document.createElementNS(SVG_XMLNS, 'line')
		line.setAttribute('class', 'chartogram__tooltip-line')
		return line
	}

	isLineRendered() {
		const { canvas } = this.props
		return this.line && this.line.parentNode === canvas
	}

	renderPoints() {
		const points = []
		const { pointsContainer, y } = this.props
		for (const _y of y) {
			if (_y.isShown) {
				const point = document.createElement('div')
				point.classList.add('chartogram__tooltip-point')
				point.style.color = _y.color
				points.push(point)
				pointsContainer.appendChild(point)
			}
		}
		return points
	}

	updateTooltip(x, xIndex, canvasWidth) {
		const { minX, maxX } = this.props
		const xRatio = (x - minX) / (maxX - minX)
		this.updateTooltipXValue(x)
		this.updateTooltipYValues(xIndex)
		this.updateTooltipPosition(xRatio, canvasWidth)
		this.updatePointPositions(xIndex, xRatio)
		this.updateLinePosition(x)
	}

	updateTooltipPosition(xRatio, canvasWidth) {
		const { tooltipShift, maxOverflow } = this.props
		let left = xRatio * canvasWidth
		left -= tooltipShift === undefined ? 40 : tooltipShift
		const tooltipWidth = this.tooltip.getBoundingClientRect().width
		const overflow = maxOverflow === undefined ? 5 : maxOverflow
		if (left < -1 * overflow) {
			left = -1 * overflow
		} else if (left + tooltipWidth > canvasWidth + overflow) {
			left = (canvasWidth + overflow) - tooltipWidth
		}
		this.tooltip.style.left = left + 'px'
	}

	updateTooltipXValue(x) {
		const { formatX } = this.props
		const tooltipDate = this.tooltip.childNodes[0]
		tooltipDate.textContent = formatX(x, { long: true })
	}

	updateTooltipYValues(xIndex) {
		const { y } = this.props
		const tooltipValues = this.tooltip.childNodes[1]
		let i = 0
		for (const { isShown, points, name } of y) {
			if (isShown) {
				tooltipValues.childNodes[2 * i].textContent = points[xIndex]
				tooltipValues.childNodes[2 * i + 1].textContent = name
				i++
			}
		}
	}

	updateLinePosition = (x) => {
		if (!this.isLineRendered()) {
			this.mountLine()
		}
		const { canvasWidth, aspectRatio, fixSvgCoordinate, mapX } = this.props
		this.line.setAttributeNS(null, 'x1', fixSvgCoordinate(mapX(x)))
		this.line.setAttributeNS(null, 'x2', fixSvgCoordinate(mapX(x)))
		this.line.setAttributeNS(null, 'y1', 0)
		this.line.setAttributeNS(null, 'y2', fixSvgCoordinate(canvasWidth / aspectRatio))
	}

	updatePointPositions = (xIndex, xRatio) => {
		const { maxY, y } = this.props
		let i = 0
		let j = 0
		while (i < y.length) {
			if (y[i].isShown) {
				const point = this.points[j]
				const _y = y[i].points[xIndex]
				const yRatio = _y / maxY
				point.style.left = `${xRatio * 100}%`
				point.style.bottom = `${yRatio * 100}%`
				j++
			}
			i++
		}
	}
}