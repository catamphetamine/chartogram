export default class Transition {
	transitions = []

	constructor(getState, setState, props) {
		this.getState = getState
		this.setState = setState
		this.props = props
	}

	cleanUp() {
		if (this.timer) {
			cancelAnimationFrame(this.timer)
			this.timer = undefined
		}
	}

	batch() {
		this.pendingTransitions = []
	}

	run() {
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
			const state = { ...this.getState() }
			for (const transition of ongoingTransitions) {
				// Stop the transition at current time.
				transition.tick(state)
			}
			this.setState(state)
			// Remove the transitions from the list.
			this.transitions = this.transitions.filter(_ => ongoingTransitions.indexOf(_) < 0)
		}
		// Set up transitions.
		const transitionDuration = this.getTransitionDuration(this.pendingTransitions)
		this.transitions = this.transitions.concat(this.pendingTransitions.map((transition) => ({
			...transition,
			startedAt: Date.now(),
			duration: transitionDuration,
			easing: this.props.transitionEasing,
			fromValue: transition.getter ? transition.getter(this.getState()) : this.getState()[transition.property],
			tick(state) {
				const elapsed = Date.now() - this.startedAt
				let ratio = Math.min(elapsed / this.duration, 1)
				ratio = EASING[this.easing](ratio)
				let newValue
				if (this.getNewValue) {
					newValue = this.getNewValue(this.fromValue, this.toValue, ratio)
				} else {
					newValue = this.fromValue + (this.toValue - this.fromValue) * ratio
				}
				if (this.setter) {
					this.setter(state, newValue)
				} else {
					state[this.property] = newValue
				}
				return ratio === 1
			}
		})))
		this.pendingTransitions = undefined
		// Start transitions (if required).
		if (!this.timer) {
			this.timer = requestAnimationFrame(this.tick)
		}
	}

	add(owner, property, toValue, arg4) {
		let getter
		let setter
		if (typeof property !== 'string') {
			getter = property
			setter = toValue
			toValue = arg4
			property = undefined
		}
		this.pendingTransitions.push({
			owner,
			property,
			getter,
			setter,
			toValue
		})
	}

	tick = () => {
		let finishedTransitions
		const state = { ...this.getState() }
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
			this.timer = requestAnimationFrame(this.tick)
		} else {
			this.timer = undefined
		}
	}

	getTransitionDuration(pendingTransitions) {
		const { transitionDuration: maxTransitionDuration } = this.props
		let transitionDuration = maxTransitionDuration
		// Adjust transition duration based on `minY` and `maxY`.
		const minYTransition = pendingTransitions.find(_ => _.owner === 'charts' && _.property === 'minY')
		const maxYTransition = pendingTransitions.find(_ => _.owner === 'charts' && _.property === 'maxY')
		if (minYTransition && maxYTransition) {
			const minYFrom = this.getState().minY
			const maxYFrom = this.getState().maxY
			const minYTo = minYTransition.toValue
			const maxYTo = maxYTransition.toValue
			const currentHeight = maxYFrom - minYFrom
			const deltaMaxY = Math.abs(maxYTo - maxYFrom) / currentHeight
			const deltaMinY = Math.abs(minYTo - minYFrom) / currentHeight
			const deltaY = Math.max(deltaMinY, deltaMaxY)
			transitionDuration = maxTransitionDuration * Math.max(0.2, Math.min(deltaY, 0.5) * 2)
		}
		return transitionDuration
	}
}

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