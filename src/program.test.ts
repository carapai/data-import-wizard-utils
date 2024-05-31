import { assert, expect, test } from "vitest";
import { z } from "zod";
// import { data } from "./dhis2";
import { IProgramMapping, Mapping } from "./interfaces";
import { outbreak } from "./outbreak";
import { convertToGoData, flattenGoData } from "./program";
import { makeMetadata } from "./metadata";

import data from "./metadata/data.json";
import attributeMapping from "./metadata/attributeMapping.json";
import organisationMapping from "./metadata/ouMapping.json";
import godata from "./metadata/godata.json";
import programMapping from "./metadata/programMapping.json";
import validation from "./metadata/validation.json";
import categories from "./metadata/reference-data.json";
import { set } from "lodash/fp";
import { updateObject, validateValue } from "./utils";
import { groupBy } from "lodash";

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
    // const response = convertToGoData(
    //     data,
    //     organisationMapping,
    //     attributeMapping,
    //     godata
    // );
    // console.log(response);
    expect(1).toBe(1);
});

test("Change Attribute", () => {
    const mapping: Mapping = {};

    // const obj = set<Mapping>("address[0].typeId", { value: "X" }, mapping);

    const obj = updateObject(mapping, {
        attribute: "address[0].typeId",
        value: "X",
        key: "value",
    });

    const obj2 = updateObject(obj, {
        attribute: "address[0].typeId",
        value: true,
        key: "isSpecific",
    });
    console.log(obj2);
    expect(1).toBe(1);
});

test("Process categories", () => {
    // const validated = validateValue(validation);
    expect(1).toBe(1);
});
