import { expect, test } from "vitest";
import { data } from "./dhis2";
import { Mapping } from "./interfaces";
import { outbreak } from "./outbreak";
import { convertToGoData } from "./program";

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

test("Math.sqrt()", () => {
    const finalData = convertToGoData(
        data,
        organisationMapping,
        attributeMapping,
        outbreak
    );
    console.log(finalData[0]);
    expect(finalData.length).toBe(2);
});
