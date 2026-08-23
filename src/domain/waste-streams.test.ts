import { describe, expect, it } from "vitest";
import { wasteStreams, wasteStreamForItem } from "./waste-streams";

describe("2026 four-stream guidance", () => {
  it("publishes exactly the four required source-segregation streams", () => {
    expect(wasteStreams.map((stream) => stream.id)).toEqual(["wet", "dry", "sanitary", "special_care"]);
    expect(wasteStreams.every((stream) => stream.examples.en.length >= 3)).toBe(true);
    expect(wasteStreams.every((stream) => Boolean(stream.exceptions.en))).toBe(true);
  });

  it.each([
    ["vegetable peels", "wet"],
    ["cardboard box", "dry"],
    ["used diaper", "sanitary"],
    ["battery", "special_care"],
  ] as const)("classifies %s as %s", (item, expected) => {
    expect(wasteStreamForItem(item)?.id).toBe(expected);
  });

  it("does not guess when an item is unknown", () => {
    expect(wasteStreamForItem("mystery composite object")).toBeUndefined();
  });
});
