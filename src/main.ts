import { createElement, render } from './react'

const element = createElement(
  'div',
  { id: 'foo' },
  createElement('h1', null, 'Annotated React Fiber'),
  createElement(
    'a',
    { href: 'https://github.com/morinokami/annotated-react-fiber' },
    'Repository',
  ),
)
const container = document.getElementById('app')
render(element, container!)
