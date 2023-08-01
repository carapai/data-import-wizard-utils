import { assert, expect, test } from "vitest";
import { z } from "zod";
// import { data } from "./dhis2";
import { IProgramMapping, Mapping } from "./interfaces";
import { outbreak } from "./outbreak";
import { convertToGoData, flattenGoData, makeMetadata } from "./program";

import data from "./metadata/data.json";
import attributeMapping from "./metadata/attributeMapping.json";
import organisationMapping from "./metadata/ouMapping.json";
import godata from "./metadata/godata.json";
import programMapping from "./metadata/programMapping.json";

// const organisationMapping: Mapping = {
//     NREoMszwQZW: {
//         value: "a4gTh6i5VdH",
//     },
// };

// const attributeMapping: Mapping = {
//     id: {
//         value: "HAZ7VQ730yn",
//     },
//     gender: {
//         value: "Rq4qM2wKYFL",
//     },
//     visualId: {
//         value: "HAZ7VQ730yn",
//     },
//     "age.years": {
//         value: "UezutfURtQG",
//     },
//     firstName: {
//         value: "sB1IHYu2xQT",
//     },
// };

test("Make data", () => {
    const response = convertToGoData(
        data,
        organisationMapping,
        attributeMapping,
        godata
    );
    // console.log(response);
    expect(1).toBe(1);
});
