import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SkillCard from "./SkillCard";
import type { Skill } from "../api";

const skill: Skill = {
  id: 1,
  title: "Jump Serve",
  slug: "jump-serve",
  description: "Toss high and strike.",
  category_id: 3,
  category: { id: 3, name: "Serving", slug: "serving" },
};

describe("SkillCard", () => {
  it("renders the category, title and description", () => {
    render(<SkillCard skill={skill} />);
    expect(screen.getByText("Serving")).toBeInTheDocument();
    expect(screen.getByText("Jump Serve")).toBeInTheDocument();
    expect(screen.getByText("Toss high and strike.")).toBeInTheDocument();
  });

  it("omits the category badge and description when absent", () => {
    const { container } = render(
      <SkillCard
        skill={{ ...skill, category: undefined, description: null }}
      />
    );
    expect(container.querySelector(".card-category")).toBeNull();
    expect(container.querySelector(".card-description")).toBeNull();
    expect(screen.getByText("Jump Serve")).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", () => {
    const onClick = vi.fn();
    render(<SkillCard skill={skill} onClick={onClick} />);
    fireEvent.click(screen.getByText("Jump Serve"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
