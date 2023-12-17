import { isEmpty, uniqBy } from "lodash";
import { getOr } from "lodash/fp";
import {
    AggDataValue,
    AggMetadata,
    IDataSet,
    IMapping,
    Mapping,
    Option,
} from "./interfaces";
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

export const makeAggMetadata = ({
    mapping,
    data,
    dataSet,
    dhis2DataSet,
    indicators,
    programIndicators,
}: Partial<{
    mapping: Partial<IMapping>;
    dataSet: Partial<IDataSet>;
    data: any[];
    dhis2DataSet: Partial<IDataSet>;
    indicators: Option[];
    programIndicators: Option[];
}>) => {
    const results: AggMetadata = {
        sourceOrgUnits: [],
        destinationOrgUnits: [],
        sourceColumns: [],
        sourceCategories: [],
        destinationColumns: [],
        destinationCategories: [],
        destinationCategoryOptionCombos: [],
        sourceCategoryOptionCombos: [],
    };
    if (programIndicators && programIndicators.length > 0) {
        results.sourceColumns = programIndicators;
    }
    if (indicators && indicators.length > 0) {
        results.sourceColumns = indicators;
    }
    if (!isEmpty(dataSet)) {
        results.destinationCategoryOptionCombos =
            dataSet.categoryCombo.categoryOptionCombos.flatMap(
                ({ id, name, code }) => {
                    if (name !== "default") {
                        return { id, value: id, label: name, code };
                    }
                    return [];
                }
            );
        results.destinationColumns = dataSet.dataSetElements.flatMap(
            ({ dataElement }) =>
                dataElement.categoryCombo.categoryOptionCombos.map((c) => {
                    if (c.name !== "default") {
                        return {
                            label: `${dataElement.name}:${c.name}`,
                            value: `${dataElement.id},${c.id}`,
                        };
                    } else {
                        return {
                            label: `${dataElement.name}`,
                            value: `${dataElement.id},${c.id}`,
                        };
                    }
                })
        );
        results.destinationOrgUnits = dataSet.organisationUnits.map(
            ({ id, name, code }) => ({ code, label: name, value: id, id })
        );

        results.destinationCategories =
            dataSet.categoryCombo.categories.flatMap(({ id, name, code }) => {
                if (name !== "default") {
                    return { id, value: id, label: name, code };
                }
                return [];
            });

        if (
            results.destinationCategoryOptionCombos.length > 0 &&
            ["dhis2-indicators", "dhis2-program-indicators"].indexOf(
                mapping.dataSource
            ) !== -1
        ) {
            let destinationColumns: Option[] = [];
            for (const destColumn of results.destinationColumns) {
                for (const destAttribution of results.destinationCategoryOptionCombos) {
                    destinationColumns = [
                        ...destinationColumns,
                        {
                            label: `${destColumn.label}:${destAttribution.label}`,
                            value: `${destColumn.value},${destAttribution.value}`,
                        },
                    ];
                }
            }
            results.destinationColumns = destinationColumns;
        }
    }

    if (!isEmpty(dhis2DataSet)) {
        results.sourceColumns = dataSet.dataSetElements.flatMap(
            ({ dataElement }) =>
                dataElement.categoryCombo.categoryOptionCombos.map((c) => ({
                    label: `${dataElement.name}:${c.name}`,
                    value: `${dataElement.id},${c.id}`,
                }))
        );
        results.sourceOrgUnits = dataSet.organisationUnits.map(
            ({ id, name, code }) => ({ code, label: name, value: id, id })
        );

        results.sourceCategories = dataSet.categoryCombo.categories.flatMap(
            ({ id, name, code }) => {
                if (name !== "default") {
                    return { id, value: id, label: name, code };
                }
                return [];
            }
        );

        results.sourceCategoryOptionCombos =
            dhis2DataSet.categoryCombo.categoryOptionCombos.map(
                ({ id, name, code }) => {
                    return { id, value: id, label: name, code };
                }
            );
    }

    if (data && data.length > 0) {
        results.sourceColumns = Object.keys(data[0]).map((d) => ({
            label: d,
            value: d,
        }));

        if (
            ["csv-line-list", "xlsx-line-list", "xlsx-tabular-data"].indexOf(
                mapping.dataSource
            ) !== -1
        ) {
            if (mapping.orgUnitColumn) {
                results.sourceOrgUnits = uniqBy(
                    data.slice(mapping.dataStartRow - 1).map((d) => {
                        const unit = getOr("", mapping.orgUnitColumn, d);
                        return { label: unit, value: unit };
                    }),
                    "value"
                );
            }

            if (mapping.aggregate.attributeOptionComboColumn) {
                results.sourceCategoryOptionCombos = uniqBy(
                    data.slice(mapping.dataStartRow - 1).map((d) => {
                        const unit = getOr(
                            "",
                            mapping.aggregate.attributeOptionComboColumn,
                            d
                        );
                        return { label: unit, value: unit };
                    }),
                    "value"
                );
            }
        }
    }

    if (mapping.isSource) {
        return {
            sourceColumns: results.destinationColumns,
            destinationColumns: results.sourceColumns,
            sourceOrgUnits: results.destinationOrgUnits,
            destinationOrgUnits: results.sourceOrgUnits,
            destinationCategories: results.sourceCategories,
            sourceCategories: results.destinationCategories,
            destinationCategoryOptionCombos: results.sourceCategoryOptionCombos,
            sourceCategoryOptionCombos: results.destinationCategoryOptionCombos,
        };
    }

    return results;
};

export const convertToAggregate = ({
    dataMapping,
    mapping,
    data,
    ouMapping,
    attributionMapping,
}: {
    mapping: Partial<IMapping>;
    ouMapping: Mapping;
    dataMapping: Mapping;
    attributionMapping: Mapping;
    data: any[];
}): Array<AggDataValue> => {
    if (
        mapping &&
        mapping.dataSource &&
        ["csv-line-list", "xlsx-line-list"].indexOf(mapping.dataSource) !== -1
    ) {
        return processLineList({
            data,
            mapping,
            attributionMapping,
            ouMapping,
        });
    } else if (mapping.dataSource === "dhis2-data-set") {
        return processDataSet({
            data,
            mapping,
            dataMapping,
            ouMapping,
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
            ouMapping,
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
            ouMapping,
            attributionMapping,
        });
    }
    return [];
};
