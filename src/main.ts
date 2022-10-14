import { createElement, render } from './react'

const element = createElement(
  'div',
  { id: 'foo' },
  createElement('a', null, 'bar'),
  createElement('b'),
)
const container = document.getElementById('app')
render(element, container!)
