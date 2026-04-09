import { describe, it, expect } from "vitest";
import type { CSSObjectWithLabel } from "react-select";
import { adminSelectStyles, formSelectStyles } from "./reactSelectStyles";

const BASE: CSSObjectWithLabel = {} as CSSObjectWithLabel;

describe("adminSelectStyles", () => {
  it("has a control style function", () => {
    expect(typeof adminSelectStyles.control).toBe("function");
  });

  it("control returns fontSize 13px", () => {
    const result = adminSelectStyles.control!(BASE, {} as never);
    expect(result.fontSize).toBe("13px");
  });

  it("control returns minHeight 34px", () => {
    const result = adminSelectStyles.control!(BASE, {} as never);
    expect(result.minHeight).toBe("34px");
  });

  it("control returns borderRadius 100px (pill shape)", () => {
    const result = adminSelectStyles.control!(BASE, {} as never);
    expect(result.borderRadius).toBe("100px");
  });

  it("has placeholder, option, multiValue, multiValueLabel, and menu style functions", () => {
    expect(typeof adminSelectStyles.placeholder).toBe("function");
    expect(typeof adminSelectStyles.option).toBe("function");
    expect(typeof adminSelectStyles.multiValue).toBe("function");
    expect(typeof adminSelectStyles.multiValueLabel).toBe("function");
    expect(typeof adminSelectStyles.menu).toBe("function");
  });

  it("menu returns zIndex 10", () => {
    const result = adminSelectStyles.menu!(BASE, {} as never);
    expect(result.zIndex).toBe(10);
  });
});

describe("formSelectStyles", () => {
  it("has a control style function", () => {
    expect(typeof formSelectStyles.control).toBe("function");
  });

  it("control returns fontSize 16px", () => {
    const result = formSelectStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.fontSize).toBe("16px");
  });

  it("control returns minHeight 48px", () => {
    const result = formSelectStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.minHeight).toBe("48px");
  });

  it("control uses brand-red border when focused", () => {
    const result = formSelectStyles.control!(BASE, {
      isFocused: true,
    } as never);
    expect(result.border).toContain("#DC2626");
  });

  it("control uses neutral border when not focused", () => {
    const result = formSelectStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.border).toContain("rgba(0, 0, 0, 0.1)");
  });

  it("indicatorSeparator returns display none", () => {
    const result = formSelectStyles.indicatorSeparator!(BASE, {} as never);
    expect(result.display).toBe("none");
  });

  it("has option, placeholder, singleValue, menu, menuList, input, and dropdownIndicator functions", () => {
    expect(typeof formSelectStyles.option).toBe("function");
    expect(typeof formSelectStyles.placeholder).toBe("function");
    expect(typeof formSelectStyles.singleValue).toBe("function");
    expect(typeof formSelectStyles.menu).toBe("function");
    expect(typeof formSelectStyles.menuList).toBe("function");
    expect(typeof formSelectStyles.input).toBe("function");
    expect(typeof formSelectStyles.dropdownIndicator).toBe("function");
  });

  it("menu returns borderRadius 12px", () => {
    const result = formSelectStyles.menu!(BASE, {} as never);
    expect(result.borderRadius).toBe("12px");
  });
});
