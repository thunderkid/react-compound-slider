import React, { PureComponent } from 'react'
import warning from 'warning'
import PropTypes from 'prop-types'
import Rail from '../Rail'
import Ticks from '../Ticks'
import Tracks from '../Tracks'
import Handles from '../Handles'
import { mode1, mode2, mode3 } from './modes'
import {
  isNotValidTouch,
  getTouchPosition,
  getUpdatedHandles,
  getSliderDomain,
  getStepRange,
  getHandles,
  prfx,
} from './utils'
import LinearScale from './LinearScale'
import DiscreteScale from './DiscreteScale'

const isBrowser =
  typeof window !== 'undefined' && typeof document !== 'undefined'

const noop = () => {}

const compare = b => (m, d, i) => m && b[i] === d

const equal = (a, b) => {
  return a === b || (a.length === b.length && a.reduce(compare(b), true))
}

const getNextValue = (curr, step, domain, reversed) => {
  let newVal = curr
  newVal = reversed ? curr - step : curr + step
  return reversed ? Math.max(domain[0], newVal) : Math.min(domain[1], newVal)
}

const getPrevValue = (curr, step, domain, reversed) => {
  let newVal = curr
  newVal = reversed ? curr + step : curr - step
  return reversed ? Math.min(domain[1], newVal) : Math.max(domain[0], newVal)
}

class Slider extends PureComponent {
  state = {
    step: null,
    values: null,
    domain: null,
    handles: null,
    reversed: null,
    valueToPerc: null,
    valueToStep: null,
    pixelToStep: null,
  }

  slider = React.createRef()

  static getDerivedStateFromProps(nextProps, prevState) {
    const {
      step,
      //      values0, // ie before autosnap applied
      domain,
      reversed,
      onUpdate,
      onChange,
      warnOnSnap,
      autoSnap,
    } = nextProps

    const values0 = nextProps.values

    let valueToPerc = prevState.valueToPerc
    let valueToStep = prevState.valueToStep
    let pixelToStep = prevState.pixelToStep

    const nextState = {}

    if (!valueToPerc || !valueToStep || !pixelToStep) {
      valueToPerc = new LinearScale()
      valueToStep = new DiscreteScale()
      pixelToStep = new DiscreteScale()

      nextState.valueToPerc = valueToPerc
      nextState.valueToStep = valueToStep
      nextState.pixelToStep = pixelToStep
    }

    //console.log(`values before autosnap, ${values0} and ${values}`)
    const values =
      autoSnap && values0 ? values0.map(x => valueToStep.getValue(x)) : values0
    //console.log(`values after autosnap, ${values0} and ${values}`)

    if (
      prevState.step === null ||
      prevState.domain === null ||
      prevState.reversed === null ||
      step !== prevState.step ||
      domain[0] !== prevState.domain[0] ||
      domain[1] !== prevState.domain[1] ||
      reversed !== prevState.reversed
    ) {
      const [min, max] = domain
      const range = getStepRange(min, max, step)

      valueToStep.setRange(range).setDomain([min - step / 2, max + step / 2])

      if (reversed === true) {
        valueToPerc.setDomain([min, max]).setRange([100, 0])
        range.reverse()
      } else {
        valueToPerc.setDomain([min, max]).setRange([0, 100])
      }

      pixelToStep.setRange(range)

      warning(
        max > min,
        `${prfx} Max must be greater than min (even if reversed). Max is ${max}. Min is ${min}.`,
      )

      const maxInRange = 100001

      warning(
        range.length <= maxInRange,
        `${prfx} Increase step value (set to ${step} currently). Found ${range.length.toLocaleString()} values in range. Max is ${maxInRange.toLocaleString()}.`,
      )

      const last = range.length - 1

      warning(
        range[reversed ? last : 0] === min &&
          range[reversed ? 0 : last] === max,
        `${prfx} The range is incorrectly calculated. Check domain (min, max) and step values.`,
      )

      const { handles, changes } = getHandles(
        values || prevState.values,
        reversed,
        valueToStep,
        warnOnSnap,
      )

      if (changes || values === undefined || values === prevState.values) {
        onUpdate(handles.map(d => d.val))
        onChange(handles.map(d => d.val))
      }

      nextState.step = step
      nextState.values = values
      nextState.domain = domain
      nextState.handles = handles
      nextState.reversed = reversed
    } else if (!equal(values, prevState.values)) {
      const { handles, changes } = getHandles(
        values,
        reversed,
        valueToStep,
        warnOnSnap,
      )

      if (changes) {
        onUpdate(handles.map(d => d.val))
        onChange(handles.map(d => d.val))
      }

      nextState.values = values
      nextState.handles = handles
    }

    if (Object.keys(nextState).length) {
      return nextState
    }

    return null
  }

  componentWillUnmount() {
    this.removeListeners()
  }

  removeListeners() {
    if (isBrowser) {
      document.removeEventListener('mousemove', this.onMouseMove)
      document.removeEventListener('mouseup', this.onMouseUp)
      document.removeEventListener('touchmove', this.onTouchMove)
      document.removeEventListener('touchend', this.onTouchEnd)
    }
  }

  onKeyDown = (e, handleID) => {
    let validUpKeys = ['ArrowRight', 'ArrowUp']
    let validDownKeys = ['ArrowDown', 'ArrowLeft']
    const {
      state: { handles },
      props: { step, reversed, vertical, domain },
    } = this
    const key = e.key || e.keyCode

    if (!validUpKeys.concat(validDownKeys).includes(key)) {
      return
    }

    if (vertical) {
      [validUpKeys, validDownKeys] = [validDownKeys, validUpKeys]
    }

    e.stopPropagation && e.stopPropagation()
    e.preventDefault && e.preventDefault()

    const found = handles.find(value => {
      return value.key === handleID
    })
    if (!found) {
      return
    }

    const currVal = found.val
    let newVal = currVal

    if (validUpKeys.includes(key)) {
      newVal = getNextValue(currVal, step, domain, reversed)
    } else if (validDownKeys.includes(key)) {
      newVal = getPrevValue(currVal, step, domain, reversed)
    }
    const nextHandles = handles.map(v =>
      v.key === handleID ? { key: v.key, val: newVal } : v,
    )

    this.submitUpdate(nextHandles, true)
  }

  onMouseDown = (e, handleID) => {
    this.mouseIsDown = true
    this.onStart(e, handleID, false)
  }

  onTouchStart = (e, handleID) => {
    if (isNotValidTouch(e)) {
      return
    }

    this.onStart(e, handleID, true)
  }

  onStart(e, handleID, isTouch) {
    const {
      state: { handles },
      props: { onSlideStart },
    } = this

    e.stopPropagation && e.stopPropagation()
    e.preventDefault && e.preventDefault()

    const found = handles.find(value => {
      return value.key === handleID
    })

    if (found) {
      this.active = handleID
      onSlideStart(handles.map(d => d.val), { activeHandleID: handleID })
      isTouch ? this.addTouchEvents() : this.addMouseEvents()
    } else {
      this.active = null
      this.handleRailAndTrackClicks(e, isTouch)
    }
  }

  handleRailAndTrackClicks(e, isTouch) {
    const {
      state: { handles: curr, pixelToStep },
      props: { vertical, reversed },
    } = this
    const { slider } = this

    // double check the dimensions of the slider
    pixelToStep.setDomain(
      getSliderDomain(slider.current, vertical, pixelToStep),
    )

    // find the closest value (aka step) to the event location
    let updateValue

    if (isTouch) {
      updateValue = pixelToStep.getValue(getTouchPosition(vertical, e))
    } else {
      updateValue = pixelToStep.getValue(vertical ? e.clientY : e.pageX)
    }

    // find the closest handle key
    let updateKey = null
    let minDiff = Infinity

    for (let i = 0; i < curr.length; i++) {
      const { key, val } = curr[i]
      const diff = Math.abs(val - updateValue)

      if (diff < minDiff) {
        updateKey = key
        minDiff = diff
      }
    }

    // generate a "candidate" set of values - a suggestion of what to do
    const nextHandles = getUpdatedHandles(
      curr,
      updateKey,
      updateValue,
      reversed,
    )

    // submit the candidate values
    this.submitUpdate(nextHandles, true)
  }

  addMouseEvents() {
    if (isBrowser) {
      document.addEventListener('mousemove', this.onMouseMove)
      document.addEventListener('mouseup', this.onMouseUp)
    }
  }

  addTouchEvents() {
    if (isBrowser) {
      document.addEventListener('touchmove', this.onTouchMove)
      document.addEventListener('touchend', this.onTouchEnd)
    }
  }

  onMouseMove = e => {
    //if (!this.mouseIsDown)
    console.log(
      `mouse move with over ${this.mouseIsOver} down ${this.mouseIsDown}`,
    )
    if (this.mouseIsOver) this.setHoverState(e)
    if (this.mouseIsDown) {
      const {
        state: { handles: curr, pixelToStep },
        props: { vertical, reversed },
      } = this
      const { active: updateKey, slider } = this

      // double check the dimensions of the slider
      pixelToStep.setDomain(
        getSliderDomain(slider.current, vertical, pixelToStep),
      )

      // find the closest value (aka step) to the event location
      const updateValue = pixelToStep.getValue(vertical ? e.clientY : e.pageX)

      // generate a "candidate" set of values - a suggestion of what to do
      const nextHandles = getUpdatedHandles(
        curr,
        updateKey,
        updateValue,
        reversed,
      )

      // submit the candidate values
      this.submitUpdate(nextHandles)
    }
  }

  setHoverState = e => {
    console.log(`setting hover state with ${e}`)
    if (e) {
      // find the closest value (aka step) to the event location
      const {
        state: { handles: curr, pixelToStep },
        props: { vertical, reversed },
      } = this
      const { slider } = this

      // double check the dimensions of the slider
      pixelToStep.setDomain(
        getSliderDomain(slider.current, vertical, pixelToStep),
      )

      const updateValue = pixelToStep.getValue(vertical ? e.clientY : e.pageX)
      console.log('got updated value {updatedValue}')

      this.setState({ hoverPos: updateValue })
    } else {
      this.setState({ hoverPos: null })
    }
  }

  onMouseEnter = e => {
    this.mouseIsOver = true
    this.setHoverState(e)
  }

  onMouseLeave = e => {
    this.mouseIsOver = false
    this.setHoverState(null)
  }

  onTouchMove = e => {
    const {
      state: { handles: curr, pixelToStep },
      props: { vertical, reversed },
    } = this
    const { active: updateKey, slider } = this

    if (isNotValidTouch(e)) {
      return
    }

    // double check the dimensions of the slider
    pixelToStep.setDomain(
      getSliderDomain(slider.current, vertical, pixelToStep),
    )

    // find the closest value (aka step) to the event location
    const updateValue = pixelToStep.getValue(getTouchPosition(vertical, e))

    // generate a "candidate" set of values - a suggestion of what to do
    const nextHandles = getUpdatedHandles(
      curr,
      updateKey,
      updateValue,
      reversed,
    )

    // submit the candidate values
    this.submitUpdate(nextHandles)
  }

  submitUpdate(next, callOnChange) {
    const { mode, step, onUpdate, onChange, reversed } = this.props
    const { getValue } = this.state.valueToStep

    this.setState(({ handles: curr }) => {
      let handles

      // given the current handles and a candidate set, decide what to do
      if (typeof mode === 'function') {
        handles = mode(curr, next, step, reversed, getValue)
        warning(
          Array.isArray(handles),
          'Custom mode function did not return an array.',
        )
      } else {
        switch (mode) {
          case 1:
            handles = mode1(curr, next)
            break
          case 2:
            handles = mode2(curr, next)
            break
          case 3:
            handles = mode3(curr, next, step, reversed, getValue)
            break
          default:
            handles = next
            warning(false, `${prfx} Invalid mode value.`)
        }
      }

      onUpdate(handles.map(d => d.val))

      if (callOnChange) {
        onChange(handles.map(d => d.val))
      }

      return { handles }
    })
  }

  onMouseUp = () => {
    // todo: any point in testing this for this.mouseIsDown?
    this.mouseIsDown = false
    const {
      state: { handles },
      props: { onChange, onSlideEnd },
    } = this
    const activeHandleID = this.active
    this.active = null

    onChange(handles.map(d => d.val))
    onSlideEnd(handles.map(d => d.val), { activeHandleID })

    // these get removed by unmount.
    // if (isBrowser) {
    //   document.removeEventListener('mousemove', this.onMouseMove)
    //   document.removeEventListener('mouseup', this.onMouseUp)
    // }
  }

  onTouchEnd = () => {
    const {
      state: { handles },
      props: { onChange, onSlideEnd },
    } = this
    this.active = null

    onChange(handles.map(d => d.val))
    onSlideEnd(handles.map(d => d.val))

    if (isBrowser) {
      document.removeEventListener('touchmove', this.onTouchMove)
      document.removeEventListener('touchend', this.onTouchEnd)
    }
  }

  render() {
    const {
      state: { handles, valueToPerc, hoverPos },
      props: { className, rootStyle, disabled },
    } = this

    const mappedHandles = handles.map(({ key, val }) => {
      return { id: key, value: val, percent: valueToPerc.getValue(val) }
    })

    const children = React.Children.map(this.props.children, child => {
      if (
        child.type.name === Rail.name ||
        child.type.name === Ticks.name ||
        child.type.name === Tracks.name ||
        child.type.name === Handles.name
      ) {
        return React.cloneElement(child, {
          scale: valueToPerc,
          handles: mappedHandles, // isn't it superfluous to send eg this to eg Tracks?
          emitKeyboard: disabled ? noop : this.onKeyDown,
          emitMouse: disabled ? noop : this.onMouseDown,
          emitTouch: disabled ? noop : this.onTouchStart,
        })
      }

      return child
    })

    const posStr = `${valueToPerc.getValue(hoverPos)}%`

    return (
      <div
        style={rootStyle || {}}
        className={className}
        ref={this.slider}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        {children}
        {hoverPos && (
          <div
            style={{
              position: 'absolute',
              left: posStr,
              'margin-top': '-20px',
            }}
          >
            FakeHoverPos{hoverPos}
          </div>
        )}
      </div>
    )
  }
}

Slider.propTypes = {
  /**
   * CSS class name applied to the root div of the slider.
   */
  className: PropTypes.string,
  /**
   * An object with any inline styles you want applied to the root div.
   */
  rootStyle: PropTypes.object,
  /**
   * Two element array of numbers providing the min and max values for the slider [min, max] e.g. [0, 100].
   * It does not matter if the slider is reversed on the screen, domain is always [min, max] with min < max.
   */
  domain: PropTypes.array,
  /**
   * An array of numbers. You can supply one for a value slider, two for a range slider or more to create n-handled sliders.
   * The values should correspond to valid step values in the domain.
   * The numbers will be forced into the domain if they are two small or large.
   */
  values: PropTypes.array,
  /**
   * The step value for the slider.
   */
  step: PropTypes.number,
  /**
   * The interaction mode. Value of 1 will allow handles to cross each other.
   * Value of 2 will keep the sliders from crossing and separated by a step.
   * Value of 3 will make the handles pushable and keep them a step apart.
   * ADVANCED: You can also supply a function that will be passed the current values and the incoming update.
   * Your function should return what the state should be set as.
   */
  mode: PropTypes.oneOfType([PropTypes.number, PropTypes.func]),
  /**
   * Set to true if the slider is displayed vertically to tell the slider to use the height to calculate positions.
   */
  vertical: PropTypes.bool,
  /**
   * Reverse the display of slider values.
   */
  reversed: PropTypes.bool,
  /**
   * Function triggered when the value of the slider has changed. This will recieve changes at the end of a slide as well as changes from clicks on rails and tracks. Receives values.
   */
  onChange: PropTypes.func,
  /**
   * Function called with the values at each update (caution: high-volume updates when dragging). Receives values.
   */
  onUpdate: PropTypes.func,
  /**
   * Function triggered with ontouchstart or onmousedown on a handle. Receives values.
   */
  onSlideStart: PropTypes.func,
  /**
   * Function triggered on ontouchend or onmouseup on a handle. Receives values.
   */
  onSlideEnd: PropTypes.func,
  /**
   * Ignore all mouse, touch and keyboard events
   */
  disabled: PropTypes.bool,
  /**
   * Component children to render
   */
  children: PropTypes.any,
}

Slider.defaultProps = {
  mode: 1,
  step: 0.1,
  domain: [0, 100],
  vertical: false,
  reversed: false,
  onChange: noop,
  onUpdate: noop,
  onSlideStart: noop,
  onSlideEnd: noop,
  disabled: false,
}

export default Slider
