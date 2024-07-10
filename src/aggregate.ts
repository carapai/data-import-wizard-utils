import { AggDataValue, IMapping, Mapping } from "./interfaces";
import {
    processDataSet,
    processElements,
    processIndicators,
    processLineList,
} from "./utils";

const stepLabels: { [key: number]: string } = {
    0: "Next Step",
    1: "Next Step",
    2: "Next Step",
    3: "Next Step",
    4: "Next Step",
    5: "Next Step",
    6: "Next Step",
    7: "Import",
    8: "Finish",
};
export const aggLabel = (step: number, aggregateMapping: Partial<IMapping>) => {
    if (step === 9) return "Import";

    if (step === 10) return "Go To Mappings";

    return stepLabels[step];
};
export const convertToAggregate = ({
    dataMapping,
    mapping,
    data,
    organisationUnitMapping,
    attributionMapping,
}: {
    mapping: Partial<IMapping>;
    organisationUnitMapping: Mapping;
    dataMapping: Mapping;
    attributionMapping: Mapping;
    data: any[];
}): {
    validData: Array<AggDataValue>;
    invalidData: any[];
} => {
    if (
        mapping &&
        mapping.dataSource &&
        ["csv-line-list", "xlsx-line-list"].indexOf(mapping.dataSource) !== -1
    ) {
        return processLineList({
            data,
            mapping,
            organisationUnitMapping,
        });
    } else if (mapping.dataSource === "dhis2-data-set") {
        return processDataSet({
            data,
            mapping,
            dataMapping,
            organisationUnitMapping,
            attributionMapping,
        });
    } else if (
        mapping &&
        mapping.dataSource &&
        ["xlsx-tabular-data"].indexOf(mapping.dataSource) !== -1
    ) {
        return processElements({
            data,
            mapping,
            dataMapping,
            organisationUnitMapping,
            attributionMapping,
        });
    } else if (
        mapping &&
        mapping.dataSource &&
        ["dhis2-program-indicators", "dhis2-indicators"].indexOf(
            mapping.dataSource
        ) !== -1
    ) {
        return processIndicators({
            data,
            mapping,
            dataMapping,
            organisationUnitMapping,
            attributionMapping,
        });
    }
    return { validData: [], invalidData: [] };
};
