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

### Browser

```html
<html>
  <head>
    <script src="https://unpkg.com/chartogram@[version]/bundle/chartogram.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/chartogram@[version]/style.css"/>
  </head>

  <body>
    <section id="chart"></section>
    <script>
      chartogram(document.getElementById('chart'))
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
import chartogram from 'chartogram'
import 'chartogram/style.css'

class Chartogram extends React.Component {
  node = React.createRef()

  componentDidMount() {
    chartogram(this.node.current)
  }

  componentWillUnmount() {
    // Can remove any global event listeners here.
  }

  render() {
    return <section ref={this.node}/>
  }
}
```

## Night mode

Add `chartogram--night-mode` CSS class to the chart `<section/>` to switch to Night Mode.

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

Tested in Chrome and iOS Safari.

Mostly works in Firefox but SVG canvas drawing is buggy for some reason.

Throws some syntax error in Edge.

Won't support Internet Explorer.

The styles use [CSS variables](https://caniuse.com/#feat=css-variables) which work everywhere except Internet Explorer.