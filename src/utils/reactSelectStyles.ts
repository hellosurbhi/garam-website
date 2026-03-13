import type { CSSObjectWithLabel, GroupBase, StylesConfig } from "react-select";

type BaseStyles = StylesConfig<{ value: string; label: string }, boolean, GroupBase<{ value: string; label: string }>>;

/** Compact pill-shaped selects for the admin filter bar. */
export const adminSelectStyles: BaseStyles = {
  control: (base: CSSObjectWithLabel) => ({
    ...base,
    borderRadius: "100px",
    border: "1px solid var(--border)",
    background: "#fff",
    fontFamily: "var(--font-dm-sans)",
    fontSize: "13px",
    minHeight: "34px",
    boxShadow: "none",
    cursor: "pointer",
    "&:hover": { borderColor: "var(--border)" },
  }),
  placeholder: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "var(--text-light)",
  }),
  option: (base: CSSObjectWithLabel) => ({
    ...base,
    fontFamily: "var(--font-dm-sans)",
    fontSize: "13px",
  }),
  multiValue: (base: CSSObjectWithLabel) => ({
    ...base,
    borderRadius: "100px",
    background: "var(--cream)",
  }),
  multiValueLabel: (base: CSSObjectWithLabel) => ({
    ...base,
    fontFamily: "var(--font-dm-sans)",
    fontSize: "12px",
    color: "var(--text)",
  }),
  menu: (base: CSSObjectWithLabel) => ({
    ...base,
    zIndex: 10,
  }),
};

/** Full-size form selects matching the Apply page design. */
export const formSelectStyles: BaseStyles = {
  control: (base: CSSObjectWithLabel, state) => ({
    ...base,
    borderRadius: "12px",
    border: `1px solid ${state.isFocused ? "#C9A84C" : "#E0D5C8"}`,
    boxShadow: state.isFocused ? "0 0 0 3px rgba(201, 168, 76, 0.1)" : "none",
    fontFamily: "var(--font-cormorant)",
    fontSize: "16px",
    background: "#fff",
    padding: "6px 4px",
    minHeight: "48px",
    cursor: "pointer",
    transition: "border-color 0.2s, box-shadow 0.2s",
    "&:hover": { borderColor: state.isFocused ? "#C9A84C" : "#d0c5b8" },
  }),
  option: (base: CSSObjectWithLabel, state) => ({
    ...base,
    fontFamily: "var(--font-cormorant)",
    fontSize: "16px",
    background: state.isSelected
      ? "rgba(201, 168, 76, 0.15)"
      : state.isFocused
        ? "rgba(201, 168, 76, 0.08)"
        : "transparent",
    color: "#3D3532",
    cursor: "pointer",
    "&:active": { background: "rgba(201, 168, 76, 0.2)" },
  }),
  placeholder: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "rgba(61, 53, 50, 0.35)",
  }),
  singleValue: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "#3D3532",
  }),
  menu: (base: CSSObjectWithLabel) => ({
    ...base,
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12)",
    overflow: "hidden",
    zIndex: 10,
  }),
  menuList: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "4px 0",
  }),
  input: (base: CSSObjectWithLabel) => ({
    ...base,
    fontFamily: "var(--font-cormorant)",
    fontSize: "16px",
    color: "#3D3532",
  }),
  indicatorSeparator: () => ({ display: "none" }) as CSSObjectWithLabel,
  dropdownIndicator: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "#7A6F66",
    "&:hover": { color: "#3D3532" },
  }),
};
