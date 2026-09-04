export const colors = {
  surface: "#F6F4EF",
  onSurface: "#1B2028",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#6B7280",
  surfaceTertiary: "#EDEAE2",
  onSurfaceTertiary: "#3F4650",
  surfaceInverse: "#1B2028",
  onSurfaceInverse: "#F5F3EE",
  brand: "#C98A2C",
  onBrand: "#1B2028",
  brandSecondary: "#A8721F",
  brandTertiary: "rgba(201, 138, 44, 0.14)",
  onBrandTertiary: "#8F6018",
  success: "#2F8F5B",
  warning: "#B8790A",
  error: "#D8353D",
  info: "#2F6FE0",
  border: "#E2DED4",
  borderStrong: "#CFC9BC",
  // Overlays sit on top of photos/modals, not the page background, so they
  // stay dark regardless of light/dark theme (keeps text legible on images).
  scrim: "rgba(27, 32, 40, 0.75)",
  overlay: "rgba(15, 17, 20, 0.6)",
  // Text/icons drawn directly on top of the scrim (no background pill of
  // their own) need a fixed light color so they stay legible either theme.
  onScrim: "#F5F3EE",
  onScrimSecondary: "rgba(245, 243, 238, 0.75)",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

export const fonts = {
  display: "Rajdhani-Bold",
  displaySemi: "Rajdhani-SemiBold",
  displayMed: "Rajdhani-Medium",
  body: "Manrope",
};

export const font = {
  regular: { fontFamily: "Manrope", fontWeight: "400" as const },
  medium: { fontFamily: "Manrope", fontWeight: "600" as const },
  bold: { fontFamily: "Manrope", fontWeight: "700" as const },
};

export const type = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  huge: 34,
};
