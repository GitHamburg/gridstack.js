// dd-utils.ts 2.2.0-dev @preserve

/**
 * https://gridstackjs.com/
 * (c) 2020 rhlin, Alain Dumesny
 * gridstack.js may be freely distributed under the MIT license.
*/

export class DDUtils {

  public static isEventSupportPassiveOption = ((() => {
    let supportsPassive = false;
    let passiveTest = () => {
      // do nothing
    };
    document.addEventListener('test', passiveTest, {
      get passive() {
        supportsPassive = true;
        return true;
      }
    });
    document.removeEventListener('test', passiveTest);
    return supportsPassive;
  })());

  public static clone(el: HTMLElement): HTMLElement {
    const node = el.cloneNode(true) as HTMLElement;
    node.removeAttribute('id');
    return node;
  }

  public static appendTo(el: HTMLElement, parent: string | HTMLElement | Node): void {
    let parentNode: HTMLElement;
    if (typeof parent === 'string') {
      parentNode = document.querySelector(parent as string);
    } else {
      parentNode = parent as HTMLElement;
    }
    if (parentNode) {
      parentNode.append(el);
    }
  }

  public static setPositionRelative(el): void {
    if (!(/^(?:r|a|f)/).test(window.getComputedStyle(el).position)) {
      el.style.position = "relative";
    }
  }

  public static addElStyles(el: HTMLElement, styles: { [prop: string]: string | string[] }): void {
    if (styles instanceof Object) {
      for (const s in styles) {
        if (styles.hasOwnProperty(s)) {
          if (Array.isArray(styles[s])) {
            // support fallback value
            (styles[s] as string[]).forEach(val => {
              el.style[s] = val;
            });
          } else {
            el.style[s] = styles[s];
          }
        }
      }
    }
  }

  public static initEvent<T>(e: DragEvent | MouseEvent, info: { type: string; target?: EventTarget }): T {
    const kbdProps = 'altKey,ctrlKey,metaKey,shiftKey'.split(',');
    const ptProps = 'pageX,pageY,clientX,clientY,screenX,screenY'.split(',');
    const evt = { type: info.type };
    const obj = {
      button: 0,
      which: 0,
      buttons: 1,
      bubbles: true,
      cancelable: true,
      originEvent: e,
      target: info.target ? info.target : e.target
    }
    if (e instanceof DragEvent) {
      Object.assign(obj, { dataTransfer: e.dataTransfer });
    }
    DDUtils.copyProps(evt, e, kbdProps);
    DDUtils.copyProps(evt, e, ptProps);
    DDUtils.copyProps(evt, obj, Object.keys(obj));
    return evt as unknown as T;
  }

  private static copyProps(dst: unknown, src: unknown, props: string[]): void {
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      dst[p] = src[p];
    }
  }
}
