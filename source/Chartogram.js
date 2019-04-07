import {
	clearElement,
	commaJoin,
	roundNumber
} from './utility'

import Charts from './Charts'
import Timeline from './Timeline'
import Togglers from './Togglers'
import Transition from './Transition'

export default class Chartogram {
	constructor(rootNode, data, title = 'Title', props = {}) {
		this.props = {
			title,
			transitionDuration: 250,
			transitionEasing: 'easeOutQuad',
			xAxisTickMarkWidth: 60,
			yAxisTickMarksCount: 6,
			yAxisPrecision: 0,
			timelineWindowSize: 40,
			canvasWidth: 512,
			precisionFactor: Math.pow(10, props.precision || 3),
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

		this.transition = new Transition(
			() => this.state,
			this.setState,
			this.props
		)
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
		this.transition.cleanUp()
		this.rootNode.classList.remove('chartogram')
		clearElement(this.rootNode)
	}

	setState = (newState) => {
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
			fixSvgCoordinate: this.fixSvgCoordinate,
			formatX: this.formatX,
			formatY: this.formatY
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
		const { yAxisTickMarksCount, yAxisPrecision } = this.props
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
		const maxYGaugeMark = roundNumber(maxY, yAxisTickMarksCount - 1, yAxisPrecision)
		maxY = Math.max(maxY, maxYGaugeMark)
		// Min Y is always 0 by design.
		minYGlobal = 0
		return {
			minY,
			maxY,
			minYGlobal,
			maxYGlobal,
			maxYGaugeMark
		}
	}

	onToggle = (id) => {
		const i = this.state.y.findIndex(_ => _.id === id)
		const y = this.state.y[i]
		// Won't allow hiding all graphs.
		if (y.isShown) {
			const graphsShown = this.state.y.filter(_ => _.isShown)
			if (graphsShown.length === 1) {
				return
			}
		}
		// Mutating `this.state` without `setState()` for simplicity.
		y.isShown = !y.isShown
		const {
			minY,
			maxY,
			minYGlobal,
			maxYGlobal,
			maxYGaugeMark
		} = this.calculateMinMaxY(this.state.y)
		this.transition.batch()
		this.transition.add('charts', 'minY', minY)
		this.transition.add('charts', 'maxY', maxY)
		this.transition.add('charts', 'maxYGaugeMark', maxYGaugeMark)
		this.transition.add('timeline', 'minYGlobal', minYGlobal)
		this.transition.add('timeline', 'maxYGlobal', maxYGlobal)
		this.transition.add(
			`graph#${id}/opacity`,
			(state) => state.graphOpacity[i],
			(state, value) => {
				// Change `graphOpacity` for "shallow equal" comparison.
				state.graphOpacity = state.graphOpacity.slice()
				state.graphOpacity[i] = value
			},
			y.isShown ? 1 : 0
		)
		this.transition.run()
		return y.isShown
	}

	onChangeBounds = (from, to) => {
		const state = this.createState(from, to)
		const minY = state.minY
		const maxY = state.maxY
		const maxYGaugeMark = state.maxYGaugeMark
		delete state.minY
		delete state.maxY
		delete state.maxYGaugeMark
		this.setState(state)
		this.transition.batch()
		this.transition.add('charts', 'minY', minY)
		this.transition.add('charts', 'maxY', maxY)
		this.transition.add('charts', 'maxYGaugeMark', maxYGaugeMark)
		this.transition.run()
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

	formatX = (value, options = {}) => {
		const { locale, formatX } = this.props
		if (formatX) {
			return formatX(value, options)
		}
		if (!this.dateTimeFormatShort) {
			this.dateTimeFormatShort = new Intl.DateTimeFormat(locale, {
				month: 'short',
				day: 'numeric'
			})
			this.dateTimeFormatLong = new Intl.DateTimeFormat(locale, {
				weekday: 'short',
				month: 'short',
				day: 'numeric'
			})
			this.dateTimeFormatLongWithYear = new Intl.DateTimeFormat(locale, {
				weekday: 'short',
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			})
		}
		const date = new Date(value)
		if (options.long) {
			// const isSameYear = date.getFullYear() === new Date().getFullYear()
			// if (isSameYear) {
				return this.dateTimeFormatLong.format(date)
			// } else {
			// 	return this.dateTimeFormatLongWithYear.format(date)
			// }
		} else {
			return this.dateTimeFormatShort.format(date)
		}
	}

	formatY = (value, options = {}) => {
		const { locale, formatY, yAxisPrecision } = this.props
		if (formatY) {
			return formatY(value, options)
		}
		if (!this.numberFormat) {
			this.numberFormat = new Intl.NumberFormat(locale, {
				minimumFractionDigits: yAxisPrecision,
				maximumFractionDigits: yAxisPrecision
			})
		}
		const precisionFactor = yAxisPrecision && Math.pow(10, yAxisPrecision)
		if (precisionFactor) {
			value *= precisionFactor
		}
		value = Math.round(value)
		if (precisionFactor) {
			value /= precisionFactor
		}
		return this.numberFormat.format(value)
	}
}