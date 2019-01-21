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
  getPosition,
  getUpdatedHandles,
  getSliderDomain,
  getStepRange,
  getHandles,
  prfx,
} from './utils'
import LinearScale from './LinearScale'
import DiscreteScale from './DiscreteScale'
import Tooltip from '../Tooltip'

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

  static snapValues(values0, valueToStep, doSnap) {
    return doSnap && values0
      ? values0.map(x => valueToStep.getValue(x))
      : values0
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const {
      step,
      values: values0, // ie before applying autosnap
      domain,
      reversed,
      onUpdate,
      onChange,
      noWarnOnSnap,
      noAutoSnap,
    } = nextProps

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

      const values = Slider.snapValues(values0, valueToStep, !noAutoSnap) // nb: keep this after valueToStep.setRange ...

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
        !noWarnOnSnap,
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
    } else {
      const values = Slider.snapValues(values0, valueToStep, !noAutoSnap)

      if (!equal(values, prevState.values)) {
        const { handles, changes } = getHandles(
          values,
          reversed,
          valueToStep,
          !noWarnOnSnap,
        )

        if (changes) {
          onUpdate(handles.map(d => d.val))
          onChange(handles.map(d => d.val))
        }

        nextState.values = values
        nextState.handles = handles
      }
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
    this.removeMouseEvents()
    this.removeTouchEvents()
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

  removeMouseEvents() {
    if (isBrowser) {
      document.removeEventListener('mousemove', this.onMouseMove)
      document.removeEventListener('mouseup', this.onMouseUp)
    }
  }

  removeTouchEvents() {
    if (isBrowser) {
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
      // todo: tidy these
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

    this.submitUpdate(this.actualNextHandles(nextHandles), true)
  }

  onMouseDown = (e, handleID) => {
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
    } = this

    e.stopPropagation && e.stopPropagation()
    e.preventDefault && e.preventDefault()

    const found = handles.find(value => {
      return value.key === handleID
    })

    if (found) {
      this.startSlide(found, isTouch)
      this.sendTooltip()
    } else {
      this.handleRailAndTrackClicks(e, isTouch)
    }
    //this.sendTooltip()
  }

  startSlide(handle, isTouch) {
    const {
      state: { handles },
      props: { onSlideStart },
    } = this

    onSlideStart(handles.map(d => d.val), { activeHandleID: handle.key })
    isTouch ? this.addTouchEvents() : this.addMouseEvents()
    this.activeHandleID = handle.key
    //this.sendTooltip()
    //this.setState({ activeHandleID: handle.key })
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
    const updateValue = pixelToStep.getValue(getPosition(vertical, e, isTouch))

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

    const actualHandles = this.actualNextHandles(nextHandles)
    this.grabHandleIfReaches(actualHandles, updateKey, updateValue, isTouch) // ie can handle reach this position given the mode
    this.submitUpdate(actualHandles, true)
  }

  grabHandleIfReaches(handles, id, value, isTouch) {
    // ie can handle reach this position given the mode
    const found = handles.find(h => {
      return h.key === id
    })

    warning(
      found,
      `Couldn't find grab handle ${id} in ${JSON.stringify(handles)}`,
    )

    if (found.val == value) {
      this.startSlide(found, isTouch)
      this.sendTooltip(handles)
      // todo: do we need stop propagation?
    }
  }

  onMouseMove = e => this.onMove(e, false)

  onTouchMove = e => {
    if (isNotValidTouch(e)) {
      return
    }

    this.onMove(e, true)
  }

  // mouse or touch being moved
  onMove(e, isTouch) {
    const {
      state: { handles: curr, pixelToStep, valueToPerc },
      props: { vertical, reversed, tooltipCallback },
    } = this
    const { slider } = this

    // double check the dimensions of the slider
    pixelToStep.setDomain(
      getSliderDomain(slider.current, vertical, pixelToStep),
    )

    // find the closest value (aka step) to the event location
    const updateValue = pixelToStep.getValue(getPosition(vertical, e, isTouch))

    // generate a "candidate" set of values - a suggestion of what to do
    const nextHandles = getUpdatedHandles(
      curr,
      this.activeHandleID,
      updateValue,
      reversed,
    )
    const nextActualHandles = this.actualNextHandles(nextHandles)

    //this.tooltipState.hoveredHandleID = this.activeHandleID
    this.sendTooltip(nextActualHandles) //todo: should pass nextActualHandles?

    // todo: probably check this against nextActualValues?
    // this.props.tooltipCallback({
    //   hoveredHandleID: this.activeHandleID,
    //   val: updateValue,
    //   percent: valueToPerc.getValue(updateValue),
    //   grabbed: true,
    // })

    // submit the candidate values
    this.submitUpdate(nextActualHandles)
  }

  getHoverVal(e) {
    // todo: rename
    // find the closest value (aka step) to the event location
    const {
      state: { handles: curr, pixelToStep },
      props: { vertical, reversed },
    } = this
    const { slider } = this

    // double check the dimensions of the slider
    // todo: really necessary or needless expense here?
    pixelToStep.setDomain(
      getSliderDomain(slider.current, vertical, pixelToStep),
    )

    return pixelToStep.getValue(getPosition(vertical, e, false)) // mouse only
  }

  // setHoverState(e) {
  //   if (e) {
  //     // find the closest value (aka step) to the event location
  //     const {
  //       state: { handles: curr, pixelToStep },
  //       props: { vertical, reversed },
  //     } = this
  //     const { slider } = this

  //     // double check the dimensions of the slider
  //     // todo: necessary?
  //     pixelToStep.setDomain(
  //       getSliderDomain(slider.current, vertical, pixelToStep),
  //     )

  //     const updateValue = pixelToStep.getValue(getPosition(vertical, e, false)) // mouse only

  //     this.setState({
  //       hoverState: { val: updateValue },
  //     })
  //   } else {
  //     this.setState({ hoverState: null })
  //   }
  // }

  // given candidate next values, computes the actual ones that will be allowed
  // based on the mode.
  actualNextHandles(next) {
    const { mode, step, reversed } = this.props
    const {
      handles: curr,
      valueToStep: { getValue },
    } = this.state

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

    return handles
  }

  submitUpdate(handles, callOnChange) {
    const { onUpdate, onChange } = this.props

    onUpdate(handles.map(d => d.val))

    if (callOnChange) {
      onChange(handles.map(d => d.val))
    }

    this.setState(() => {
      return { handles }
    })
  }

  tooltipState = {}

  // maybe not even bother - there's no rerendering issue now
  usingTooltip() {
    return this.props.tooltipCallback != null
  }

  // Corresponds to mouse entering a part of the Rail/Track/Handle "Gadget". Id corresponds to the handla handle.
  onMouseEnterGadget = (e, id) => {
    if (this.usingTooltip()) {
      this.tooltipState.hoveredHandleID = id
      this.sendTooltip()
      // const valueToPerc = this.state.valueToPerc
      // const val = this.getHoverVal(e)
      // this.props.tooltipCallback({
      //   hoveredHandleID: id,
      //   val: val,
      //   percent: valueToPerc.getValue(val),
      // })
      //this.setState({ hoveredHandleID: id })
      //this.setHoverState(e)
    }
  }

  onMouseMoveGadget = (e, id) => {
    if (this.usingTooltip()) {
      this.tooltipState.hoveredHandleID = id
      this.tooltipState.hoverVal = this.getHoverVal(e)
      this.sendTooltip()
      // const { valueToPerc, handles } = this.state
      // console.log(`id, handles ${id}    ${JSON.stringify(handles)}`)

      // const val = id ? handles.find(h => h.key == id).val : this.getHoverVal(e)  // todo: what if not found?

      // this.props.tooltipCallback({
      //   hoveredHandleID: id,
      //   val: val,
      //   percent: valueToPerc.getValue(val),
      // })
    }
  }

  onMouseLeaveGadget = () => {
    this.tooltipState.hoveredHandleID = null
    this.tooltipState.hoverVal = null
    this.sendTooltip()
  }

  onMouseUp = () => {
    this.endSlide(false)
  }

  onTouchEnd = () => {
    this.endSlide(true)
  }

  endSlide(isTouch) {
    const {
      state: { handles, activeHandleID },
      props: { onChange, onSlideEnd },
    } = this

    onChange(handles.map(d => d.val))
    onSlideEnd(handles.map(d => d.val), { activeHandleID })

    this.activeHandleID = null
    this.sendTooltip()
    //this.setState({ activeHandleID: null })

    //this.props.tooltipCallback(null) // but what if it's still over stuff? should have recorded that in onmouseentergadget etc.
    isTouch ? this.removeTouchEvents() : this.removeMouseEvents()
  }

  sendTooltip(freshHandles) {
    const { tooltipCallback } = this.props
    const { handles: currHandles, valueToPerc } = this.state
    const { hoverVal, hoveredHandleID } = this.tooltipState
    const { activeHandleID } = this

    const handles = freshHandles ? freshHandles : currHandles

    const tti = Slider.getTooltipInfo(
      hoverVal,
      handles,
      activeHandleID,
      hoveredHandleID,
      valueToPerc,
    )
    console.log(`tooltip info ${JSON.stringify(tti)}`)

    if (tooltipCallback) {
      tooltipCallback(
        Slider.getTooltipInfo(
          hoverVal,
          handles,
          activeHandleID,
          hoveredHandleID,
          valueToPerc,
        ),
      )
    }
  }

  static tooltipForHandle(handles, valueToPerc, id, grabbed) {
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
  static getTooltipInfo(
    hoverVal,
    handles,
    activeHandleID,
    hoveredHandleID,
    valueToPerc,
  ) {
    if (activeHandleID)
      return Slider.tooltipForHandle(handles, valueToPerc, activeHandleID, true)
    else if (hoveredHandleID)
      return Slider.tooltipForHandle(
        handles,
        valueToPerc,
        hoveredHandleID,
        false,
      )
    else if (hoverVal != null)
      // hovering over rail or track
      return {
        val: hoverVal,
        percent: valueToPerc.getValue(hoverVal),
      }
    else return null
  }

  render() {
    const {
      state: {
        handles,
        valueToPerc,
        hoverState,
        activeHandleID,
        hoveredHandleID,
      },
      props: { className, rootStyle, disabled },
    } = this

    const mappedHandles = handles.map(({ key, val }) => {
      return { id: key, value: val, percent: valueToPerc.getValue(val) }
    })

    // const tooltipInfo = Slider.getTooltipInfo(
    //   hoverState,
    //   mappedHandles,
    //   activeHandleID,
    //   hoveredHandleID,
    //   valueToPerc,
    // )

    const children = React.Children.map(this.props.children, child => {
      if (
        child.type.name === Rail.name ||
        child.type.name === Ticks.name ||
        child.type.name === Tracks.name ||
        child.type.name === Handles.name
      )
        return React.cloneElement(child, {
          scale: valueToPerc,
          handles: mappedHandles, // isn't it superfluous to send eg this to eg Rail or Ticks?
          emitKeyboard: disabled ? noop : this.onKeyDown,
          emitMouse: disabled ? noop : this.onMouseDown,
          emitTouch: disabled ? noop : this.onTouchStart,
          emitMouseEnter: disabled ? noop : this.onMouseEnterGadget,
          emitMouseMove: disabled ? noop : this.onMouseMoveGadget,
          emitMouseLeave: disabled ? noop : this.onMouseLeaveGadget,
        })
      else return child // eg tooltip
    })
    //   else if (child.type.name === Tooltip.name)
    //     return React.cloneElement(child, {
    //       tooltipInfo: tooltipInfo,
    //     })
    //   else return child
    // })

    return (
      <div style={rootStyle || {}} className={className} ref={this.slider}>
        {children}
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

  tooltipCallback: PropTypes.func,

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
  tooltipCallback: noop,
  onChange: noop,
  onUpdate: noop,
  onSlideStart: noop,
  onSlideEnd: noop,
  disabled: false,
}

export default Slider
