// dd-resizable.ts 2.2.0-dev @preserve

/**
 * https://gridstackjs.com/
 * (c) 2020 rhlin, Alain Dumesny
 * gridstack.js may be freely distributed under the MIT license.
*/
import { DDResizableHandle } from './dd-resizable-handle';
import { DDBaseImplement, HTMLElementExtendOpt } from './dd-base-impl';
import { DDUtils } from './dd-utils';
import { DDUIData, Rect, Size } from '../types';

export interface DDResizableOpt {
  autoHide?: boolean;
  handles?: string;
  maxHeight?: number;
  maxWidth?: number;
  minHeight?: number;
  minWidth?: number;
  basePosition?: 'fixed' | 'absolute';
  start?: (event: Event, ui: DDUIData) => void;
  stop?: (event: Event) => void;
  resize?: (event: Event, ui: DDUIData) => void;
}

export class DDResizable extends DDBaseImplement implements HTMLElementExtendOpt<DDResizableOpt> {

  public el: HTMLElement;
  public option: DDResizableOpt;
  public handlers: DDResizableHandle[];
  public helper: HTMLElement;
  public originalRect: Rect;
  public temporalRect: Rect;

  private startEvent: MouseEvent;
  private elOriginStyle;
  private parentOriginStylePosition;
  private static originStyleProp = ['width', 'height', 'position', 'left', 'top', 'opacity', 'zIndex'];

  constructor(el: HTMLElement, opts: DDResizableOpt = {}) {
    super();
    this.el = el;
    this.option = opts;
    this.init();
  }

  public on(event: 'resizestart' | 'resize' | 'resizestop', callback: (event: DragEvent) => void): void {
    super.on(event, callback);
  }

  public off(event: 'resizestart' | 'resize' | 'resizestop'): void {
    super.off(event);
  }

  public enable(): void {
    if (this.disabled) {
      super.enable();
      this.el.classList.remove('ui-resizable-disabled');
    }
  }

  public disable(): void {
    if (!this.disabled) {
      super.disable();
      this.el.classList.add('ui-resizable-disabled');
    }
  }

  public destroy(): void {
    this.removeHandlers();
    if (this.option.autoHide) {
      this.el.removeEventListener('mouseover', this.showHandlers);
      this.el.removeEventListener('mouseout', this.hideHandlers);
    }
    this.el.classList.remove('ui-resizable');
    delete this.el;
    super.destroy();
  }

  public updateOption(opts: DDResizableOpt): DDResizable {
    let updateHandles = (opts.handles && opts.handles !== this.option.handles);
    let updateAutoHide = (opts.autoHide && opts.autoHide !== this.option.autoHide);
    Object.keys(opts).forEach(key => this.option[key] = opts[key]);
    if (updateHandles) {
      this.removeHandlers();
      this.setupHandlers();
    }
    if (updateAutoHide) {
      this.setupAutoHide();
    }
    return this;
  }

  protected init(): DDResizable {
    this.el.classList.add('ui-resizable');
    this.setupAutoHide();
    this.setupHandlers();
    return this;
  }

  protected setupAutoHide(): DDResizable {
    if (this.option.autoHide) {
      this.el.classList.add('ui-resizable-autohide');
      // use mouseover/mouseout instead of mouseenter mouseleave to get better performance;
      this.el.addEventListener('mouseover', this.showHandlers);
      this.el.addEventListener('mouseout', this.hideHandlers);
    } else {
      this.el.classList.remove('ui-resizable-autohide');
      this.el.removeEventListener('mouseover', this.showHandlers);
      this.el.removeEventListener('mouseout', this.hideHandlers);
    }
    return this;
  }

  private showHandlers = () => {
    this.el.classList.remove('ui-resizable-autohide');
  }

  private hideHandlers = () => {
    this.el.classList.add('ui-resizable-autohide');
  }

  protected setupHandlers(): DDResizable {
    let handlerDirection = this.option.handles || 'e,s,se';
    if (handlerDirection === 'all') {
      handlerDirection = 'n,e,s,w,se,sw,ne,nw';
    }
    this.handlers = handlerDirection.split(',')
      .map(dir => dir.trim())
      .map(dir => new DDResizableHandle(this.el, dir, {
        start: (event: MouseEvent) => {
          this.resizeStart(event);
        },
        stop: (event: MouseEvent) => {
          this.resizeStop(event);
        },
        move: (event: MouseEvent) => {
          this.resizing(event, dir);
        }
      }));
    return this;
  }

  protected resizeStart(event: MouseEvent): DDResizable {
    this.originalRect = this.el.getBoundingClientRect();
    this.startEvent = event;
    this.setupHelper();
    this.applyChange();
    const ev = DDUtils.initEvent<MouseEvent>(event, { type: 'resizestart', target: this.el });
    if (this.option.start) {
      this.option.start(ev, this.ui());
    }
    this.el.classList.add('ui-resizable-resizing');
    this.triggerEvent('resizestart', ev);
    return this;
  }

  protected resizing(event: MouseEvent, dir: string): DDResizable {
    this.temporalRect = this.getChange(event, dir);
    this.applyChange();
    const ev = DDUtils.initEvent<MouseEvent>(event, { type: 'resize', target: this.el });
    if (this.option.resize) {
      this.option.resize(ev, this.ui());
    }
    this.triggerEvent('resize', ev);
    return this;
  }

  protected resizeStop(event: MouseEvent): DDResizable {
    const ev = DDUtils.initEvent<MouseEvent>(event, { type: 'resizestop', target: this.el });
    if (this.option.stop) {
      this.option.stop(ev); // Note: ui() not used by gridstack so don't pass
    }
    this.el.classList.remove('ui-resizable-resizing');
    this.triggerEvent('resizestop', ev);
    this.cleanHelper();
    delete this.startEvent;
    delete this.originalRect;
    delete this.temporalRect;
    return this;
  }

  private setupHelper(): DDResizable {
    this.elOriginStyle = DDResizable.originStyleProp.map(prop => this.el.style[prop]);
    this.parentOriginStylePosition = this.el.parentElement.style.position;
    if (window.getComputedStyle(this.el.parentElement).position.match(/static/)) {
      this.el.parentElement.style.position = 'relative';
    }
    this.el.style.position = this.option.basePosition || 'absolute'; // or 'fixed'
    this.el.style.opacity = '0.8';
    this.el.style.zIndex = '1000';
    return this;
  }

  private cleanHelper(): DDResizable {
    DDResizable.originStyleProp.forEach(prop => {
      this.el.style[prop] = this.elOriginStyle[prop] || null;
    });
    this.el.parentElement.style.position = this.parentOriginStylePosition || null;
    return this;
  }

  private getChange(event: MouseEvent, dir: string): Rect {
    const oEvent = this.startEvent;
    const newRect = { // Note: originalRect is a complex object, not a simple Rect, so copy out.
      width: this.originalRect.width,
      height: this.originalRect.height,
      left: this.originalRect.left,
      top: this.originalRect.top
    };
    const offsetH = event.clientX - oEvent.clientX;
    const offsetV = event.clientY - oEvent.clientY;

    if (dir.indexOf('e') > -1) {
      newRect.width += event.clientX - oEvent.clientX;
    }
    if (dir.indexOf('s') > -1) {
      newRect.height += event.clientY - oEvent.clientY;
    }
    if (dir.indexOf('w') > -1) {
      newRect.width -= offsetH;
      newRect.left += offsetH;
    }
    if (dir.indexOf('n') > -1) {
      newRect.height -= offsetV;
      newRect.top += offsetV
    }
    const reshape = this.getReShapeSize(newRect.width, newRect.height);
    if (newRect.width !== reshape.width) {
      if (dir.indexOf('w') > -1) {
        newRect.left += reshape.width - newRect.width;
      }
      newRect.width = reshape.width;
    }
    if (newRect.height !== reshape.height) {
      if (dir.indexOf('n') > -1) {
        newRect.top += reshape.height - newRect.height;
      }
      newRect.height = reshape.height;
    }
    return newRect;
  }

  private getReShapeSize(oWidth: number, oHeight: number): Size {
    const maxWidth = this.option.maxWidth || oWidth;
    const minWidth = this.option.minWidth || oWidth;
    const maxHeight = this.option.maxHeight || oHeight;
    const minHeight = this.option.minHeight || oHeight;
    const width = Math.min(maxWidth, Math.max(minWidth, oWidth));
    const height = Math.min(maxHeight, Math.max(minHeight, oHeight));
    return { width, height };
  }

  private applyChange(): DDResizable {
    let containmentRect = { left: 0, top: 0, width: 0, height: 0 };
    if (this.el.style.position === 'absolute') {
      const containmentEl = this.el.parentElement;
      const { left, top } = containmentEl.getBoundingClientRect();
      containmentRect = { left, top, width: 0, height: 0 };
    }
    Object.keys(this.temporalRect || this.originalRect).forEach(key => {
      const value = this.temporalRect[key];
      this.el.style[key] = value - containmentRect[key] + 'px';
    });
    return this;
  }

  protected removeHandlers(): DDResizable {
    this.handlers.forEach(handle => handle.destroy());
    delete this.handlers;
    return this;
  }

  private ui = (): DDUIData => {
    const containmentEl = this.el.parentElement;
    const containmentRect = containmentEl.getBoundingClientRect();
    const rect = this.temporalRect || this.originalRect;
    return {
      position: {
        left: rect.left - containmentRect.left,
        top: rect.top - containmentRect.top
      },
      size: {
        width: rect.width,
        height: rect.height
      }
      /* Gridstack ONLY needs position set above... keep around in case.
      element: [this.el], // The object representing the element to be resized
      helper: [], // TODO: not support yet - The object representing the helper that's being resized
      originalElement: [this.el],// we don't wrap here, so simplify as this.el //The object representing the original element before it is wrapped
      originalPosition: { // The position represented as { left, top } before the resizable is resized
        left: this.originalRect.left - containmentRect.left,
        top: this.originalRect.top - containmentRect.top
      },
      originalSize: { // The size represented as { width, height } before the resizable is resized
        width: this.originalRect.width,
        height: this.originalRect.height
      }
      */
    };
  }
}
