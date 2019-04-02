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

	componentDidUpdate(props) {
		if (this.props !== props) {
			this.props = props
		}
	}

	setUpListener = () => {
		const { canvas, canvasWidthPx, weekdays, months } = this.props
		let canvasDimensions
		let isIndexInBounds
		const onTrack = (screenX) => {
			const { minX, maxX, xPoints, y } = this.props
			const xScreenRatio = (screenX - canvasDimensions.left) / canvasDimensions.width
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
				let left = xRatio * canvasWidthPx
				left -= 40
				const tooltipWidth = this.tooltip.getBoundingClientRect().width
				const overflow = 5
				if (left < -1 * overflow) {
					left = -1 * overflow
				} else if (left + tooltipWidth > canvasWidthPx + overflow) {
					left = (canvasWidthPx + overflow) - tooltipWidth
				}
				this.tooltip.style.left = left + 'px'
				this.updatePoints(xIndex, xRatio)
				this.updateLine(x)
			}
		}
		const onTrackStart = () => {
			canvasDimensions = canvas.getBoundingClientRect()
			isIndexInBounds = (index) => {
				const { xPoints } = this.props
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
			if (x < canvasDimensions.left ||
				x > canvasDimensions.left + canvasDimensions.width ||
				y < canvasDimensions.top ||
				y > canvasDimensions.top + canvasDimensions.height) {
				onTrackStop()
			} else {
				onTrack(x, y)
			}
		}
		function onPointerMove(event) {
			onTrack(event.clientX, event.clientY)
		}
		const onTrackStop = () => {
			canvas.removeEventListener('pointermove', onPointerMove)
			canvas.removeEventListener('pointerleave', onTrackStop)
			canvas.removeEventListener('pointercancel', onTrackStop)
			canvas.removeEventListener('touchmove', onTouchMove)
			canvas.removeEventListener('touchend', onTrackStop)
			canvas.removeEventListener('touchcancel', onTrackStop)
			this.unmount()
		}
		const onPointerEnter = () => {
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

	mount() {
		this.renderTooltip()
		this.renderPoints()
		if (!this.isLineRendered()) {
			this.renderLine()
		}
	}

	renderTooltip() {
		const { y, container } = this.props
		// Create tooltip.
		this.tooltip = document.createElement('div')
		this.tooltip.classList.add('chartogram__tooltip')
		container.appendChild(this.tooltip)
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

	renderLine() {
		const { canvas } = this.props
		const xmlns = 'http://www.w3.org/2000/svg'
		this.line = document.createElementNS(xmlns, 'line')
		this.line.setAttribute('class', 'chartogram__tooltip-line')
		canvas.insertBefore(this.line, canvas.querySelector('polyline'))
	}

	unmount() {
		if (this.tooltip) {
			const { container } = this.props
			this.tooltipForX = undefined
			container.removeChild(this.tooltip)
			this.tooltip = undefined
			this.unmountPoints()
			if (this.isLineRendered()) {
				this.unmountLine()
			}
		}
	}

	isLineRendered() {
		const { canvas } = this.props
		return this.line && this.line.parentNode === canvas
	}

	unmountLine = () => {
		const { canvas } = this.props
		canvas.removeChild(this.line)
		this.line = undefined
	}

	renderPoints() {
		this.points = []
		const { pointsContainer, y } = this.props
		for (const _y of y) {
			if (_y.isShown) {
				const point = document.createElement('div')
				point.classList.add('chartogram__tooltip-point')
				point.style.color = _y.color
				this.points.push(point)
				pointsContainer.appendChild(point)
			}
		}
	}

	unmountPoints = () => {
		const { pointsContainer } = this.props
		for (const point of this.points) {
			pointsContainer.removeChild(point)
		}
		this.points = undefined
	}

	updateLine = (x) => {
		if (!this.isLineRendered()) {
			this.renderLine()
		}
		const { canvasWidth, aspectRatio, fixSvgCoordinate, mapX } = this.props
		this.line.setAttributeNS(null, 'x1', fixSvgCoordinate(mapX(x)))
		this.line.setAttributeNS(null, 'x2', fixSvgCoordinate(mapX(x)))
		this.line.setAttributeNS(null, 'y1', 0)
		this.line.setAttributeNS(null, 'y2', fixSvgCoordinate(canvasWidth / aspectRatio))
	}

	updatePoints = (xIndex, xRatio) => {
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