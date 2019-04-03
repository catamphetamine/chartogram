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

		this.transitions = []
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
		if (this.transitionTimer) {
			cancelAnimationFrame(this.transitionTimer)
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
		this.batchTransitions()
		this.transition(this.charts, 'minY', minY)
		this.transition(this.charts, 'maxY', maxY)
		this.transition(this.timeline, 'minYGlobal', minYGlobal)
		this.transition(this.timeline, 'maxYGlobal', maxYGlobal)
		this.transition(
			this.charts,
			'graphOpacity',
			this.state.y.map(y => y.isShown ? 1 : 0),
			(graphOpacityFrom, graphOpacityTo, ratio) => {
				return graphOpacityTo.map((_, i) => graphOpacityFrom[i] + (graphOpacityTo[i] - graphOpacityFrom[i]) * ratio)
			}
		)
		this.runTransitions()
		return true
	}

	onChangeBounds = (from, to) => {
		const state = this.createState(from, to)
		const minY = state.minY
		const maxY = state.maxY
		delete state.minY
		delete state.maxY
		this.setState(state)
		this.batchTransitions()
		this.transition(this.charts, 'minY', minY)
		this.transition(this.charts, 'maxY', maxY)
		this.runTransitions()
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

	batchTransitions() {
		this.pendingTransitions = []
	}

	runTransitions() {
		// Find ongoing transitions for these owners and properties.
		const ongoingTransitions = this.transitions.filter((transition) => {
			for (const pendingTransition of this.pendingTransitions) {
				if (transition.owner === pendingTransition.owner &&
					transition.property === pendingTransition.property) {
					return true
				}
			}
		})
		// Stop those ongoing transitions.
		if (ongoingTransitions.length > 0) {
			const state = {}
			for (const transition of ongoingTransitions) {
				// Stop the transition at current time.
				transition.tick(state)
			}
			this.setState(state)
			// Remove the transitions from the list.
			this.transitions = this.transitions.filter(_ => ongoingTransitions.indexOf(_) < 0)
		}
		// Add all pending transitions.
		const { transitionDuration: maxTransitionDuration, transitionEasing } = this.props
		let transitionDuration = maxTransitionDuration
		// Adjust transition duration based on `minY` and `maxY`.
		const minYTransition = this.pendingTransitions.find(_ => _.owner === this.charts && _.property === 'minY')
		const maxYTransition = this.pendingTransitions.find(_ => _.owner === this.charts && _.property === 'maxY')
		if (minYTransition && maxYTransition) {
			const minYFrom = this.state.minY
			const maxYFrom = this.state.maxY
			const minYTo = minYTransition.toValue
			const maxYTo = maxYTransition.toValue
			const currentHeight = maxYFrom - minYFrom
			const deltaMaxY = Math.abs(maxYTo - maxYFrom) / currentHeight
			const deltaMinY = Math.abs(minYTo - minYFrom) / currentHeight
			const deltaY = Math.max(deltaMinY, deltaMaxY)
			transitionDuration = maxTransitionDuration * Math.max(0.2, Math.min(deltaY, 0.5) * 2)
		}
		// Set up transitions.
		const state = this.state
		this.transitions = this.transitions.concat(this.pendingTransitions.map((transition) => ({
			...transition,
			startedAt: Date.now(),
			duration: transitionDuration,
			easing: transitionEasing,
			fromValue: state[transition.property],
			tick(state) {
				const elapsed = Date.now() - this.startedAt
				let ratio = Math.min(elapsed / this.duration, 1)
				ratio = EASING[this.easing](ratio)
				if (this.getNewValue) {
					state[this.property] = this.getNewValue(this.fromValue, this.toValue, ratio)
				} else {
					state[this.property] = this.fromValue + (this.toValue - this.fromValue) * ratio
				}
				return ratio === 1
			}
		})))
		// Start transitions (if required).
		if (!this.transitionTimer) {
			this.transitionTimer = requestAnimationFrame(this.transitionTick)
		}
	}

	transition(owner, property, toValue, getNewValue) {
		this.pendingTransitions.push({
			owner,
			property,
			toValue,
			getNewValue
		})
	}

	transitionTick = () => {
		let finishedTransitions
		const state = {}
		for (const transition of this.transitions) {
			if (transition.tick(state)) {
				finishedTransitions = finishedTransitions || []
				finishedTransitions.push(transition)
			}
		}
		this.setState(state)
		if (finishedTransitions) {
			this.transitions = this.transitions.filter(_ => finishedTransitions.indexOf(_) < 0)
		}
		if (this.transitions.length > 0) {
			this.transitionTimer = requestAnimationFrame(this.transitionTick)
		} else {
			this.transitionTimer = undefined
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