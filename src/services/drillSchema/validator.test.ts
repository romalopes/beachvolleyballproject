import { describe, expect, it } from "vitest";
import {
  validateDrillDefinition,
  type DrillSchemaIssue,
  type DrillSchemaValidation,
} from "./validator";

/**
 * Structural coverage for the React-side drill-definition validator.
 *
 * These cases pin the *structural* contract (types, enums, required fields,
 * additionalProperties, const/minItems) that the shared JSON Schema encodes.
 * Cross-step domain rules (reference resolution, coordinate bounds, movement
 * consistency) are intentionally NOT covered here — those belong to the Rails
 * `DrillDefinitionValidator`.
 */

/** A minimal, structurally valid v1 definition used as a mutation base. */
function minimal(): Record<string, unknown> {
  return {
    version: 1,
    court: { grid: { columns: 5, rows: 4 } },
    participants: [
      { id: "p1", type: "player" },
      { id: "coach", type: "coach" },
    ],
    balls: [{ id: "ball1", type: "volleyball" }],
    objects: [{ id: "cone1", type: "cone" }],
    steps: [
      {
        id: "step1",
        participants: [
          { id: "p1", active: true, location: { court: "court_1", x: 2, y: 2 } },
        ],
        balls: [
          { id: "ball1", active: true, location: { court: "court_1", x: 3, y: 2 } },
        ],
        objects: [
          { id: "cone1", active: true, location: { court: "court_1", x: 4, y: 4 } },
        ],
        actions: [
          { participant_id: "p1", action: { type: "serve", description: "Serve" } },
        ],
        participant_movements: [],
        ball_movements: [],
        object_movements: [],
      },
    ],
  };
}

/** First step of the minimal definition, spread into mutations. */
function step0(): Record<string, unknown> {
  return (minimal().steps as Record<string, unknown>[])[0];
}

function iss(v: DrillSchemaValidation): DrillSchemaIssue[] {
  return v.issues;
}

/** Assert a definition is rejected with at least the given keyword present. */
function expectKeyword(def: unknown, keyword: string): void {
  const r = validateDrillDefinition(def);
  expect(r.valid).toBe(false);
  expect(iss(r)).toEqual(
    expect.arrayContaining([expect.objectContaining({ keyword })])
  );
}

describe("validateDrillDefinition — valid definitions", () => {
  it("accepts a minimal valid definition", () => {
    const r = validateDrillDefinition(minimal());
    expect(r.valid).toBe(true);
    expect(iss(r)).toHaveLength(0);
  });

  it("accepts all 17 action types", () => {
    const types = [
      "serve", "receive", "pass", "set", "attack", "hit", "block", "peel",
      "defend", "save", "approach", "retreat", "run", "toss", "feed", "throw",
      "catch",
    ];
    for (const t of types) {
      const def = {
        ...minimal(),
        steps: [
          { ...step0(), actions: [{ participant_id: "p1", action: { type: t } }] },
        ],
      } as Record<string, unknown>;
      expect(validateDrillDefinition(def).valid, `action "${t}"`).toBe(true);
    }
  });

  it("accepts all participant types", () => {
    for (const t of ["player", "coach", "assistant_coach", "demonstrator"]) {
      const def = {
        ...minimal(),
        participants: [{ id: "p1", type: t }],
      } as Record<string, unknown>;
      expect(validateDrillDefinition(def).valid, `participant "${t}"`).toBe(true);
    }
  });

  it("accepts all ball types", () => {
    for (const t of ["volleyball", "frescoball", "other"]) {
      const def = {
        ...minimal(),
        balls: [{ id: "b1", type: t }],
      } as Record<string, unknown>;
      expect(validateDrillDefinition(def).valid, `ball "${t}"`).toBe(true);
    }
  });

  it("accepts all object types", () => {
    const types = [
      "cone", "bench", "obstacle", "frescoball", "target", "basket", "bucket",
      "pole", "hoop", "marker", "ladder", "bag", "net", "chair", "custom",
    ];
    for (const t of types) {
      const def = {
        ...minimal(),
        objects: [{ id: "o1", type: t }],
      } as Record<string, unknown>;
      expect(validateDrillDefinition(def).valid, `object "${t}"`).toBe(true);
    }
  });

  it("accepts both court IDs", () => {
    for (const c of ["court_1", "court_2"]) {
      const def = {
        ...minimal(),
        steps: [
          {
            ...step0(),
            participants: [
              { id: "p1", active: true, location: { court: c, x: 2, y: 2 } },
            ],
          },
        ],
      } as Record<string, unknown>;
      expect(validateDrillDefinition(def).valid, `court "${c}"`).toBe(true);
    }
  });

  it("accepts both orientations", () => {
    for (const o of ["top_down", "lateral"]) {
      const def = { ...minimal(), view: { orientation: o } } as Record<string, unknown>;
      expect(validateDrillDefinition(def).valid, `orientation "${o}"`).toBe(true);
    }
  });
});

describe("validateDrillDefinition — valid definitions (cont.)", () => {
  it("accepts empty arrays and multiple steps", () => {
    const def = {
      ...minimal(),
      participants: [],
      balls: [],
      objects: [],
      steps: [
        {
          ...step0(),
          participants: [],
          balls: [],
          objects: [],
          actions: [],
          participant_movements: [],
          ball_movements: [],
          object_movements: [],
        },
        {
          id: "step2",
          participants: [
            { id: "p1", active: true, location: { court: "court_2", x: 3, y: 3 } },
          ],
          balls: [
            { id: "ball1", active: true, location: { court: "court_2", x: 2, y: 4 } },
          ],
          objects: [],
          actions: [],
          participant_movements: [
            {
              participant_id: "p1",
              from: { court: "court_1", x: 2, y: 2 },
              to: { court: "court_2", x: 3, y: 3 },
            },
          ],
          ball_movements: [],
          object_movements: [],
        },
      ],
    } as Record<string, unknown>;
    const r = validateDrillDefinition(def);
    expect(r.valid).toBe(true);
    expect(iss(r)).toHaveLength(0);
  });

  it("accepts optional descriptions and fractional coordinates", () => {
    const def = {
      ...minimal(),
      participants: [{ id: "p1", type: "player", role: "hitter", description: "OH" }],
      balls: [{ id: "ball1", type: "volleyball", description: "Match ball" }],
      objects: [{ id: "cone1", type: "cone", description: "Marker" }],
      steps: [
        {
          ...step0(),
          description: "First step",
          participants: [
            { id: "p1", active: true, location: { court: "court_1", x: 2.5, y: 1.75 } },
          ],
          actions: [
            { participant_id: "p1", action: { type: "serve", description: "Jump serve" } },
          ],
          participant_movements: [
            { participant_id: "p1", to: { court: "court_1", x: 3, y: 3 }, description: "Shuffle" },
          ],
          ball_movements: [
            { ball_id: "ball1", to: { court: "court_2", x: 2, y: 4 }, description: "Toss" },
          ],
          object_movements: [
            { object_id: "cone1", to: { court: "court_1", x: 5, y: 4 }, description: "Reset" },
          ],
        },
      ],
    } as Record<string, unknown>;
    expect(validateDrillDefinition(def).valid).toBe(true);
  });

  it("accepts a court extended_area with all flags", () => {
    const def = {
      ...minimal(),
      court: {
        grid: { columns: 5, rows: 4 },
        extended_area: {
          enabled: true,
          left: true,
          right: false,
          court_1: true,
          court_2: false,
        },
      },
    } as Record<string, unknown>;
    expect(validateDrillDefinition(def).valid).toBe(true);
  });
});

describe("root object", () => {
  const required = [
    "version",
    "court",
    "participants",
    "balls",
    "objects",
    "steps",
  ] as const;

  it("rejects a non-object", () => {
    expect(validateDrillDefinition("nope").valid).toBe(false);
    expect(validateDrillDefinition(42).valid).toBe(false);
    expect(validateDrillDefinition([]).valid).toBe(false);
  });

  for (const f of required) {
    it(`rejects a definition missing "${f}"`, () => {
      const def = minimal();
      delete def[f];
      expectKeyword(def, "required");
    });
  }

  it("rejects version other than the const 1", () => {
    expectKeyword({ ...minimal(), version: 2 }, "const");
    expectKeyword({ ...minimal(), version: "1" }, "const");
  });

  it("rejects extra root properties", () => {
    expectKeyword({ ...minimal(), extra_thing: true }, "additionalProperties");
  });
});

describe("court", () => {
  it("rejects court not an object", () => {
    expect(validateDrillDefinition({ ...minimal(), court: "x" }).valid).toBe(false);
  });

  it("rejects court missing grid", () => {
    expectKeyword({ ...minimal(), court: {} }, "required");
  });

  it("rejects grid missing columns/rows", () => {
    expectKeyword({ ...minimal(), court: { grid: { columns: 5 } } }, "required");
    expectKeyword({ ...minimal(), court: { grid: { rows: 4 } } }, "required");
  });

  it("rejects grid columns/rows below minimum 1", () => {
    expectKeyword({ ...minimal(), court: { grid: { columns: 0, rows: 4 } } }, "minimum");
    expectKeyword({ ...minimal(), court: { grid: { columns: 5, rows: 0 } } }, "minimum");
  });

  it("rejects grid columns/rows as non-integer", () => {
    expect(validateDrillDefinition({ ...minimal(), court: { grid: { columns: 1.5, rows: 4 } } }).valid).toBe(false);
    expect(validateDrillDefinition({ ...minimal(), court: { grid: { columns: "5", rows: 4 } } }).valid).toBe(false);
  });

  it("rejects extended_area missing enabled or with bad flags", () => {
    expectKeyword(
      { ...minimal(), court: { grid: { columns: 5, rows: 4 }, extended_area: { left: true } } },
      "required"
    );
    expect(validateDrillDefinition({
      ...minimal(),
      court: { grid: { columns: 5, rows: 4 }, extended_area: { enabled: "yes" } },
    }).valid).toBe(false);
  });

  it("rejects extra court properties", () => {
    expectKeyword(
      { ...minimal(), court: { grid: { columns: 5, rows: 4 }, color: "blue" } },
      "additionalProperties"
    );
  });
});

describe("view", () => {
  it("rejects an unknown orientation", () => {
    expectKeyword({ ...minimal(), view: { orientation: "sideways" } }, "enum");
  });

  it("rejects extra view properties", () => {
    expectKeyword({ ...minimal(), view: { orientation: "lateral", zoom: 2 } }, "additionalProperties");
  });
});

describe("participants", () => {
  it("rejects participants not an array", () => {
    expect(validateDrillDefinition({ ...minimal(), participants: "x" }).valid).toBe(false);
  });

  it("rejects participant missing id", () => {
    expectKeyword({ ...minimal(), participants: [{ type: "player" }] }, "required");
  });

  it("rejects participant with empty id", () => {
    expectKeyword({ ...minimal(), participants: [{ id: "", type: "player" }] }, "minLength");
  });

  it("rejects participant missing type", () => {
    expectKeyword({ ...minimal(), participants: [{ id: "p1" }] }, "required");
  });

  it("rejects participant with invalid type", () => {
    expectKeyword({ ...minimal(), participants: [{ id: "p1", type: "referee" }] }, "enum");
  });

  it("rejects participant with extra properties", () => {
    expectKeyword(
      { ...minimal(), participants: [{ id: "p1", type: "player", jersey: 10 }] },
      "additionalProperties"
    );
  });
});

describe("balls", () => {
  it("rejects balls not an array", () => {
    expect(validateDrillDefinition({ ...minimal(), balls: "x" }).valid).toBe(false);
  });

  it("rejects ball missing id / type", () => {
    expectKeyword({ ...minimal(), balls: [{ type: "volleyball" }] }, "required");
    expectKeyword({ ...minimal(), balls: [{ id: "b1" }] }, "required");
  });

  it("rejects ball with invalid type", () => {
    expectKeyword({ ...minimal(), balls: [{ id: "b1", type: "tennis" }] }, "enum");
  });

  it("rejects ball with extra properties", () => {
    expectKeyword(
      { ...minimal(), balls: [{ id: "b1", type: "volleyball", pressure: "high" }] },
      "additionalProperties"
    );
  });
});

describe("objects", () => {
  it("rejects objects not an array", () => {
    expect(validateDrillDefinition({ ...minimal(), objects: "x" }).valid).toBe(false);
  });

  it("rejects object missing id / type", () => {
    expectKeyword({ ...minimal(), objects: [{ type: "cone" }] }, "required");
    expectKeyword({ ...minimal(), objects: [{ id: "o1" }] }, "required");
  });

  it("rejects object with invalid type", () => {
    expectKeyword({ ...minimal(), objects: [{ id: "o1", type: "dumbbell" }] }, "enum");
  });

  it("rejects object with extra properties", () => {
    expectKeyword(
      { ...minimal(), objects: [{ id: "o1", type: "cone", color: "red" }] },
      "additionalProperties"
    );
  });
});

describe("steps", () => {
  it("rejects steps not an array", () => {
    expect(validateDrillDefinition({ ...minimal(), steps: "x" }).valid).toBe(false);
  });

  it("rejects empty steps (minItems: 1)", () => {
    expectKeyword({ ...minimal(), steps: [] }, "minItems");
  });

  const stepRequired = [
    "id",
    "participants",
    "balls",
    "objects",
    "actions",
    "participant_movements",
    "ball_movements",
    "object_movements",
  ] as const;

  for (const f of stepRequired) {
    it(`rejects step missing "${f}"`, () => {
      const def = minimal();
      const step = step0();
      delete step[f];
      def.steps = [step];
      expectKeyword(def, "required");
    });
  }

  it("rejects step with empty id", () => {
    expectKeyword(
      {
        ...minimal(),
        steps: [{ ...step0(), id: "" }],
      },
      "minLength"
    );
  });

  it("rejects step with extra properties", () => {
    expectKeyword(
      { ...minimal(), steps: [{ ...step0(), extra_meta: "x" }] },
      "additionalProperties"
    );
  });

  it("rejects step description as non-string", () => {
    expectKeyword({ ...minimal(), steps: [{ ...step0(), description: 123 }] }, "type");
  });
});

describe("entityState (in-step)", () => {
  function withParticipants(entity: Record<string, unknown>): Record<string, unknown> {
    return { ...minimal(), steps: [{ ...step0(), participants: [entity] }] };
  }

  it("rejects participant missing id", () => {
    expectKeyword(withParticipants({ active: true }), "required");
  });

  it("rejects participant missing active", () => {
    expectKeyword(withParticipants({ id: "p1" }), "required");
  });

  it("rejects participant active as non-boolean", () => {
    expectKeyword(withParticipants({ id: "p1", active: "yes" }), "type");
  });

  it("rejects participant with extra properties", () => {
    expectKeyword(
      withParticipants({ id: "p1", active: true, status: "ready" }),
      "additionalProperties"
    );
  });

  it("rejects location with invalid court", () => {
    expectKeyword(
      withParticipants({ id: "p1", active: true, location: { court: "court_3", x: 1, y: 1 } }),
      "enum"
    );
  });

  it("rejects location missing court/x/y", () => {
    expectKeyword(withParticipants({ id: "p1", active: true, location: { x: 1, y: 1 } }), "required");
    expectKeyword(withParticipants({ id: "p1", active: true, location: { court: "court_1", y: 1 } }), "required");
    expectKeyword(withParticipants({ id: "p1", active: true, location: { court: "court_1", x: 1 } }), "required");
  });

  it("rejects location with extra properties", () => {
    expectKeyword(
      withParticipants({ id: "p1", active: true, location: { court: "court_1", x: 1, y: 1, rotation: 90 } }),
      "additionalProperties"
    );
  });

  it("rejects location x/y as non-number", () => {
    expectKeyword(withParticipants({ id: "p1", active: true, location: { court: "court_1", x: "1", y: 1 } }), "type");
    expectKeyword(withParticipants({ id: "p1", active: true, location: { court: "court_1", x: 1, y: "1" } }), "type");
  });
});

describe("actionEvent", () => {
  function withActions(event: Record<string, unknown>): Record<string, unknown> {
    return { ...minimal(), steps: [{ ...step0(), actions: [event] }] };
  }

  it("rejects actionEvent missing participant_id", () => {
    expectKeyword(withActions({ action: { type: "serve" } }), "required");
  });

  it("rejects actionEvent with empty participant_id", () => {
    expectKeyword(withActions({ participant_id: "", action: { type: "serve" } }), "minLength");
  });

  it("rejects actionEvent missing action", () => {
    expectKeyword(withActions({ participant_id: "p1" }), "required");
  });

  it("rejects action missing type", () => {
    expectKeyword(withActions({ participant_id: "p1", action: {} }), "required");
  });

  it("rejects action with invalid type", () => {
    expectKeyword(withActions({ participant_id: "p1", action: { type: "unknown" } }), "enum");
  });

  it("rejects action description as non-string", () => {
    expectKeyword(
      withActions({ participant_id: "p1", action: { type: "serve", description: 123 } }),
      "type"
    );
  });

  it("rejects actionEvent with extra properties", () => {
    expectKeyword(
      withActions({ participant_id: "p1", action: { type: "serve" }, ts: 0 }),
      "additionalProperties"
    );
  });
});

describe("participant_movements", () => {
  function withMovements(m: Record<string, unknown>[]): Record<string, unknown> {
    return { ...minimal(), steps: [{ ...step0(), participant_movements: m }] };
  }

  it("rejects missing participant_id", () => {
    expectKeyword(withMovements([{ to: { court: "court_1", x: 1, y: 1 } }]), "required");
  });

  it("rejects missing to", () => {
    expectKeyword(withMovements([{ participant_id: "p1" }]), "required");
  });

  it("rejects from as non-location", () => {
    expectKeyword(
      withMovements([
        { participant_id: "p1", from: { bad: true }, to: { court: "court_1", x: 1, y: 1 } },
      ]),
      "required"
    );
  });

  it("rejects extra properties", () => {
    expectKeyword(
      withMovements([
        { participant_id: "p1", to: { court: "court_1", x: 1, y: 1 }, velocity: 5 },
      ]),
      "additionalProperties"
    );
  });
});

describe("ball_movements", () => {
  function withMovements(m: Record<string, unknown>[]): Record<string, unknown> {
    return { ...minimal(), steps: [{ ...step0(), ball_movements: m }] };
  }

  it("rejects missing ball_id", () => {
    expectKeyword(withMovements([{ to: { court: "court_1", x: 1, y: 1 } }]), "required");
  });

  it("rejects missing to", () => {
    expectKeyword(withMovements([{ ball_id: "ball1" }]), "required");
  });

  it("rejects extra properties", () => {
    expectKeyword(
      withMovements([
        { ball_id: "ball1", to: { court: "court_1", x: 1, y: 1 }, spin: 1000 },
      ]),
      "additionalProperties"
    );
  });
});

describe("object_movements", () => {
  function withMovements(m: Record<string, unknown>[]): Record<string, unknown> {
    return { ...minimal(), steps: [{ ...step0(), object_movements: m }] };
  }

  it("rejects missing object_id", () => {
    expectKeyword(withMovements([{ to: { court: "court_1", x: 1, y: 1 } }]), "required");
  });

  it("rejects missing to", () => {
    expectKeyword(withMovements([{ object_id: "cone1" }]), "required");
  });

  it("rejects extra properties", () => {
    expectKeyword(
      withMovements([
        { object_id: "cone1", to: { court: "court_1", x: 1, y: 1 }, force: 50 },
      ]),
      "additionalProperties"
    );
  });
});

describe("allErrors mode", () => {
  it("reports multiple independent issues in one pass", () => {
    const def = {
      version: "1",
      court: { grid: { columns: 0, rows: 0 } },
      participants: [{ id: "", type: "referee" }],
      balls: "not-array",
      objects: "not-array",
      steps: [],
      extra_thing: true,
    } as Record<string, unknown>;
    const r = validateDrillDefinition(def);
    expect(r.valid).toBe(false);
    expect(iss(r).length).toBeGreaterThanOrEqual(5);
  });
});

describe("error shape", () => {
  it("issues have instancePath, keyword, message", () => {
    const def = minimal();
    delete def.version;
    const r = validateDrillDefinition(def);
    expect(r.valid).toBe(false);
    for (const issue of iss(r)) {
      expect(issue).toHaveProperty("instancePath");
      expect(issue).toHaveProperty("keyword");
      expect(issue).toHaveProperty("message");
      expect(typeof issue.instancePath).toBe("string");
      expect(typeof issue.keyword).toBe("string");
      expect(typeof issue.message).toBe("string");
    }
  });

  it("returns empty issues on valid input", () => {
    const r = validateDrillDefinition(minimal());
    expect(r.valid).toBe(true);
    expect(iss(r)).toHaveLength(0);
  });
});

describe("robustness", () => {
  it("handles null, undefined, empty object without throwing", () => {
    expect(() => validateDrillDefinition(null)).not.toThrow();
    expect(() => validateDrillDefinition(undefined)).not.toThrow();
    expect(() => validateDrillDefinition({})).not.toThrow();
    expect(validateDrillDefinition(null).valid).toBe(false);
    expect(validateDrillDefinition(undefined).valid).toBe(false);
    expect(validateDrillDefinition({}).valid).toBe(false);
  });

  it("always returns a DrillSchemaValidation shape", () => {
    const r = validateDrillDefinition(minimal());
    expect(r).toHaveProperty("valid");
    expect(r).toHaveProperty("issues");
    expect(typeof r.valid).toBe("boolean");
    expect(Array.isArray(r.issues)).toBe(true);
  });

  it("does not mutate the input definition", () => {
    const def = minimal();
    const before = JSON.stringify(def);
    validateDrillDefinition(def);
    expect(JSON.stringify(def)).toBe(before);
  });
});

