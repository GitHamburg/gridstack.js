// dd-draggable.ts 2.2.0-dev @preserve

/**
 * https://gridstackjs.com/
 * (c) 2020 rhlin, Alain Dumesny
 * gridstack.js may be freely distributed under the MIT license.
*/
import { DDManager } from './dd-manager';
import { DDUtils } from './dd-utils';
import { DDBaseImplement, HTMLElementExtendOpt } from './dd-base-impl';
import { GridItemHTMLElement, DDUIData } from '../types';

export interface DDDraggableOpt {
  appendTo?: string | HTMLElement;
  containment?: string | HTMLElement; // TODO: not implemented yet
  handle?: string;
  revert?: string | boolean | unknown; // TODO: not implemented yet
  scroll?: boolean; // nature support by HTML5 drag drop, can't be switch to off actually
  helper?: string | HTMLElement | ((event: Event) => HTMLElement);
  basePosition?: 'fixed' | 'absolute';
  start?: (event: Event, ui: DDUIData) => void;
  stop?: (event: Event) => void;
  drag?: (event: Event, ui: DDUIData) => void;
}

export interface DragOffset {
  left: number;
  top: number;
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
}

export class DDDraggable extends DDBaseImplement implements HTMLElementExtendOpt<DDDraggableOpt> {
  public el: HTMLElement;
  public helper: HTMLElement;
  public option: DDDraggableOpt;
  public dragOffset: DragOffset;
  public dragElementOriginStyle: Array<string>;
  public dragFollowTimer: number;
  public mouseDownElement: HTMLElement;
  public dragging = false;
  public paintTimer: number;
  public parentOriginStylePosition: string;
  public helperContainment: HTMLElement;

  private static basePosition: 'fixed' | 'absolute' = 'absolute';
  private static dragEventListenerOption = DDUtils.isEventSupportPassiveOption ? { capture: true, passive: true } : true;
  private static originStyleProp = ['transition', 'pointerEvents', 'position',
    'left', 'top', 'opacity', 'zIndex', 'width', 'height', 'willChange'];

  constructor(el: HTMLElement, option: DDDraggableOpt = {}) {
    super();
    this.el = el;
    this.option = option;
    // create var event binding so we can easily remove and still look like TS methods (unlike anonymous functions)
    this.mouseDown = this.mouseDown.bind(this);
    this.dragStart = this.dragStart.bind(this);
    this.drag = this.drag.bind(this);
    this.dragEnd = this.dragEnd.bind(this);
    this.dragFollow = this.dragFollow.bind(this);

    this.init();
  }

  public on(event: 'drag' | 'dragstart' | 'dragstop', callback: (event: DragEvent) => void): void {
    super.on(event, callback);
  }

  public off(event: 'drag' | 'dragstart' | 'dragstop'): void {
    super.off(event);
  }

  public enable(): void {
    super.enable();
    this.el.draggable = true;
    this.el.classList.remove('ui-draggable-disabled');
  }

  public disable(): void {
    super.disable();
    this.el.draggable = false;
    this.el.classList.add('ui-draggable-disabled');
  }

  public destroy(): void {
    if (this.dragging) {
      // Destroy while dragging should remove dragend listener and manually trigger
      // dragend, otherwise dragEnd can't perform dragstop because eventRegistry is
      // destroyed.
      this.dragEnd({} as DragEvent);
    }
    this.el.draggable = false;
    this.el.classList.remove('ui-draggable');
    this.el.removeEventListener('mousedown', this.mouseDown);
    this.el.removeEventListener('dragstart', this.dragStart);
    delete this.el;
    delete this.helper;
    delete this.option;
    super.destroy();
  }

  public updateOption(opts: DDDraggableOpt): DDDraggable {
    Object.keys(opts).forEach(key => this.option[key] = opts[key]);
    return this;
  }

  protected init(): DDDraggable {
    this.el.draggable = true;
    this.el.classList.add('ui-draggable');
    this.el.addEventListener('mousedown', this.mouseDown);
    this.el.addEventListener('dragstart', this.dragStart);
    return this;
  }

  private mouseDown(event: MouseEvent): void {
    this.mouseDownElement = event.target as HTMLElement;
  }

  private dragStart(event: DragEvent): void {
    if (this.option.handle && !(
      this.mouseDownElement
      && this.mouseDownElement.matches(
        `${this.option.handle}, ${this.option.handle} > *`
      )
    )) {
      event.preventDefault();
      return;
    }
    DDManager.dragElement = this;
    this.helper = this.createHelper(event);
    this.setupHelperContainmentStyle();
    this.dragOffset = this.getDragOffset(event, this.el, this.helperContainment);
    const ev = DDUtils.initEvent<DragEvent>(event, { target: this.el, type: 'dragstart' });
    if (this.helper !== this.el) {
      this.setupDragFollowNodeNotifyStart(ev);
    } else {
      this.dragFollowTimer = window.setTimeout(() => {
        delete this.dragFollowTimer;
        this.setupDragFollowNodeNotifyStart(ev);
      }, 0);
    }
    this.cancelDragGhost(event);
  }

  protected setupDragFollowNodeNotifyStart(ev: Event): DDDraggable {
    this.setupHelperStyle();
    document.addEventListener('dragover', this.drag, DDDraggable.dragEventListenerOption);
    this.el.addEventListener('dragend', this.dragEnd);
    if (this.option.start) {
      this.option.start(ev, this.ui());
    }
    this.dragging = true;
    this.helper.classList.add('ui-draggable-dragging');
    this.triggerEvent('dragstart', ev);
    return this;
  }

  private drag(event: DragEvent): void {
    this.dragFollow(event);
    const ev = DDUtils.initEvent<DragEvent>(event, { target: this.el, type: 'drag' });
    if (this.option.drag) {
      this.option.drag(ev, this.ui());
    }
    this.triggerEvent('drag', ev);
  }

  private dragEnd(event: DragEvent): void {
    if (this.dragFollowTimer) {
      clearTimeout(this.dragFollowTimer);
      delete this.dragFollowTimer;
      return;
    } else {
      if (this.paintTimer) {
        cancelAnimationFrame(this.paintTimer);
      }
      document.removeEventListener('dragover', this.drag, DDDraggable.dragEventListenerOption);
      this.el.removeEventListener('dragend', this.dragEnd);
    }
    this.dragging = false;
    this.helper.classList.remove('ui-draggable-dragging');
    this.helperContainment.style.position = this.parentOriginStylePosition || null;
    if (this.helper === this.el) {
      this.removeHelperStyle();
    } else {
      this.helper.remove();
    }
    const ev = DDUtils.initEvent<DragEvent>(event, { target: this.el, type: 'dragstop' });
    if (this.option.stop) {
      this.option.stop(ev); // Note: ui() not used by gridstack so don't pass
    }
    this.triggerEvent('dragstop', ev);
    delete DDManager.dragElement;
    delete this.helper;
    delete this.mouseDownElement;
  }

  private createHelper(event: DragEvent): HTMLElement {
    const helperIsFunction = (typeof this.option.helper) === 'function';
    const helper = (helperIsFunction
      ? (this.option.helper as ((event: Event) => HTMLElement)).apply(this.el, [event])
      : (this.option.helper === "clone" ? DDUtils.clone(this.el) : this.el)
    ) as HTMLElement;
    if (!document.body.contains(helper)) {
      DDUtils.appendTo(helper, (this.option.appendTo === "parent"
        ? this.el.parentNode
        : this.option.appendTo));
    }
    if (helper === this.el) {
      this.dragElementOriginStyle = DDDraggable.originStyleProp.map(prop => this.el.style[prop]);
    }
    return helper;
  }

  private setupHelperStyle(): DDDraggable {
    this.helper.style.pointerEvents = 'none';
    this.helper.style.width = this.dragOffset.width + 'px';
    this.helper.style.height = this.dragOffset.height + 'px';
    this.helper.style['willChange'] = 'left, top';
    this.helper.style.transition = 'none'; // show up instantly
    this.helper.style.position = this.option.basePosition || DDDraggable.basePosition;
    this.helper.style.zIndex = '1000';
    setTimeout(() => {
      if (this.helper) {
        this.helper.style.transition = null; // recover animation
      }
    }, 0);
    return this;
  }

  private removeHelperStyle(): DDDraggable {
    // don't bother restoring styles if we're gonna remove anyway...
    if (! (this.helper as GridItemHTMLElement)?.gridstackNode?._isAboutToRemove) {
      DDDraggable.originStyleProp.forEach(prop => {
        this.helper.style[prop] = this.dragElementOriginStyle[prop] || null;
      });
    }
    delete this.dragElementOriginStyle;
    return this;
  }

  private dragFollow(event: DragEvent): void {
    if (this.paintTimer) {
      cancelAnimationFrame(this.paintTimer);
    }
    this.paintTimer = requestAnimationFrame(() => {
      delete this.paintTimer;
      const offset = this.dragOffset;
      let containmentRect = { left: 0, top: 0 };
      if (this.helper.style.position === 'absolute') {
        const { left, top } = this.helperContainment.getBoundingClientRect();
        containmentRect = { left, top };
      }
      this.helper.style.left = event.clientX + offset.offsetLeft - containmentRect.left + 'px';
      this.helper.style.top = event.clientY + offset.offsetTop - containmentRect.top + 'px';
    });
  }

  private setupHelperContainmentStyle(): DDDraggable {
    this.helperContainment = this.helper.parentElement;
    if (this.option.basePosition !== 'fixed') {
      this.parentOriginStylePosition = this.helperContainment.style.position;
      if (window.getComputedStyle(this.helperContainment).position.match(/static/)) {
        this.helperContainment.style.position = 'relative';
      }
    }
    return this;
  }

  private cancelDragGhost(e: DragEvent): DDDraggable {
    if (e.dataTransfer != null) {
      e.dataTransfer.setData('text', '');
    }
    e.dataTransfer.effectAllowed = 'move';
    if ('function' === typeof DataTransfer.prototype.setDragImage) {
      e.dataTransfer.setDragImage(new Image(), 0, 0);
    } else {
      // ie
      (e.target as HTMLElement).style.display = 'none';
      setTimeout(() => {
        (e.target as HTMLElement).style.display = '';
      });
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    return this;
  }

  private getDragOffset(event: DragEvent, el: HTMLElement, parent: HTMLElement): DragOffset {

    // in case ancestor has transform/perspective css properties that change the viewpoint
    let xformOffsetX = 0;
    let xformOffsetY = 0;
    if (parent) {
      const testEl = document.createElement('div');
      DDUtils.addElStyles(testEl, {
        opacity: '0',
        position: 'fixed',
        top: 0 + 'px',
        left: 0 + 'px',
        width: '1px',
        height: '1px',
        zIndex: '-999999',
      });
      parent.appendChild(testEl);
      const testElPosition = testEl.getBoundingClientRect();
      parent.removeChild(testEl);
      xformOffsetX = testElPosition.left;
      xformOffsetY = testElPosition.top;
      // TODO: scale ?
    }

    const targetOffset = el.getBoundingClientRect();
    return {
      left: targetOffset.left,
      top: targetOffset.top,
      offsetLeft: - event.clientX + targetOffset.left - xformOffsetX,
      offsetTop: - event.clientY + targetOffset.top - xformOffsetY,
      width: targetOffset.width,
      height: targetOffset.height
    };
  }

  /** public -> called by DDDroppable as well */
  public ui = (): DDUIData => {
    const containmentEl = this.el.parentElement;
    const containmentRect = containmentEl.getBoundingClientRect();
    const offset = this.helper.getBoundingClientRect();
    return {
      position: { //Current CSS position of the helper as { top, left } object
        top: offset.top - containmentRect.top,
        left: offset.left - containmentRect.left
      }
      /* not used by GridStack for now...
      helper: [this.helper], //The object arr representing the helper that's being dragged.
      offset: { top: offset.top, left: offset.left } // Current offset position of the helper as { top, left } object.
      */
    };
  }
}


