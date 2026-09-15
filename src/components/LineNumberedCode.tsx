/**
 * LineNumberedCode — a read-only code block with a line-number gutter.
 *
 * Shared by the drill JSON views: the visual builder's live preview
 * (`DrillDefinitionPanel`) and the "Drill Definition (JSON)" section of
 * `DrillDetail`. Both are the same thing — text that must be readable line by
 * line, down to the line — so both render this component.
 *
 * The gutter is a *sibling* of the `<pre>`, never a child, so the `<pre>`'s
 * `textContent` stays exactly the code. Consumers rely on that (each view ships
 * a test asserting it), and it keeps the numbers what they are: presentation,
 * not content.
 *
 * The editable counterpart is `DrillDefinitionEditor`; the two share their
 * numbering mechanics through `useLineNumberGutter`.
 */

import { useLineNumberGutter } from "./useLineNumberGutter";

interface LineNumberedCodeProps {
  /** The text to show. The `<pre>`'s textContent is exactly this. */
  code: string;
  /** Applied to the flex wrapper — where a consumer themes the gutter. */
  className?: string;
  /** Applied to the scrolling `<pre>`: colours, box, max-height. */
  codeClassName?: string;
  /** Applied to the `<pre>`, so consumers keep their own test hooks. */
  codeTestId?: string;
}

export default function LineNumberedCode({
  code,
  className,
  codeClassName,
  codeTestId,
}: LineNumberedCodeProps) {
  const { gutterRef, scrollerRef, onScroll, numbers } =
    useLineNumberGutter<HTMLPreElement>(code);

  const wrapperClass = ["line-numbered-code", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass}>
      <div
        ref={gutterRef}
        className="line-numbered-code__gutter"
        aria-hidden="true"
      >
        {numbers}
      </div>
      <pre
        ref={scrollerRef}
        className={codeClassName}
        data-testid={codeTestId}
        onScroll={onScroll}
      >
        {code}
      </pre>
    </div>
  );
}