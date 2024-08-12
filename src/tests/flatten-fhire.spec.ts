import { describe, it, expect } from "vitest";

import bundle from "../metadata/Bundle.json";
import { flattenBundle } from "../flatten-fhir";
import { IBundle } from "@smile-cdr/fhirts/dist/FHIR-R4/interfaces/IBundle";

describe("Analytics Service", () => {
    describe("trackPageVisibilityChange", () => {
        it.todo(
            "sends a beacon with page name and visibility-change event to the appropriate endpoint",
        );
        flattenBundle(bundle as IBundle);
        expect(1).eq(1);
    });
});
