import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DrillCard from "./DrillCard";
import type { Drill } from "../api";

const drill: Drill = {
  id: 1,
  title: "Side Out Race",
  slug: "side-out-race",
  setup_instructions: "Split into two teams.",
  training_stage: "middle",
  difficulty_level: "intermediate",
  min_players: 2,
  max_players: 6,
  ideal_num_players: 4,
};

describe("DrillCard", () => {
  it("renders the title, setup instructions and stat labels", () => {
    render(<DrillCard drill={drill} />);
    expect(screen.getByText("Side Out Race")).toBeInTheDocument();
    expect(screen.getByText("Split into two teams.")).toBeInTheDocument();
    expect(screen.getByText("2–6 players")).toBeInTheDocument();
    expect(screen.getByText("Ideal: 4")).toBeInTheDocument();
    expect(screen.getByText("Middle")).toBeInTheDocument();
    expect(screen.getByText("intermediate")).toBeInTheDocument();
  });

  it("singularizes the player range when min equals max", () => {
    render(<DrillCard drill={{ ...drill, min_players: 4, max_players: 4 }} />);
    expect(screen.getByText("4 players")).toBeInTheDocument();
  });

  it("hides the description when setup instructions are empty", () => {
    const { container } = render(
      <DrillCard drill={{ ...drill, setup_instructions: "" }} />
    );
    expect(container.querySelector(".card-description")).toBeNull();
  });

  it("calls onClick when the card is clicked", () => {
    const onClick = vi.fn();
    render(<DrillCard drill={drill} onClick={onClick} />);
    fireEvent.click(screen.getByText("Side Out Race"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
