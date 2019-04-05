# chartogram

Charts in JS with no dependencies.

[DEMO](https://catamphetamine.github.io/chartogram)

Originally created as part of [Telegram Charts Contest](https://t.me/contest/6).

## Screenshots

### Day

[View in full resolution](https://raw.githubusercontent.com/catamphetamine/chartogram/master/docs/day.png)

<img src="https://raw.githubusercontent.com/catamphetamine/chartogram/master/docs/day@512x984.png" width="256" height="492"/>

### Night

[View in full resolution](https://raw.githubusercontent.com/catamphetamine/chartogram/master/docs/night.png)

<img src="https://raw.githubusercontent.com/catamphetamine/chartogram/master/docs/night@512x984.png" width="256" height="492"/>

## Use

The default exported function takes four arguments:

* The DOM element where the chart will be rendered.
* Chart data.
* Chart title.
* (optional) [`options`](#options).

Chart data must have shape:

```js
{
  x: {
    points: Number[]
  },
  y: {
    id: string,
    name: string,
    points: Number[]
  }[]
}
```

So there must be a single `x` and one or more `y`s.

Example:

```js
{
  x: {
    points: [
      1553769000,
      1553770000,
      1553771000
    ]
  },
  y: [
    {
      id: 'y1',
      name: 'Temperature',
      points: [
        60,
        69,
        65
      ]
    },
    {
      id: 'y2',
      name: 'CPU load',
      points: [
        95,
        98,
        90
      ]
    }
  ]
}
```

The default exported function returns another function which must be called in case of "destroying" the chart (it cleans up global event listeners and resets the DOM node).

### Browser

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://unpkg.com/chartogram@[version]/bundle/chartogram.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/chartogram@[version]/style.css"/>
  </head>

  <body>
    <section id="chart"></section>
    <script>
      chartogram(document.getElementById('chart'), data, 'Title')
    </script>
  </body>
</html>
```

where `[version]` is an npm package version range (for example, `0.1.x` or `^0.1.0`).

### React

```
npm install chartogram --save
```

```js
import React from 'react'
import PropTypes from 'prop-types'
import chartogram from 'chartogram'
import 'chartogram/style.css'

class Chartogram extends React.Component {
  static propTypes = {
    data: PropTypes.shape({
      x: PropTypes.shape({
        points: PropTypes.arrayOf(PropTypes.number).isRequired
      }).isRequired,
      y: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        points: PropTypes.arrayOf(PropTypes.number).isRequired
      })).isRequired
    }).isRequired,
    title: PropTypes.string.isRequired
  }

  node = React.createRef()

  componentDidMount() {
    const { data, title } = this.props
    this.cleanUp = chartogram(this.node.current, data, title)
  }

  componentWillUnmount() {
    this.cleanUp
  }

  render() {
    return <section ref={this.node}/>
  }
}
```

## Night mode

Add `chartogram--night-mode` CSS class to the chart `<section/>` to switch to Night Mode.

## Options

* `formatX(value: number, { long: boolean })` — Formats X axis labels. `long` option is for the tooltip. Uses `Intl.DateTimeFormat` by default.
* `formatY(value: number)` — Formats Y axis labels (including tooltip). Uses `Intl.NumberFormat` by default.
* `locale: string` — Is used to format dates (the default system locale is used if none supplied).
* `transitionDuration: number` — The maximum transition duration (in milliseconds).
* `transitionEasing: string` — Is `easeOutQuad` by default.
* `yAxisTickMarksCount: number` — Y axis tick marks count.
* `yAxisPrecision: number` — Y axis tick mark labels rounding precision: the number of fraction digits to use when formatting Y axis labels. Is `0` by default.
* `xAxisTickMarkWidth: number` — (in pixels) Is used to calculate the count of X axis tick marks based on canvas width (in pixels).
* `canvasWidth: number` — SVG `viewBox` width (not pixels).
* `precision: number` — SVG coordinates rounding precision.
* `timelineWindowSize: number` — The initial size of timeline window (in points).

## Custom colors

To customize colors override the CSS variables:

```css
body {
	--content-color: black;
	--background-color: white;
	--night-mode-transition-duration: 300ms;
}

.night-mode {
	--background-color: rgb(36,47,62);
	--content-color: white;
}

.chartogram {
	--chartogram-background-color: var(--background-color);
	--chartogram-content-color: var(--content-color);
	--chartogram-night-mode-transition-duration: var(--night-mode-transition-duration);
	/* See `style.css` for the list of all available CSS variables. */
	--chartogram-font-size: 16px;
	--chartogram-tooltip-background-color: white;
}

.chartogram--night-mode {
	/* See `style.css` for the list of all available CSS variables. */
	--chartogram-tooltip-background-color: #293544;
}
```

## Browser compatibility

Tested in Chrome, Firefox, Microsoft Edge and iOS Safari.

For some reason doesn't show the `.chartogram__canvas` SVG element when it's wrapped in `.chartogram__canvas-wrapper` in Internet Explorer.

The styles use [CSS variables](https://caniuse.com/#feat=css-variables) which work everywhere except Internet Explorer.