import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DrillDefinitionEditor from "./DrillDefinitionEditor";

afterEach(cleanup);

const noop = () => {};

describe("DrillDefinitionEditor", () => {
  it("renders the current value", () => {
    render(
      <DrillDefinitionEditor
        value={'{ "version": 1 }'}
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={noop}
      />,
    );
    expect(screen.getByLabelText("Definition (JSON)")).toHaveValue(
      '{ "version": 1 }',
    );
  });

  it("shows a parse error instead of schema issues", () => {
    render(
      <DrillDefinitionEditor
        value="{ nope"
        onChange={noop}
        parseError="Unexpected token n"
        issues={[]}
        onFormat={noop}
      />,
    );
    expect(screen.getByText(/Invalid JSON: Unexpected token n/)).toBeInTheDocument();
    expect(
      screen.queryByText("Definition satisfies the v1 schema."),
    ).not.toBeInTheDocument();
  });

  it("lists schema issues with their JSON path", () => {
    render(
      <DrillDefinitionEditor
        value="{}"
        onChange={noop}
        parseError={null}
        issues={[
          { instancePath: "/court", keyword: "required", message: "must have required property 'court'" },
        ]}
        onFormat={noop}
      />,
    );
    expect(
      screen.getByText("/court: must have required property 'court'"),
    ).toBeInTheDocument();
  });

  it("confirms when a non-empty definition satisfies the schema", () => {
    render(
      <DrillDefinitionEditor
        value={'{ "version": 1 }'}
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={noop}
      />,
    );
    expect(
      screen.getByText("Definition satisfies the v1 schema."),
    ).toBeInTheDocument();
  });

  it("stays quiet for blank input", () => {
    render(
      <DrillDefinitionEditor
        value=""
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={noop}
      />,
    );
    expect(
      screen.queryByText("Definition satisfies the v1 schema."),
    ).not.toBeInTheDocument();
  });

  it("disables Format JSON when blank and enables it otherwise", () => {
    const { rerender } = render(
      <DrillDefinitionEditor
        value=""
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Format JSON" })).toBeDisabled();

    rerender(
      <DrillDefinitionEditor
        value="{}"
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Format JSON" })).toBeEnabled();
  });

  it("fires onFormat when the button is clicked", async () => {
    const onFormat = vi.fn();
    render(
      <DrillDefinitionEditor
        value="{}"
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={onFormat}
      />,
    );
    screen.getByRole("button", { name: "Format JSON" }).click();
    expect(onFormat).toHaveBeenCalledTimes(1);
  });

  it("marks the textarea invalid when there are issues", () => {
    render(
      <DrillDefinitionEditor
        value="{}"
        onChange={noop}
        parseError={null}
        issues={[{ instancePath: "/court", keyword: "required", message: "missing" }]}
        onFormat={noop}
      />,
    );
    expect(screen.getByLabelText("Definition (JSON)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("shows one gutter number per line of the definition", () => {
    const { container } = render(
      <DrillDefinitionEditor
        value={'{\n  "version": 1\n}'}
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={noop}
      />,
    );
    const gutter = container.querySelector(".drill-definition-gutter")!;
    expect(gutter.textContent).toBe("1\n2\n3");
  });

  it("keeps showing a single gutter number for blank input", () => {
    const { container } = render(
      <DrillDefinitionEditor
        value=""
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={noop}
      />,
    );
    const gutter = container.querySelector(".drill-definition-gutter")!;
    expect(gutter.textContent).toBe("1");
  });

  it("hides the gutter from assistive technology", () => {
    const { container } = render(
      <DrillDefinitionEditor
        value="{}"
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={noop}
      />,
    );
    const gutter = container.querySelector(".drill-definition-gutter")!;
    expect(gutter.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the gutter scrolled in sync with the textarea", () => {
    const { container } = render(
      <DrillDefinitionEditor
        value={"{\n".repeat(40) + "}"}
        onChange={noop}
        parseError={null}
        issues={[]}
        onFormat={noop}
      />,
    );
    const textarea = screen.getByLabelText(
      "Definition (JSON)",
    ) as HTMLTextAreaElement;
    const gutter = container.querySelector(".drill-definition-gutter")!;
    textarea.scrollTop = 40;
    fireEvent.scroll(textarea);
    expect(gutter.scrollTop).toBe(40);
  });
});
