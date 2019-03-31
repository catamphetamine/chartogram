import Chartogram from './Chartogram'

export default function chartogram(rootNode, data, title, options) {
	const chartogram = new Chartogram(rootNode, data, title, options)
	chartogram.componentDidMount()
	chartogram.render()
	return () => {
		chartogram.componentWillUnmount()
	}
}