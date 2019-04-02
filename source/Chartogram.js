import {
	clearElement,
	commaJoin
} from './utility'

import Charts from './Charts'
import Timeline from './Timeline'
import Togglers from './Togglers'

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
			<header class="chartogram__header">
				<h1 class="chartogram__title">${this.props.title}</h1>
			</header>
			${Charts.INITIAL_MARKUP}
			${Timeline.INITIAL_MARKUP}
			${Togglers.INITIAL_MARKUP}
		`

		// Render will be called after `.componentDidMount()`.
		this.state = this.getInitialState()

		this.charts = new Charts(this.getChartsProps())
		this.charts.componentDidMount(this.rootNode)

		this.timeline = new Timeline(this.getTimelineProps())
		this.timeline.componentDidMount(this.rootNode)

		this.togglers = new Togglers(this.getTogglersProps())
		this.togglers.componentDidMount(this.rootNode)
	}

	componentWillUnmount() {
		this.charts.componentWillUnmount()
		this.timeline.componentWillUnmount()
		this.rootNode.classList.remove('chartogram')
		clearElement(this.rootNode)
		if (this.transition) {
			cancelAnimationFrame(this.transition)
		}
	}

	setState(newState) {
		const previousState = this.state
		this.state = {
			...this.state,
			...newState
		}
		this.componentDidUpdate(this.props, previousState)
	}

	componentDidUpdate(previousProps, previousState) {
		this.charts.props = this.getChartsProps()
		this.charts.componentDidUpdate()
		if (this.shouldUpdateTimeline(previousState)) {
			this.timeline.props = this.getTimelineProps()
			this.timeline.componentDidUpdate()
		}
	}

	shouldUpdateTimeline(previousState) {
		return this.state.graphOpacity !== previousState.graphOpacity ||
			this.state.minYGlobal !== previousState.minYGlobal ||
			this.state.maxYGlobal !== previousState.maxYGlobal
	}

	getChartsProps() {
		return {
			...this.props,
			...this.state,
			createPolylinePoints: this.createPolylinePoints,
			fixSvgCoordinate: this.fixSvgCoordinate
		}
	}

	getTimelineProps() {
		return {
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
			data: this.data,
			onToggle: this.onToggle
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
		// Mutating `this.state` without `setState()`.
		y.isShown = !y.isShown
		const {
			minY,
			maxY,
			minYGlobal,
			maxYGlobal
		} = this.calculateMinMaxY(this.state.y)
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
		this.setState(state)
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

	transitionState(minY, maxY, minYGlobal, maxYGlobal, graphOpacity) {
		const { transitionDuration: maxTransitionDuration } = this.props
		if (this.transition) {
			cancelAnimationFrame(this.transition)
			this.transitionStateTick()
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
		this.setState(state)
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
		this.setState(state)
		if (ratio < 1) {
			this.transition = requestAnimationFrame(this.transitionStateTick)
		} else {
			this.transition = undefined
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