import { vi } from "vitest";

// Demo component fixtures must not inherit a developer's live .env.local file.
vi.stubEnv("VITE_DATA_MODE", "demo");
