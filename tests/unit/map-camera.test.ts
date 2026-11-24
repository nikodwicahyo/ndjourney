import { describe, it, expect } from "vitest";
import { nextCameraAction } from "@/lib/map-panes";

const decide = (
  owner: "auto" | "self" | "user",
  pinCount: number,
  fitted: boolean,
  inView: boolean,
) => nextCameraAction({ owner, pinCount, fitted, inView });

describe("map camera policy", () => {
  it("never moves the map once the user owns the camera", () => {
    expect(decide("user", 2, true, false)).toBe("none");
    expect(decide("user", 2, false, false)).toBe("none");
    expect(decide("user", 0, false, false)).toBe("none");
  });

  it("keeps following me after 'Pusatkan ke saya' instead of refitting both", () => {
    // Regression: the next presence fix used to snap back to the two pins.
    expect(decide("self", 2, true, false)).toBe("follow-pin");
    expect(decide("self", 2, true, true)).toBe("none");
    expect(decide("self", 0, false, false)).toBe("none");
  });

  it("frames both pins once, then only when one leaves the viewport", () => {
    expect(decide("auto", 2, false, false)).toBe("fit-pins");
    expect(decide("auto", 2, true, false)).toBe("fit-pins");
    expect(decide("auto", 2, true, true)).toBe("none");
  });

  it("pans to a lone pin instead of re-zooming it", () => {
    expect(decide("auto", 1, true, false)).toBe("follow-pin");
    expect(decide("auto", 1, true, true)).toBe("none");
  });

  it("falls back to the default view only while nothing is framed", () => {
    expect(decide("auto", 0, false, true)).toBe("default");
    expect(decide("auto", 0, true, true)).toBe("none");
  });
});
