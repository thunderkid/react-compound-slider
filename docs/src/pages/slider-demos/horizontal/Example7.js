// @flow weak

import React, { Component } from 'react'
import { Slider, Rail, Handles, Tracks, Tooltip } from 'react-compound-slider'
import ValueViewer from 'docs/src/pages/ValueViewer' // for examples only - displays the table above slider
import { Handle, Track } from './components' // example render components - source below

const sliderStyle = {
  position: 'relative',
  width: '100%',
}

const railStyle = {
  position: 'absolute',
  width: '100%',
  height: 14,
  borderRadius: 7,
  cursor: 'pointer',
  backgroundColor: 'rgb(155,155,155)',
}

const tooltipStyle = (percent, handleId, grabbed) => {
  return {
    left: `${percent}%`,
    position: 'absolute',
    zIndex: 3,
    width: 'auto',
    transform: 'translateX(-50%)',
    marginTop: '-45px',
    padding: '5px',
    height: 'auto',
    backgroundColor: 'rgb(10, 10, 10)',
    border: grabbed
      ? '1px solid white'
      : handleId
        ? '1px solid lightgrey'
        : '1px solid grey',
    userSelect: 'none',
  }
}

const domain = [50, 300]
const defaultValues = [280]

// function tooltipCallback(ti) {
//   console.log(`tooltip ${JSON.stringify(ti)}`)
// }

class TT2 extends Component {
  render() {
    const {
      props: { percent },
    } = this

    return <div>sez {percent}</div>
  }
}

class Example extends Component {
  state = {
    values: defaultValues.slice(),
    update: defaultValues.slice(),
    disabled: false,
  }

  onUpdate = update => {
    this.setState({ update })
  }

  onChange = values => {
    this.setState({ values })
  }

  toggleDisabled = () => {
    this.setState({ disabled: !this.state.disabled })
  }

  tooltipCallback = tti => {
    console.log(`tooltip ${JSON.stringify(tti)}`)
    this.setState({ tt2pct: tti ? tti.percent : null })
  }

  render() {
    const {
      state,
      state: { tt2pct, values, update, disabled },
    } = this

    console.log(`state ${JSON.stringify(state)}`)

    return (
      <div style={{ height: 120, width: '100%' }}>
        <button onClick={() => this.toggleDisabled()}>
          {disabled ? 'ENABLE' : 'DISABLE'}
        </button>

        <ValueViewer values={values} update={update} />
        <Slider
          disabled={disabled}
          step={1}
          domain={domain}
          rootStyle={sliderStyle}
          onUpdate={this.onUpdate}
          onChange={this.onChange}
          values={values}
          tooltipCallback={this.tooltipCallback}
        >
          <TT2 percent={tt2pct} />
          <Rail>
            {({ getRailProps }) => (
              <div style={railStyle} {...getRailProps()} />
            )}
          </Rail>
          <Tooltip>
            {({ tooltipInfo, getTooltipProps }) => (
              <div
                style={tooltipStyle(
                  tooltipInfo.percent,
                  tooltipInfo.handleId,
                  tooltipInfo.grabbed,
                )}
                {...getTooltipProps()}
              >
                {tooltipInfo.val}
              </div>
            )}
          </Tooltip>
          <Handles>
            {({ handles, getHandleProps }) => (
              <div className="slider-handles">
                {handles.map(handle => (
                  <Handle
                    key={handle.id}
                    handle={handle}
                    domain={domain}
                    getHandleProps={getHandleProps}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </Handles>
          <Tracks right={false}>
            {({ tracks, getTrackProps }) => (
              <div className="slider-tracks">
                {tracks.map(({ id, source, target }) => (
                  <Track
                    key={id}
                    source={source}
                    target={target}
                    getTrackProps={getTrackProps}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </Tracks>
        </Slider>
      </div>
    )
  }
}

export default Example
