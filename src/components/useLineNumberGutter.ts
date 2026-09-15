import { useEffect, useRef, type RefObject, type UIEvent } from "react";

export interface LineNumberGutter<T extends HTMLElement = HTMLElement> {
  /** Attach to the `overflow: hidden` gutter element that renders `numbers`. */
  gutterRef: RefObject<HTMLDivElement | null>;
  /** Attach to whatever actually scrolls: the `<textarea>` or the `<pre>`. */
  scrollerRef: RefObject<T | null>;
  /** Attach to the scroller's `onScroll` to mirror its scroll onto the gutter. */
  onScroll: (e: UIEvent<HTMLElement>) => void;
  /** One per logical line; also useful for accessibility hints. */
  lineCount: number;
  /** `"1\n2\n3"` — render inside the gutter (which is `white-space: pre`). */
  numbers: string;
}

/**
 * The line-number gutter's mechanics, shared by every JSON surface in the app:
 * the editable textarea (`DrillDefinitionEditor`) and the read-only views
 * (`LineNumberedCode`).
 *
 * It is generic over the scrolling element (`T`) because a `<textarea>` and a
 * `<pre>` scroll identically as far as a gutter is concerned. The gutter itself
 * never scrolls — it is `overflow: hidden` and gets its `scrollTop` mirrored
 * from the scroller by `onScroll`.
 *
 * Numbering a line correctly requires the text to wrap exactly as the gutter
 * does: one row of numbers per logical line. So the scroller must not wrap —
 * the textarea sets `wrap="off"` and the read-only view uses `white-space: pre`
 * (see the `.line-numbered-code` rules in App.css).
 */
export function useLineNumberGutter<T extends HTMLElement>(
  text: string,
): LineNumberGutter<T> {
  const gutterRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<T>(null);

  // A blank text still occupies one row, so it still gets a "1".
  const lineCount = text === "" ? 1 : text.split("\n").length;

  const onScroll = (e: UIEvent<HTMLElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Keep the gutter exactly as tall as the scroller, including when the user
  // drags the textarea's native resize handle. (jsdom has no ResizeObserver;
  // the guard keeps tests running — the CSS flex stretch is the fallback there.)
  useEffect(() => {
    const scroller = scrollerRef.current;
    const gutter = gutterRef.current;
    if (!scroller || !gutter || typeof ResizeObserver === "undefined") return;

    const syncHeight = () => {
      gutter.style.height = `${scroller.clientHeight}px`;
    };
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const numbers = Array.from({ length: lineCount }, (_, i) => i + 1).join("\n");

  return {
    gutterRef,
    scrollerRef,
    onScroll,
    lineCount,
    numbers,
  };
}