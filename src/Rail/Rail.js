import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { callAll } from '../utils'

class Rail extends Component {
  getRailProps = (props = {}) => {
    const {
      emitMouse,
      emitTouch,
      emitMouseEnter,
      emitMouseMove,
      emitMouseLeave,
    } = this.props

    return {
      ...props,
      onMouseDown: callAll(props.onMouseDown, emitMouse),
      onTouchStart: callAll(props.onTouchStart, emitTouch),
      onMouseEnter: e => emitMouseEnter(e, null),
      onMouseMove: e => emitMouseMove(e, null),
      onMouseLeave: e => emitMouseLeave(e, null),
    }
  }

  render() {
    const {
      getRailProps,
      props: { children },
    } = this

    const renderedChildren = children({ getRailProps })
    return renderedChildren && React.Children.only(renderedChildren)
  }
}

Rail.propTypes = {
  /** @ignore */
  emitMouse: PropTypes.func,
  /** @ignore */
  emitMouseEnter: PropTypes.func,
  /** @ignore */
  emitMouseMove: PropTypes.func,
  /** @ignore */
  emitMouseLeave: PropTypes.func,
  /** @ignore */
  emitTouch: PropTypes.func,
  /**
   * A function to render the rail. `({ getRailProps }): element`
   */
  children: PropTypes.func.isRequired,
}

export default Rail
