import { createElement, render } from './react'

const container = document.getElementById('app')
const rerender = (value: string) => {
  const element = createElement(
    'div',
    { id: 'foo' },
    createElement('h1', null, 'Annotated React Fiber'),
    createElement(
      'div',
      null,
      createElement('input', {
        type: 'text',
        oninput: (e) => rerender(e.target.value),
        value,
      }),
      createElement('span', null, value),
    ),
    createElement(
      'p',
      null,
      createElement(
        'a',
        { href: 'https://github.com/morinokami/annotated-react-fiber' },
        'Repository',
      ),
    ),
  )
  render(element, container!)
}
rerender('Hello World')
