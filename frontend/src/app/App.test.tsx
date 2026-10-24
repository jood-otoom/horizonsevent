import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("application routes", () => {
  it("keeps the public dashboard at /", () => {
    const markup = renderToStaticMarkup(<App pathname="/" />);
    expect(markup).toContain("New Horizons event progress");
    expect(markup).toContain("Demo values");
  });

  it("shows the staff controller at /controller", () => {
    const markup = renderToStaticMarkup(<App pathname="/controller" />);
    expect(markup).toContain("Staff Controller");
    expect(markup).toContain("Loading demo statistics");
    expect(markup).not.toContain("New Horizons event progress");
  });

  it("shows the startup map route without changing the dashboard routes", () => {
    const markup = renderToStaticMarkup(<App pathname="/map" />);
    expect(markup).toContain("JORDAN");
    expect(markup).toContain("Loading published startup statistics");
    expect(markup).not.toContain("Demo values");
  });

  it("shows a clear fallback for an unknown route", () => {
    const markup = renderToStaticMarkup(<App pathname="/unknown" />);
    expect(markup).toContain("Page not found");
    expect(markup).toContain('href="/"');
  });
});
