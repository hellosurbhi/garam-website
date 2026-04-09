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

  it("option returns selected background", () => {
    const result = adminSelectStyles.option!(BASE, {
      isSelected: true,
      isFocused: false,
    } as never);
    expect(result.background).toBe("rgba(0, 0, 0, 0.06)");
  });

  it("option returns focused background", () => {
    const result = adminSelectStyles.option!(BASE, {
      isSelected: false,
      isFocused: true,
    } as never);
    expect(result.background).toBe("rgba(0, 0, 0, 0.03)");
  });

  it("option returns transparent background by default", () => {
    const result = adminSelectStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.background).toBe("transparent");
  });

  it("placeholder returns correct color", () => {
    const result = adminSelectStyles.placeholder!(BASE, {} as never);
    expect(result.color).toBe("var(--text-light)");
  });

  it("control returns correct border", () => {
    const result = adminSelectStyles.control!(BASE, {} as never);
    expect(result.border).toBe("1px solid var(--border)");
  });

  it("control returns white background", () => {
    const result = adminSelectStyles.control!(BASE, {} as never);
    expect(result.background).toBe("#fff");
  });

  it("multiValue returns pill shape", () => {
    const result = adminSelectStyles.multiValue!(BASE, {} as never);
    expect(result.borderRadius).toBe("100px");
  });

  it("multiValueLabel returns 12px font", () => {
    const result = adminSelectStyles.multiValueLabel!(BASE, {} as never);
    expect(result.fontSize).toBe("12px");
  });

  it("option returns cursor pointer", () => {
    const result = adminSelectStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.cursor).toBe("pointer");
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

  it("option returns selected background", () => {
    const result = formSelectStyles.option!(BASE, {
      isSelected: true,
      isFocused: false,
    } as never);
    expect(result.background).toBe("rgba(220, 38, 38, 0.15)");
  });

  it("option returns focused background", () => {
    const result = formSelectStyles.option!(BASE, {
      isSelected: false,
      isFocused: true,
    } as never);
    expect(result.background).toBe("rgba(220, 38, 38, 0.08)");
  });

  it("option returns transparent background by default", () => {
    const result = formSelectStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.background).toBe("transparent");
  });

  it("option returns charcoal color", () => {
    const result = formSelectStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.color).toBe("var(--charcoal)");
  });

  it("placeholder returns correct color", () => {
    const result = formSelectStyles.placeholder!(BASE, {} as never);
    expect(result.color).toBe("rgba(61, 53, 50, 0.35)");
  });

  it("singleValue returns charcoal color", () => {
    const result = formSelectStyles.singleValue!(BASE, {} as never);
    expect(result.color).toBe("var(--charcoal)");
  });

  it("menuList returns correct padding", () => {
    const result = formSelectStyles.menuList!(BASE, {} as never);
    expect(result.padding).toBe("4px 0");
  });

  it("input returns 16px fontSize", () => {
    const result = formSelectStyles.input!(BASE, {} as never);
    expect(result.fontSize).toBe("16px");
  });

  it("input returns charcoal color", () => {
    const result = formSelectStyles.input!(BASE, {} as never);
    expect(result.color).toBe("var(--charcoal)");
  });

  it("dropdownIndicator returns correct default color", () => {
    const result = formSelectStyles.dropdownIndicator!(BASE, {} as never);
    expect(result.color).toBe("rgba(0, 0, 0, 0.3)");
  });

  it("control boxShadow when focused", () => {
    const result = formSelectStyles.control!(BASE, {
      isFocused: true,
    } as never);
    expect(result.boxShadow).toBe("0 0 0 3px rgba(220, 38, 38, 0.1)");
  });

  it("control boxShadow when not focused", () => {
    const result = formSelectStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.boxShadow).toBe("none");
  });

  it("menu has overflow hidden", () => {
    const result = formSelectStyles.menu!(BASE, {} as never);
    expect(result.overflow).toBe("hidden");
  });

  it("menu has zIndex 10", () => {
    const result = formSelectStyles.menu!(BASE, {} as never);
    expect(result.zIndex).toBe(10);
  });

  it("control has correct padding", () => {
    const result = formSelectStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.padding).toBe("6px 4px");
  });

  it("control has cursor pointer", () => {
    const result = formSelectStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.cursor).toBe("pointer");
  });
});
