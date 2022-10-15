// 処理の流れ
// 1. createElement により Fiber を作成する
// 2. render により レンダリング処理を開始する
// 3. workLoop 内でルートの Fiber を起点とする Fiber Tree を構築する
// 4. Fiber Tree の構築が終わったら DOM に反映する

type FiberType = {
  type?: string
  props: {
    [key: string]: unknown
    children: FiberType[]
  }
  dom?: HTMLElement | Text | null
  parent?: FiberType
  child?: FiberType
  sibling?: FiberType
}

/**
 * Fiber の作成
 */

// Fiber を作成する
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

// string から Fiber を作成する
function createTextElement(text: string): FiberType {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

/**
 * Fiber のレンダリング
 */

// Fiber から Fiber Tree のルートを構築し、レンダリング処理を開始する
export function render(
  element: FiberType,
  container: HTMLElement | Text,
): void {
  // Fiber Tree のルートを作成し、次の処理対象として設定する
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
  }
  nextUnitOfWork = wipRoot

  // レンダリング処理を開始する
  requestIdleCallback(workLoop)
}

let nextUnitOfWork: FiberType | null = null
let wipRoot: FiberType | null = null

// Fiber Tree を構築し、すべての処理が終わったら DOM に反映する
function workLoop(deadline: IdleDeadline): void {
  // 一定時間内に処理できる分の Fiber を処理する
  let shouldYield = false
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() < 1
  }

  // すべての Fiber の処理が終わったら DOM に反映する
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }

  // 自身を再帰的に呼び出し、次のアイドル時に処理を続行する
  requestIdleCallback(workLoop)
}

/**
 * Fiber Tree の構築
 */

// Fiber Tree を構築する
function performUnitOfWork(fiber: FiberType): FiberType | null {
  // Fiber 自身を DOM に反映する
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  // Fiber の子要素を構成する
  const elements = fiber.props.children
  let index = 0
  let prevSibling: FiberType | null = null
  while (index < elements.length) {
    const element = elements[index]
    const newFiber: FiberType = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    }

    if (index === 0) {
      fiber.child = newFiber
    } else if (prevSibling) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }

  // 次の処理対象となる Fiber を返す
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent!
  }

  return null
}

// 実際にレンダリング可能な Node へと Fiber を変換する
function createDom(filber: FiberType): HTMLElement | Text {
  // Node を作成する
  const dom =
    filber.type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(filber.type ?? '')

  // children 以外の Fiber の props を Node に反映する
  const isProperty = (key: string) => key !== 'children'
  Object.keys(filber.props)
    .filter(isProperty)
    .forEach((name: string) => {
      dom[name] = filber.props[name]
    })

  return dom
}

/**
 * Fiber Tree の DOM への反映
 */

// Fiber Tree を DOM に反映し、それが終わったら Fiber Tree を初期化する
function commitRoot(): void {
  commitWork(wipRoot?.child)
  wipRoot = null
}

// Fiber Tree を DOM に反映する
function commitWork(fiber?: FiberType | null): void {
  if (!fiber) {
    return
  }

  // 自身を DOM に反映する
  const domParent = fiber.parent?.dom
  if (domParent && fiber.dom) {
    domParent.appendChild(fiber.dom)
  }

  // 子要素を DOM に反映する
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}
