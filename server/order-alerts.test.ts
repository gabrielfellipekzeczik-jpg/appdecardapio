import { describe, expect, it } from "vitest";
import { findNewOrderIds } from "../shared/order-alerts";

describe("findNewOrderIds", () => {
  it("detects a new id when the paginated queue remains at its limit", () => {
    const previous = Array.from({ length: 20 }, (_, index) => index + 1);
    const current = Array.from({ length: 19 }, (_, index) => index + 2).concat(21);
    expect(findNewOrderIds(previous, current)).toEqual([21]);
  });

  it("does not alert on the initial snapshot", () => {
    expect(findNewOrderIds([], [10, 9])).toEqual([10, 9]);
  });
});
