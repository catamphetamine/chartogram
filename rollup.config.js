// import commonjs from 'rollup-plugin-commonjs'
// import json from 'rollup-plugin-json'
// import node from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'

export default {
  input: 'index.js',
  plugins: [
    // node(),
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
}