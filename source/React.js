// Not tested but I guess it would work.

import React from 'react'
import PropTypes from 'prop-types'
import chartogram from './index'

export default class Chartogram extends React.Component {
  static propTypes = {
    data: PropTypes.shape({
      x: PropTypes.shape({
        points: PropTypes.arrayOf(PropTypes.number).isRequired
      }).isRequired,
      y: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        color: PropTypes.string.isRequired,
        points: PropTypes.arrayOf(PropTypes.number).isRequired
      })).isRequired
    }).isRequired,
    title: PropTypes.string.isRequired,
    options: PropTypes.object
  }

  node = React.createRef()

  componentDidMount() {
    const { data, title, options } = this.props
    this.cleanUp = chartogram(this.node.current, data, title, options)
  }

  componentWillUnmount() {
    this.cleanUp()
  }

  render() {
    const {
      data,
      title,
      options,
      ...rest
    } = this.props
    return React.createElement('section', {
      ref: this.node,
      ...rest
    })
  }
}
