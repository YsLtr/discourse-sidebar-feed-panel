export function closestTarget(event: Event, selector: string) {
  return event.target instanceof Element
    ? event.target.closest<HTMLElement>(selector)
    : null;
}
