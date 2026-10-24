import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EventInformation from "./EventInformation";

describe("EventInformation", () => {
  it("ends after the live clock without exposing connection or snapshot diagnostics", () => {
    const markup = renderToStaticMarkup(<EventInformation />);

    expect(markup).not.toContain("snapshot");
    expect(markup).not.toContain("Published");
    expect(markup).not.toContain("connected");
    expect(markup).not.toContain("updates delayed");
    expect(markup.indexOf("Horizons</span><span>2026")).toBeLessThan(markup.indexOf("UJ Academy"));
    expect(markup.indexOf("UJ Academy")).toBeLessThan(markup.indexOf('event-information-date'));
    expect(markup.indexOf('event-information-date')).toBeLessThan(markup.indexOf('event-information-time'));
    expect(markup).toMatch(/<time>[^<]+<\/time><\/div><\/aside>$/);
  });
});
