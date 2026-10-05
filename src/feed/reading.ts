/** Away latches after one viewport, and clears only at the actual head. */
export class ReadingState {
  away: boolean | null = null;
  atHead(scrollTop: number) {
    return scrollTop <= 1;
  }
  isAway(scrollTop: number, viewport: number) {
    return (
      !this.atHead(scrollTop) && (this.away === true || scrollTop > viewport)
    );
  }
  reset() {
    this.away = null;
  }
}
