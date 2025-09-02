import { Directive, ElementRef, EventEmitter, Output, HostListener } from '@angular/core';

export interface SwipeEvent {
  direction: 'left' | 'right' | 'up' | 'down';
  deltaX: number;
  deltaY: number;
  duration: number;
}

@Directive({
  selector: '[appSwipe]',
  standalone: true
})
export class SwipeDirective {
  @Output() swipe = new EventEmitter<SwipeEvent>();
  @Output() swipeLeft = new EventEmitter<SwipeEvent>();
  @Output() swipeRight = new EventEmitter<SwipeEvent>();
  @Output() swipeUp = new EventEmitter<SwipeEvent>();
  @Output() swipeDown = new EventEmitter<SwipeEvent>();

  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private isTracking = false;

  private readonly SWIPE_THRESHOLD = 50; // Minimum distance for swipe
  private readonly TIME_THRESHOLD = 500; // Maximum time for swipe (ms)

  constructor(private elementRef: ElementRef) {}

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.startTracking(event.touches[0].clientX, event.touches[0].clientY);
    }
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    this.startTracking(event.clientX, event.clientY);
    event.preventDefault();
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(event: TouchEvent): void {
    if (this.isTracking && event.changedTouches.length === 1) {
      this.endTracking(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
    }
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    if (this.isTracking) {
      this.endTracking(event.clientX, event.clientY);
    }
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    // Prevent default scrolling during potential swipe
    if (this.isTracking) {
      const touch = event.touches[0];
      const deltaX = Math.abs(touch.clientX - this.startX);
      const deltaY = Math.abs(touch.clientY - this.startY);
      
      // If horizontal movement is greater than vertical, prevent scroll
      if (deltaX > deltaY && deltaX > 20) {
        event.preventDefault();
      }
    }
  }

  private startTracking(x: number, y: number): void {
    this.startX = x;
    this.startY = y;
    this.startTime = Date.now();
    this.isTracking = true;
  }

  private endTracking(endX: number, endY: number): void {
    if (!this.isTracking) return;

    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;
    const duration = Date.now() - this.startTime;

    this.isTracking = false;

    // Check if swipe meets criteria
    if (duration > this.TIME_THRESHOLD) return;

    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine swipe direction
    if (absDeltaX > this.SWIPE_THRESHOLD || absDeltaY > this.SWIPE_THRESHOLD) {
      let direction: 'left' | 'right' | 'up' | 'down';

      if (absDeltaX > absDeltaY) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      const swipeEvent: SwipeEvent = {
        direction,
        deltaX,
        deltaY,
        duration
      };

      // Emit specific direction events
      switch (direction) {
        case 'left':
          this.swipeLeft.emit(swipeEvent);
          break;
        case 'right':
          this.swipeRight.emit(swipeEvent);
          break;
        case 'up':
          this.swipeUp.emit(swipeEvent);
          break;
        case 'down':
          this.swipeDown.emit(swipeEvent);
          break;
      }

      // Emit general swipe event
      this.swipe.emit(swipeEvent);
    }
  }
}