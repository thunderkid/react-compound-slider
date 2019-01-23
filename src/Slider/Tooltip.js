import React, { Component } from 'react'

class StandardTooltip extends Component {
  render() {
    const { tti, rend } = this.props
    console.log(`tti got ${JSON.stringify(tti)}`)
    return (
      <>
        {tti && (
          <div
            className="tooltip"
            style={{ position: 'absolute', left: `${tti.percent}%` }}
          >
            not yet
          </div>
        )}
      </>
    )
  }
}

export default StandardTooltip

//              style={tooltipStyle(tti.percent, tti.hoveredHandleId, tti.grabbed)}
