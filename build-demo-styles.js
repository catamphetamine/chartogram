// Internet Explorer 11 doesn't support CSS variables.
// This script injects CSS variables as constants in `style.css` for demo page.

const fs = require('fs')
const path = require('path')

const autoprefixer = require('autoprefixer')
// `postcss-css-variables` had a bug: tooltip background was black.
// const cssVariables = require('postcss-css-variables')
const cssVariables = require('postcss-custom-properties')
const postcss = require('postcss')

function transformStyle(filePath) {
  let text = fs.readFileSync(path.join(__dirname, filePath), 'utf8')

  // Remove nested `calc()`s.
  text = text.split('\n').map((line) => {
    while (/calc(.+)calc/.test(line)) {
      line = line.replace(/calc(.+)calc\(([^)]*)\)(.*);/, 'calc$1$2$3;')
    }
    return line
  }).join('\n')

  text.split('\n').forEach((line) => {
    if (/calc(.+)calc/.test(line)) {
      throw new Error('Nested calcs left')
    }
  })

  // Move CSS variable declarations to `:root` from `.chartogram`.

  const rootStyleFromIndex = text.indexOf('.chartogram {') + '.chartogram {'.length
  const rootStyleToIndex = text.indexOf('}', text.indexOf('.chartogram {'))
  const rootStyle = text.slice(
    rootStyleFromIndex,
    rootStyleToIndex
  ).split('\n').map(line => line.trim())

  const rootVars = rootStyle.filter(line => line.indexOf('--') === 0)
  const rootStyles = rootStyle.filter(line => line.indexOf('--') !== 0)

  // CSS variable declarations are placed in `:root`
  // and rest styles will be in `.chartogram`.
  text = text.slice(0, rootStyleFromIndex) +
    rootStyles.join('\n') +
    '}\n\n:root {\n' +
    rootVars.join('\n') +
    '\n' +
    text.slice(rootStyleToIndex)

  return postcss([
    cssVariables({
      preserve: true
    }),
    autoprefixer()
  ]).process(text, { from: undefined }).then((result) => {
    result.warnings().forEach((warn) => console.warn(warn.toString()))
    fs.writeFileSync(path.join(__dirname, 'bundle', filePath), result.css)
  })
}

transformStyle('style.css')