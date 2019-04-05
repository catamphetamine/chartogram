// import commonjs from 'rollup-plugin-commonjs'
// import json from 'rollup-plugin-json'
// import resolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'

export default [
  {
    input: 'index.js',
    plugins: [
      // resolve(),
      // commonjs(),
      // json(),
      terser()
    ],
    output: {
      format: 'umd',
      name: 'chartogram',
      file: 'bundle/chartogram.js',
      sourcemap: true
    }
  },
  {
    input: 'react/index.js',
    plugins: [
      // resolve(),
      // commonjs(),
      // json(),
      terser()
    ],
    external: [
      'react',
      'prop-types'
    ],
    output: {
      format: 'umd',
      name: 'Chartogram',
      file: 'bundle/chartogram-react.js',
      sourcemap: true,
      globals: {
        'react': 'React',
        'prop-types': 'PropTypes'
      }
    }
  }
]
