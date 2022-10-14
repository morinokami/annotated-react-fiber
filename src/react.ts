type FiberType = {
  type: string
  props: {
    [key: string]: unknown
    children: FiberType[]
  }
}

export function createElement(
  type: string,
  props?: Record<string, unknown> | null,
  ...children: (string | FiberType)[]
): FiberType {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === 'object' ? child : createTextElement(child),
      ),
    },
  }
}

function createTextElement(text: string): FiberType {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

export function render(
  element: FiberType,
  container: Text | HTMLElement,
): void {
  const dom =
    element.type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(element.type)

  const isProperty = (key: string) => key !== 'children'
  Object.keys(element.props)
    .filter(isProperty)
    .forEach((name: string) => {
      dom[name] = element.props[name]
    })

  element.props.children?.forEach((child) => {
    render(child, dom)
  })

  container.appendChild(dom)
}
