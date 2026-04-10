import { describe, it, expect } from "vitest";
import type { CSSObjectWithLabel } from "react-select";
import { adminSelectStyles, formSelectStyles } from "./reactSelectStyles";

const BASE: CSSObjectWithLabel = {} as CSSObjectWithLabel;
const BASE_WITH_EXTRA: CSSObjectWithLabel = {
  color: "red",
  margin: "10px",
} as CSSObjectWithLabel;
const adminStyles = adminSelectStyles<{ value: string; label: string }>();
const formStyles = formSelectStyles<{ value: string; label: string }>();

describe("adminSelectStyles", () => {
  it("has a control style function", () => {
    expect(typeof adminStyles.control).toBe("function");
  });

  it("control returns fontSize 13px", () => {
    const result = adminStyles.control!(BASE, {} as never);
    expect(result.fontSize).toBe("13px");
  });

  it("control returns minHeight 34px", () => {
    const result = adminStyles.control!(BASE, {} as never);
    expect(result.minHeight).toBe("34px");
  });

  it("control returns borderRadius 100px (pill shape)", () => {
    const result = adminStyles.control!(BASE, {} as never);
    expect(result.borderRadius).toBe("100px");
  });

  it("has placeholder, option, multiValue, multiValueLabel, and menu style functions", () => {
    expect(typeof adminStyles.placeholder).toBe("function");
    expect(typeof adminStyles.option).toBe("function");
    expect(typeof adminStyles.multiValue).toBe("function");
    expect(typeof adminStyles.multiValueLabel).toBe("function");
    expect(typeof adminStyles.menu).toBe("function");
  });

  it("menu returns zIndex 10", () => {
    const result = adminStyles.menu!(BASE, {} as never);
    expect(result.zIndex).toBe(10);
  });

  it("option returns selected background", () => {
    const result = adminStyles.option!(BASE, {
      isSelected: true,
      isFocused: false,
    } as never);
    expect(result.background).toBe("rgba(0, 0, 0, 0.06)");
  });

  it("option returns focused background", () => {
    const result = adminStyles.option!(BASE, {
      isSelected: false,
      isFocused: true,
    } as never);
    expect(result.background).toBe("rgba(0, 0, 0, 0.03)");
  });

  it("option returns transparent background by default", () => {
    const result = adminStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.background).toBe("transparent");
  });

  it("placeholder returns correct color", () => {
    const result = adminStyles.placeholder!(BASE, {} as never);
    expect(result.color).toBe("var(--text-light)");
  });

  it("control returns correct border", () => {
    const result = adminStyles.control!(BASE, {} as never);
    expect(result.border).toBe("1px solid var(--border)");
  });

  it("control returns white background", () => {
    const result = adminStyles.control!(BASE, {} as never);
    expect(result.background).toBe("#fff");
  });

  it("multiValue returns pill shape", () => {
    const result = adminStyles.multiValue!(BASE, {} as never);
    expect(result.borderRadius).toBe("100px");
  });

  it("multiValueLabel returns 12px font", () => {
    const result = adminStyles.multiValueLabel!(BASE, {} as never);
    expect(result.fontSize).toBe("12px");
  });

  it("option returns cursor pointer", () => {
    const result = adminStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.cursor).toBe("pointer");
  });

  it("option isSelected takes precedence over isFocused", () => {
    const result = adminStyles.option!(BASE, {
      isSelected: true,
      isFocused: true,
    } as never);
    expect(result.background).toBe("rgba(0, 0, 0, 0.06)");
  });

  it("control has boxShadow none", () => {
    const result = adminStyles.control!(BASE, {} as never);
    expect(result.boxShadow).toBe("none");
  });

  it("control has cursor pointer", () => {
    const result = adminStyles.control!(BASE, {} as never);
    expect(result.cursor).toBe("pointer");
  });

  it("control preserves base properties via spread", () => {
    const result = adminStyles.control!(BASE_WITH_EXTRA, {} as never);
    expect(result.color).toBe("red");
    expect(result.margin).toBe("10px");
  });

  it("control &:hover borderColor is var(--border)", () => {
    const result = adminStyles.control!(BASE, {} as never);
    const hover = result["&:hover"] as Record<string, string>;
    expect(hover.borderColor).toBe("var(--border)");
  });

  it("control fontFamily is var(--font-body)", () => {
    const result = adminStyles.control!(BASE, {} as never);
    expect(result.fontFamily).toBe("var(--font-body)");
  });

  it("option fontFamily is var(--font-body)", () => {
    const result = adminStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.fontFamily).toBe("var(--font-body)");
  });

  it("option fontSize is 13px", () => {
    const result = adminStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.fontSize).toBe("13px");
  });

  it("option color is var(--text)", () => {
    const result = adminStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.color).toBe("var(--text)");
  });

  it("multiValue background is var(--cream)", () => {
    const result = adminStyles.multiValue!(BASE, {} as never);
    expect(result.background).toBe("var(--cream)");
  });

  it("multiValueLabel fontFamily is var(--font-body)", () => {
    const result = adminStyles.multiValueLabel!(BASE, {} as never);
    expect(result.fontFamily).toBe("var(--font-body)");
  });

  it("multiValueLabel color is var(--text)", () => {
    const result = adminStyles.multiValueLabel!(BASE, {} as never);
    expect(result.color).toBe("var(--text)");
  });

  it("placeholder preserves base via spread", () => {
    const result = adminStyles.placeholder!(BASE_WITH_EXTRA, {} as never);
    expect(result.margin).toBe("10px");
  });

  it("option preserves base via spread", () => {
    const result = adminStyles.option!(BASE_WITH_EXTRA, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.margin).toBe("10px");
  });

  it("multiValue preserves base via spread", () => {
    const result = adminStyles.multiValue!(BASE_WITH_EXTRA, {} as never);
    expect(result.margin).toBe("10px");
  });

  it("multiValueLabel preserves base via spread", () => {
    const result = adminStyles.multiValueLabel!(
      BASE_WITH_EXTRA,
      {} as never,
    );
    expect(result.margin).toBe("10px");
  });

  it("menu preserves base via spread", () => {
    const result = adminStyles.menu!(BASE_WITH_EXTRA, {} as never);
    expect(result.margin).toBe("10px");
  });
});

describe("formSelectStyles", () => {
  it("has a control style function", () => {
    expect(typeof formStyles.control).toBe("function");
  });

  it("control returns fontSize 16px", () => {
    const result = formStyles.control!(BASE, { isFocused: false } as never);
    expect(result.fontSize).toBe("16px");
  });

  it("control returns minHeight 48px", () => {
    const result = formStyles.control!(BASE, { isFocused: false } as never);
    expect(result.minHeight).toBe("48px");
  });

  it("control uses brand-red border when focused", () => {
    const result = formStyles.control!(BASE, { isFocused: true } as never);
    expect(result.border).toContain("#DC2626");
  });

  it("control uses neutral border when not focused", () => {
    const result = formStyles.control!(BASE, { isFocused: false } as never);
    expect(result.border).toContain("rgba(0, 0, 0, 0.1)");
  });

  it("indicatorSeparator returns display none", () => {
    const result = formStyles.indicatorSeparator!(BASE, {} as never);
    expect(result.display).toBe("none");
  });

  it("has option, placeholder, singleValue, menu, menuList, input, and dropdownIndicator functions", () => {
    expect(typeof formStyles.option).toBe("function");
    expect(typeof formStyles.placeholder).toBe("function");
    expect(typeof formStyles.singleValue).toBe("function");
    expect(typeof formStyles.menu).toBe("function");
    expect(typeof formStyles.menuList).toBe("function");
    expect(typeof formStyles.input).toBe("function");
    expect(typeof formStyles.dropdownIndicator).toBe("function");
  });

  it("menu returns borderRadius 12px", () => {
    const result = formStyles.menu!(BASE, {} as never);
    expect(result.borderRadius).toBe("12px");
  });

  it("option returns selected background", () => {
    const result = formStyles.option!(BASE, {
      isSelected: true,
      isFocused: false,
    } as never);
    expect(result.background).toBe("rgba(220, 38, 38, 0.15)");
  });

  it("option returns focused background", () => {
    const result = formStyles.option!(BASE, {
      isSelected: false,
      isFocused: true,
    } as never);
    expect(result.background).toBe("rgba(220, 38, 38, 0.08)");
  });

  it("option returns transparent background by default", () => {
    const result = formStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.background).toBe("transparent");
  });

  it("option returns charcoal color", () => {
    const result = formStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.color).toBe("var(--charcoal)");
  });

  it("placeholder returns correct color", () => {
    const result = formStyles.placeholder!(BASE, {} as never);
    expect(result.color).toBe("rgba(61, 53, 50, 0.35)");
  });

  it("singleValue returns charcoal color", () => {
    const result = formStyles.singleValue!(BASE, {} as never);
    expect(result.color).toBe("var(--charcoal)");
  });

  it("menuList returns correct padding", () => {
    const result = formStyles.menuList!(BASE, {} as never);
    expect(result.padding).toBe("4px 0");
  });

  it("input returns 16px fontSize", () => {
    const result = formStyles.input!(BASE, {} as never);
    expect(result.fontSize).toBe("16px");
  });

  it("input returns charcoal color", () => {
    const result = formStyles.input!(BASE, {} as never);
    expect(result.color).toBe("var(--charcoal)");
  });

  it("dropdownIndicator returns correct default color", () => {
    const result = formStyles.dropdownIndicator!(BASE, {} as never);
    expect(result.color).toBe("rgba(0, 0, 0, 0.3)");
  });

  it("control boxShadow when focused", () => {
    const result = formStyles.control!(BASE, {
      isFocused: true,
    } as never);
    expect(result.boxShadow).toBe("0 0 0 3px rgba(220, 38, 38, 0.1)");
  });

  it("control boxShadow when not focused", () => {
    const result = formStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.boxShadow).toBe("none");
  });

  it("menu has overflow hidden", () => {
    const result = formStyles.menu!(BASE, {} as never);
    expect(result.overflow).toBe("hidden");
  });

  it("menu has zIndex 10", () => {
    const result = formStyles.menu!(BASE, {} as never);
    expect(result.zIndex).toBe(10);
  });

  it("control has correct padding", () => {
    const result = formStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.padding).toBe("6px 4px");
  });

  it("control has cursor pointer", () => {
    const result = formStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.cursor).toBe("pointer");
  });

  it("option isSelected takes precedence over isFocused", () => {
    const result = formStyles.option!(BASE, {
      isSelected: true,
      isFocused: true,
    } as never);
    expect(result.background).toBe("rgba(220, 38, 38, 0.15)");
  });

  it("control borderRadius is 12px", () => {
    const result = formStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.borderRadius).toBe("12px");
  });

  it("control has transition property", () => {
    const result = formStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.transition).toBe("border-color 0.2s, box-shadow 0.2s");
  });

  it("control preserves base properties via spread", () => {
    const result = formStyles.control!(BASE_WITH_EXTRA, {
      isFocused: false,
    } as never);
    expect(result.margin).toBe("10px");
  });

  it("control &:hover borderColor when focused is #DC2626", () => {
    const result = formStyles.control!(BASE, {
      isFocused: true,
    } as never);
    const hover = result["&:hover"] as Record<string, string>;
    expect(hover.borderColor).toBe("#DC2626");
  });

  it("control &:hover borderColor when not focused is rgba(0, 0, 0, 0.15)", () => {
    const result = formStyles.control!(BASE, {
      isFocused: false,
    } as never);
    const hover = result["&:hover"] as Record<string, string>;
    expect(hover.borderColor).toBe("rgba(0, 0, 0, 0.15)");
  });

  it("control background is #fff", () => {
    const result = formStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.background).toBe("#fff");
  });

  it("control fontFamily is var(--font-body)", () => {
    const result = formStyles.control!(BASE, {
      isFocused: false,
    } as never);
    expect(result.fontFamily).toBe("var(--font-body)");
  });

  it("option &:active background is rgba(220, 38, 38, 0.2)", () => {
    const result = formStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    const active = result["&:active"] as Record<string, string>;
    expect(active.background).toBe("rgba(220, 38, 38, 0.2)");
  });

  it("option fontFamily is var(--font-body)", () => {
    const result = formStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.fontFamily).toBe("var(--font-body)");
  });

  it("option fontSize is 16px", () => {
    const result = formStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.fontSize).toBe("16px");
  });

  it("option cursor is pointer", () => {
    const result = formStyles.option!(BASE, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.cursor).toBe("pointer");
  });

  it("menu background is #fff", () => {
    const result = formStyles.menu!(BASE, {} as never);
    expect(result.background).toBe("#fff");
  });

  it("menu boxShadow is '0 4px 20px rgba(0, 0, 0, 0.12)'", () => {
    const result = formStyles.menu!(BASE, {} as never);
    expect(result.boxShadow).toBe("0 4px 20px rgba(0, 0, 0, 0.12)");
  });

  it("input fontFamily is var(--font-body)", () => {
    const result = formStyles.input!(BASE, {} as never);
    expect(result.fontFamily).toBe("var(--font-body)");
  });

  it("dropdownIndicator &:hover color is var(--charcoal)", () => {
    const result = formStyles.dropdownIndicator!(BASE, {} as never);
    const hover = result["&:hover"] as Record<string, string>;
    expect(hover.color).toBe("var(--charcoal)");
  });

  it("dropdownIndicator preserves base via spread", () => {
    const result = formStyles.dropdownIndicator!(
      BASE_WITH_EXTRA,
      {} as never,
    );
    expect(result.margin).toBe("10px");
  });

  it("option preserves base via spread", () => {
    const result = formStyles.option!(BASE_WITH_EXTRA, {
      isSelected: false,
      isFocused: false,
    } as never);
    expect(result.margin).toBe("10px");
  });

  it("singleValue preserves base via spread", () => {
    const result = formStyles.singleValue!(BASE_WITH_EXTRA, {} as never);
    expect(result.margin).toBe("10px");
  });

  it("menu preserves base via spread", () => {
    const result = formStyles.menu!(BASE_WITH_EXTRA, {} as never);
    expect(result.margin).toBe("10px");
  });

  it("menuList preserves base via spread", () => {
    const result = formStyles.menuList!(BASE_WITH_EXTRA, {} as never);
    expect(result.margin).toBe("10px");
  });

  it("input preserves base via spread", () => {
    const result = formStyles.input!(BASE_WITH_EXTRA, {} as never);
    expect(result.margin).toBe("10px");
  });

  it("placeholder preserves base via spread", () => {
    const result = formStyles.placeholder!(BASE_WITH_EXTRA, {} as never);
    expect(result.margin).toBe("10px");
  });
});
