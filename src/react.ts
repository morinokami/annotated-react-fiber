// 処理の流れ
// 1. createElement により Fiber を作成する
// 2. render により レンダリング処理を開始する
// 3. workLoop 内でルートの Fiber を起点とする Fiber Tree を構築する
// 4. Fiber Tree の構築が終わったら DOM に反映する

type Fiber = {
  type?: string
  props: {
    [key: string]: unknown
    children: Fiber[]
  }
  dom?: HTMLElement | Text | null
  parent?: Fiber
  child?: Fiber
  sibling?: Fiber
  alternate?: Fiber | null // the fiber that we committed to the DOM in the previous commit phase
  effectTag?: 'PLACEMENT' | 'DELETION' | 'UPDATE'
}

/**
 * Fiber の作成
 */

// Fiber を作成する
export function createElement(
  type: string,
  props?: Record<string, unknown> | null,
  ...children: (string | Fiber)[]
): Fiber {
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
function createTextElement(text: string): Fiber {
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
export function render(element: Fiber, container: HTMLElement | Text): void {
  // Fiber Tree のルートを作成し、次の処理対象として設定する
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  }
  deletions = []
  nextUnitOfWork = wipRoot

  // レンダリング処理を開始する
  requestIdleCallback(workLoop)
}

let nextUnitOfWork: Fiber | null = null
let currentRoot: Fiber | null = null
let wipRoot: Fiber | null = null
let deletions: Fiber[] | null = null

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
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // Fiber 自身を DOM に反映する
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  // Fiber の子要素を構成する
  const elements = fiber.props.children
  reconcileChildren(fiber, elements)

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

function reconcileChildren(wipFiber: Fiber, elements: Fiber[]): void {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling: Fiber | null = null

  while (index < elements.length || oldFiber != null) {
    // oldFiber: what we rendered last time
    // element: what we are rendering now
    const element = elements[index]
    let newFiber: Fiber | null = null

    const sameType = oldFiber && element && element.type === oldFiber.type
    if (sameType) {
      // 以前の Fiber と新しい Fiber が同じタイプである場合、props を更新する
      newFiber = {
        type: oldFiber!.type,
        props: element.props,
        dom: oldFiber!.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      }
    }
    if (element && !sameType) {
      // タイプが異なり、かつ新しい Fiber が存在する場合、新しい DOM ノードを作成する
      if (element && !sameType) {
        newFiber = {
          type: element.type,
          props: element.props,
          dom: null,
          parent: wipFiber,
          alternate: null,
          effectTag: 'PLACEMENT',
        }
      }
    }
    if (oldFiber && !sameType) {
      // タイプが異なり、かつ以前の Fiber が存在する場合、以前の DOM ノードを削除する
      oldFiber.effectTag = 'DELETION'
      deletions?.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      wipFiber.child = newFiber
    } else if (element) {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

// 実際にレンダリング可能な Node へと Fiber を変換する
function createDom(filber: Fiber): HTMLElement | Text {
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

const isEvent = (key: string) => key.startsWith('on')
const isProperty = (key: string) => key !== 'children' && !isEvent(key)
const isNew =
  (prev: Record<string, unknown>, next: Record<string, unknown>) =>
  (key: string) =>
    prev[key] !== next[key]
const isGone =
  (prev: Record<string, unknown>, next: Record<string, unknown>) =>
  (key: string) =>
    !(key in next)
function updateDom(
  dom: HTMLElement | Text,
  prevProps: Record<string, unknown>,
  nextProps: Record<string, unknown>,
): void {
  // イベントリスナーのうち、既にあるものや変更があったものを削除する
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })

  // 以前のプロパティを削除する
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = ''
    })

  // 新規、または変更されたプロパティをセットする
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name]
    })

  // イベントリスナーをセットする
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

/**
 * Fiber Tree の DOM への反映
 */

// Fiber Tree を DOM に反映し、それが終わったら Fiber Tree を初期化する
function commitRoot(): void {
  deletions?.forEach(commitWork)
  commitWork(wipRoot?.child)
  currentRoot = wipRoot
  wipRoot = null
}

// Fiber Tree を DOM に反映する
function commitWork(fiber?: Fiber | null): void {
  if (!fiber) {
    return
  }

  // 自身を DOM に反映する
  const domParent = fiber.parent?.dom
  if (fiber.effectTag === 'PLACEMENT' && fiber.dom) {
    domParent?.appendChild(fiber.dom)
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom) {
    updateDom(fiber.dom, fiber.alternate?.props, fiber.props)
  } else if (fiber.effectTag === 'DELETION' && fiber.dom) {
    domParent?.removeChild(fiber.dom)
  }

  // 子要素を DOM に反映する
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}
