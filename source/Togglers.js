import {
	clearElement
} from './utility'

export default class Togglers {
	constructor(props) {
		this.props = props
	}

	componentDidMount(rootNode) {
		const { data } = this.props
		// Add graph togglers.
		const graphTogglers = rootNode.querySelector('.chartogram__chart-togglers')
		clearElement(graphTogglers)
		for (const y of data.y) {
			graphTogglers.appendChild(this.createGraphToggler(y))
		}
	}

	createGraphToggler = ({ id, name, color }) => {
		const toggler = document.createElement('button')
		toggler.setAttribute('type', 'button')
		toggler.classList.add('chartogram__chart-toggler')
		toggler.classList.add('chartogram__chart-toggler--on')
		toggler.classList.add('chartogram__reset-button')
		// Add check.
		const xmlns = 'http://www.w3.org/2000/svg'
		const check = document.createElementNS(xmlns, 'svg')
		check.setAttribute('viewBox', '0 0 19 19')
		check.setAttribute('class', 'chartogram__chart-toggler-check')
		// Add background circle.
		const backgroundCircle = document.createElementNS(xmlns, 'circle')
		backgroundCircle.setAttribute('cx', '9.5')
		backgroundCircle.setAttribute('cy', '9.5')
		backgroundCircle.setAttribute('r', '9.5')
		backgroundCircle.setAttribute('fill', color)
		check.appendChild(backgroundCircle)
		// Add check circle.
		const checkCircle = document.createElementNS(xmlns, 'circle')
		checkCircle.setAttribute('cx', '9.5')
		checkCircle.setAttribute('cy', '9.5')
		checkCircle.setAttribute('r', '8')
		checkCircle.setAttribute('class', 'chartogram__chart-toggler-check-circle')
		check.appendChild(checkCircle)
		// Add check mark.
		const checkMark = document.createElementNS(xmlns, 'path')
		checkMark.setAttribute('d', 'M13.64 4.94l-6.2 6.34-1.69-1.9c-.73-.63-1.89.1-1.36 1.06l2 3.38c.3.43 1.04.85 1.78 0 .32-.42 6.31-7.93 6.31-7.93.74-.84-.2-1.58-.84-.95z')
		checkMark.setAttribute('fill', 'white')
		checkMark.setAttribute('class', 'chartogram__chart-toggler-check-mark')
		check.appendChild(checkMark)
		// Add checkmark.
		toggler.appendChild(check)
		// Add graph name.
		toggler.appendChild(document.createTextNode(name))
		// On click.
		toggler.addEventListener('click', () => this.onToggle(id, toggler))
		return toggler
	}

	onToggle = (id, toggler) => {
		const { onToggle } = this.props
		if (onToggle(id)) {
			toggler.classList.toggle('chartogram__chart-toggler--on')
		}
	}
}

Togglers.INITIAL_MARKUP = `
	<div class="chartogram__chart-togglers"></div>
`