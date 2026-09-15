/**
 * LineNumberedCode — the shared read-only JSON view.
 *
 * The gutter is a sibling of the `<pre>` rather than a child on purpose: the
 * `<pre>`'s textContent has to stay exactly the code, because both drill JSON
 * views assert on it. These tests pin that contract down, plus the numbering
 * behaviour the two views rely on.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LineNumberedCode from "./LineNumberedCode";

afterEach(cleanup);

const CODE = '{\n  "version": 1\n}';

const gutter = (container: HTMLElement) =>
  container.querySelector(".line-numbered-code__gutter")!;

describe("LineNumberedCode", () => {
  it("shows one gutter number per line of the code", () => {
    const { container } = render(<LineNumberedCode code={CODE} />);

    expect(gutter(container).textContent).toBe("1\n2\n3");
  });

  it("keeps showing a single gutter number for blank code", () => {
    const { container } = render(<LineNumberedCode code="" />);

    expect(gutter(container).textContent).toBe("1");
  });

  it("hides the gutter from assistive technology", () => {
    const { container } = render(<LineNumberedCode code="{}" />);

    expect(gutter(container).getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the numbers out of the code's textContent", () => {
    render(<LineNumberedCode code={CODE} codeTestId="code" />);

    // Numbers are presentation: a copy of the code must not carry them.
    expect(screen.getByTestId("code").textContent).toBe(CODE);
  });

  it("passes the consumer's classes to the wrapper and the <pre>", () => {
    const { container } = render(
      <LineNumberedCode
        code={CODE}
        className="wrapper-class"
        codeClassName="code-class"
      />,
    );

    // The wrapper keeps the component class so its variables/layout apply.
    expect(
      container.querySelector(".line-numbered-code.wrapper-class"),
    ).not.toBeNull();
    expect(container.querySelector("pre.code-class")).not.toBeNull();
  });

  it("keeps the gutter scrolled in sync with the code", () => {
    const { container } = render(
      <LineNumberedCode code={"{\n".repeat(40) + "}"} />,
    );
    const pre = container.querySelector("pre")!;

    pre.scrollTop = 40;
    fireEvent.scroll(pre);

    expect(gutter(container).scrollTop).toBe(40);
  });
});