// 処理の流れ
// 1. レンダリングを開始する
//   - createElement により Fiber を作成する
//   - render によりレンダリングを開始する
// 2. Reconciliation
//   - performUnitOfWork により、段階的に Fiber Tree と各 Fiber に対応する DOM を構築する
//   -
// 3. Fiber Tree を DOM へと反映する
//
// 用語
// - Fiber
// - Fiber Tree
// - Reconciliation
// - DOM

type Props = Record<string, unknown>

type Fiber = {
  type?: string
  props: {
    [key: string]: unknown
    children: Fiber[]
  }
  dom?: HTMLElement | Text | null // Fiber に対応する DOM
  parent?: Fiber
  child?: Fiber
  sibling?: Fiber
  alternate?: Fiber | null // 直前に DOM にコミットされた Fiber
  effectTag?: 'PLACEMENT' | 'DELETION' | 'UPDATE' // DOM に反映する際の処理の種類
}

/**
 * Fiber の作成
 */

// Fiber を作成する
export function createElement(
  type: string,
  props?: Props | null,
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

let nextUnitOfWork: Fiber | null = null // 次に処理する Fiber
let currentRoot: Fiber | null = null // 直前に DOM にコミットされた Fiber
let wipRoot: Fiber | null = null // Fiber Tree のルート
let deletions: Fiber[] | null = null // 削除対象の Fiber

// Fiber Tree のルートを構築し、レンダリング処理を開始する
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
 * Fiber Tree と、各 Fiber に対応する DOM の構築
 */

// Fiber に対応する DOM を構築し、次の処理対象の Fiber を返す
function performUnitOfWork(fiber: Fiber): Fiber | null {
  // Fiber 自身の DOM を作成する
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }

  // Fiber の子要素を取得し、既存の Fiber との差分を反映する
  const elements = fiber.props.children
  reconcileChildren(fiber, elements)

  /**
   * 次の処理対象となる Fiber を返す
   *
   * ┌──────┐
   * │ root │
   * └─┬────┘
   *   │  ▲
   *   │  │
   *   ▼  │
   * ┌────┴──┐
   * │ <div> │
   * └─┬─────┘
   *   │  ▲ ▲
   *   │  │ └───────┐
   *   ▼  │         │
   * ┌────┴─┐      ┌┴─────┐
   * │ <h1> ├─────►│ <h2> │
   * └─┬────┘      └──────┘
   *   │  ▲ ▲
   *   │  │ └───────┐
   *   ▼  │         │
   * ┌────┴┐       ┌┴────┐
   * │ <p> ├──────►│ <a> │
   * └─────┘       └─────┘
   *
   * たとえば上の図で考えると、
   * root -> <div> -> <h1> -> <p> -> <a> -> <h2>
   * という順番で処理される
   */
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

// 子要素に関して、既存の Fiber に新しい Fiber との差分を反映する
function reconcileChildren(wipFiber: Fiber, elements: Fiber[]): void {
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child // 直前に DOM にコミットされた Fiber
  let prevSibling: Fiber | null = null

  while (index < elements.length || oldFiber != null) {
    const element = elements[index] // 次に DOM に反映する Fiber
    let newFiber: Fiber | null = null

    const sameType = oldFiber && element && element.type === oldFiber.type
    if (sameType) {
      // 以前の Fiber と新しい Fiber が同じタイプである場合、props のみを更新する
      newFiber = {
        type: oldFiber!.type,
        props: element.props,
        dom: oldFiber!.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE', // 更新
      }
    }
    if (element && !sameType) {
      // タイプが異なり、かつ新しい Fiber が存在する場合、新しい DOM ノードを作成する
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT', // 追加
      }
    }
    if (oldFiber && !sameType) {
      // タイプが異なり、かつ以前の Fiber が存在する場合、以前の DOM ノードを削除する
      oldFiber.effectTag = 'DELETION' // 削除
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

  // Fiber の props を DOM に反映する
  updateDom(dom, {}, filber.props)

  return dom
}

function updateDom(
  dom: HTMLElement | Text,
  prevProps: Props,
  nextProps: Props,
): void {
  const isEvent = (key: string) => key.startsWith('on')
  const isProperty = (key: string) => key !== 'children' && !isEvent(key)
  const isNew = (prev: Props, next: Props) => (key: string) =>
    prev[key] !== next[key]
  const isGone = (prev: Props, next: Props) => (key: string) => !(key in next)

  // 既存のイベントリスナーを削除・更新する
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })

  // 他のプロパティを削除する
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

// Fiber Tree を DOM に反映する
function commitRoot(): void {
  deletions?.forEach(commitWork)
  commitWork(wipRoot?.child)
  currentRoot = wipRoot
  wipRoot = null
}

// 各 Fiber を再帰的に DOM に反映する
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
