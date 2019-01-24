import React, { Component } from 'react'
import warning from 'warning'

class StandardTooltip extends Component {
  render() {
    const { tti, render } = this.props
    console.log(`tti got ${JSON.stringify(tti)}`)
    return (
      <>
        {tti && (
          <div
            className="tooltip2"
            style={{ position: 'absolute', left: `${tti.percent}%` }}
          >
            {render(tti.val)}
          </div>
        )}
      </>
    )
  }
}

function tooltipForHandle(handles, valueToPerc, id, grabbed) {
  const handle = handles.find(h => h.key == id)
  console.log(`tooltip for handle ${JSON.stringify(handle)}`)
  warning(
    handle,
    `matching handle not found for id ${id} in ${JSON.stringify(handles)}`,
  )

  return {
    val: handle.val,
    percent: valueToPerc.getValue(handle.val),
    handleId: id,
    grabbed: grabbed,
  }
}

// choose tooltip to display based on hover location, active handle, hovered handle.
export function getTooltipInfo(
  hoverVal,
  handles,
  activeHandleID,
  hoveredHandleID,
  valueToPerc,
) {
  if (activeHandleID)
    return tooltipForHandle(handles, valueToPerc, activeHandleID, true)
  else if (hoveredHandleID)
    return tooltipForHandle(handles, valueToPerc, hoveredHandleID, false)
  else if (hoverVal != null)
    // hovering over rail or track
    return {
      val: hoverVal,
      percent: valueToPerc.getValue(hoverVal),
    }
  else return null
}

export default StandardTooltip

//              style={tooltipStyle(tti.percent, tti.hoveredHandleId, tti.grabbed)}
