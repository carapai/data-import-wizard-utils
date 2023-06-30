import { expect, test } from "vitest";
import { data } from "./dhis2";
import { Mapping } from "./interfaces";
import { outbreak } from "./outbreak";
import { convertToGoData, flattenGoData, makeMetadata } from "./program";

const organisationMapping: Mapping = {
    NREoMszwQZW: {
        value: "a4gTh6i5VdH",
    },
};

const attributeMapping: Mapping = {
    id: {
        value: "HAZ7VQ730yn",
    },
    gender: {
        value: "Rq4qM2wKYFL",
    },
    visualId: {
        value: "HAZ7VQ730yn",
    },
    "age.years": {
        value: "UezutfURtQG",
    },
    firstName: {
        value: "sB1IHYu2xQT",
    },
};

test("Make data", () => {
    const template = outbreak.caseInvestigationTemplate;
    const flattened = flattenGoData(template);
    console.log(flattened);
    expect(template.length).toBe(25);
});
