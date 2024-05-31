import { Dictionary, isEmpty } from "lodash";
import { getOr, uniqBy } from "lodash/fp";
import {
    GO_DATA_PERSON_FIELDS,
    GO_DATA_EPIDEMIOLOGY_FIELDS,
    GO_DATA_EVENTS_FIELDS,
    GO_DATA_LAB_FIELDS,
    GO_DATA_RELATIONSHIP_FIELDS,
} from "./constants";
import {
    IProgram,
    IMapping,
    StageMapping,
    Mapping,
    IGoData,
    GODataOption,
    Option,
    DHIS2OrgUnit,
    IDataSet,
    Metadata,
} from "./interfaces";
import {
    findTrackedEntityInstanceIds,
    flattenProgram,
    flattenGoData,
    getAttributes,
    findUniqAttributes,
} from "./program";

const getParentName = (parent: Partial<DHIS2OrgUnit>) => {
    let first = parent;
    let allNames: string[] = [];
    while (first && first.name) {
        allNames = [...allNames, first.name];
        first = first.parent;
    }
    return allNames;
};

const getOrgUnits = (program: Partial<IProgram>): Array<Option> => {
    return program.organisationUnits?.map(({ id, name, code, parent }) => {
        return {
            label: [...getParentName(parent).reverse(), name].join("/"),
            value: id,
            code,
        };
    });
};

export const makeMetadata = ({
    data,
    attributeMapping,
    dhis2Program,
    programStageMapping,
    goData,
    tokens,
    remoteOrganisations,
    referenceData,
    program,
    dataSet,
    mapping,
    programIndicators,
    indicators,
    dhis2DataSet,
}: Partial<{
    data: any[];
    mapping: Partial<IMapping>;
    dhis2Program: Partial<IProgram>;
    programStageMapping: StageMapping;
    attributeMapping: Mapping;
    remoteOrganisations: any[];
    goData: Partial<IGoData>;
    tokens: Dictionary<string>;
    referenceData: GODataOption[];
    trackedEntityInstanceIds: string[];
    program: Partial<IProgram>;
    dataSet: Partial<IDataSet>;
    dhis2DataSet: Partial<IDataSet>;
    indicators: Option[];
    programIndicators: Option[];
}>) => {
    let results: Metadata = {
        sourceOrgUnits: [],
        destinationOrgUnits: [],
        sourceColumns: [],
        destinationColumns: [],
        destinationAttributes: [],
        sourceAttributes: [],
        destinationStages: [],
        sourceStages: [],
        uniqueAttributeValues: [],
        epidemiology: [],
        case: [],
        questionnaire: [],
        events: [],
        lab: [],
        relationship: [],
        contact: [],
        trackedEntityInstanceIds: [],
        destinationCategories: [],
        sourceCategoryOptionCombos: [],
        destinationCategoryOptionCombos: [],
        sourceCategories: [],
    };

    if (mapping.type === "individual") {
        results.destinationColumns = flattenProgram(program);
        const trackedEntityInstanceIds = findTrackedEntityInstanceIds(
            data,
            mapping.program
        );
        results.trackedEntityInstanceIds = trackedEntityInstanceIds;

        const destinationOrgUnits = getOrgUnits(program);
        const destinationAttributes = getAttributes(program).sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        });
        const uniqueAttributeValues = findUniqAttributes(
            data,
            attributeMapping
        );

        const destinationStages =
            program?.programStages?.map(({ id, name }) => {
                const option: Option = {
                    label: name,
                    value: id,
                };
                return option;
            }) || [];
        results.destinationStages = destinationStages;
        results.destinationOrgUnits = destinationOrgUnits;
        results.destinationAttributes = destinationAttributes;
        results.uniqueAttributeValues = uniqueAttributeValues;
    } else if (mapping.type === "aggregate" && !isEmpty(dataSet)) {
        console.log(indicators);
        if (programIndicators && programIndicators.length > 0) {
            results.sourceColumns = programIndicators;
        } else if (indicators && indicators.length > 0) {
            results.sourceColumns = indicators;
        }

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
    }

    if (
        mapping.dataSource === "dhis2-program-indicators" &&
        programIndicators &&
        programIndicators.length > 0
    ) {
        results.sourceColumns = programIndicators;
    } else if (
        mapping.dataSource === "dhis2-indicators" &&
        indicators &&
        indicators.length > 0
    ) {
        results.sourceColumns = indicators;
    } else if (
        mapping.dataSource === "dhis2-data-set" &&
        !isEmpty(dhis2DataSet)
    ) {
        results.sourceColumns = dataSet.dataSetElements.flatMap(
            ({ dataElement }) =>
                dataElement.categoryCombo?.categoryOptionCombos.map((c) => ({
                    label: `${dataElement.name}:${c.name}`,
                    value: `${dataElement.id},${c.id}`,
                }))
        );
        results.sourceOrgUnits = dataSet.organisationUnits?.map(
            ({ id, name, code }) => ({ code, label: name, value: id, id })
        );

        results.sourceCategories = dataSet.categoryCombo?.categories.flatMap(
            ({ id, name, code }) => {
                if (name !== "default") {
                    return { id, value: id, label: name, code };
                }
                return [];
            }
        );

        results.sourceCategoryOptionCombos =
            dhis2DataSet.categoryCombo?.categoryOptionCombos.map(
                ({ id, name, code }) => {
                    return { id, value: id, label: name, code };
                }
            );
    } else if (
        mapping.dataSource === "dhis2-program" &&
        !isEmpty(dhis2Program)
    ) {
        const sourceOrgUnits: Array<Option> = getOrgUnits(dhis2Program);
        const attributes = getAttributes(dhis2Program);
        const stages = dhis2Program.programStages?.map(({ id, name }) => {
            const option: Option = {
                label: name,
                value: id,
            };
            return option;
        });
        const stageDataElements = flattenProgram(dhis2Program);
        results.sourceStages = stages;
        results.sourceColumns = stageDataElements;
        results.sourceAttributes = attributes;
        results.sourceOrgUnits = sourceOrgUnits;
    } else if (mapping.dataSource === "go-data") {
        let units = [];
        let columns: Option[] = [];
        if (remoteOrganisations.length > 0) {
            units = remoteOrganisations.map((v: any) => {
                const label = v["name"] || "";
                const value = v["id"] || "";
                return { label, value };
            });
        }
        const attributes = [
            ...GO_DATA_PERSON_FIELDS,
            ...GO_DATA_EPIDEMIOLOGY_FIELDS,
            ...GO_DATA_EVENTS_FIELDS,
            ...GO_DATA_LAB_FIELDS,
        ].map((a) => {
            if (a.optionSet) {
                return {
                    ...a,
                    availableOptions: referenceData
                        .filter((b) => b.categoryId === a.optionSet)
                        .map((c) => {
                            const currentLabel = tokens[c.value];
                            return {
                                label: currentLabel,
                                value: c.value,
                            };
                        }),
                };
            }
            return a;
        });
        let investigationTemplate = [];
        if (goData && goData.caseInvestigationTemplate) {
            investigationTemplate = flattenGoData(
                goData.caseInvestigationTemplate,
                tokens
            );
        }
        columns = [...attributes, ...columns, ...investigationTemplate];
        results.sourceOrgUnits = units;
        results.sourceColumns = columns.sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        });
        results.sourceAttributes = attributes;
        results.epidemiology = GO_DATA_EPIDEMIOLOGY_FIELDS.sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        }).map((a) => {
            if (a.optionSet) {
                return {
                    ...a,
                    availableOptions: referenceData
                        .filter((b) => b.categoryId === a.optionSet)
                        .map((c) => {
                            const currentLabel = tokens[c.description];
                            return {
                                label: currentLabel,
                                value: c.value,
                            };
                        }),
                };
            }
            return a;
        });
        results.case = uniqBy(
            "value",
            GO_DATA_PERSON_FIELDS.filter(
                ({ entity }) => entity && entity.indexOf("CASE") !== -1
            )
        )
            .sort((a, b) => {
                if (a.mandatory && !b.mandatory) {
                    return -1;
                } else if (!a.mandatory && b.mandatory) {
                    return 1;
                }
                return 0;
            })
            .map((a) => {
                if (a.optionSet) {
                    return {
                        ...a,
                        availableOptions: referenceData
                            .filter((b) => b.categoryId === a.optionSet)
                            .map((c) => {
                                const currentLabel = tokens[c.description];
                                return {
                                    label: currentLabel,
                                    value: c.value,
                                };
                            }),
                    };
                }
                return a;
            });
        results.contact = uniqBy(
            "value",
            GO_DATA_PERSON_FIELDS.filter(
                ({ entity }) => entity && entity.indexOf("CONTACT") !== -1
            )
        )
            .sort((a, b) => {
                if (a.mandatory && !b.mandatory) {
                    return -1;
                } else if (!a.mandatory && b.mandatory) {
                    return 1;
                }
                return 0;
            })
            .map((a) => {
                if (a.optionSet) {
                    return {
                        ...a,
                        availableOptions: referenceData
                            .filter((b) => b.categoryId === a.optionSet)
                            .map((c) => {
                                const currentLabel = tokens[c.description];
                                return {
                                    label: currentLabel,
                                    value: c.value,
                                };
                            }),
                    };
                }
                return a;
            });
        results.events = uniqBy("value", [
            ...attributes.filter(
                ({ entity }) => entity && entity.indexOf("EVENT") !== -1
            ),
            ...GO_DATA_EVENTS_FIELDS,
        ])
            .sort((a, b) => {
                if (a.mandatory && !b.mandatory) {
                    return -1;
                } else if (!a.mandatory && b.mandatory) {
                    return 1;
                }
                return 0;
            })
            .map((a) => {
                if (a.optionSet) {
                    return {
                        ...a,
                        availableOptions: referenceData
                            .filter((b) => b.categoryId === a.optionSet)
                            .map((c) => {
                                const currentLabel = tokens[c.description];
                                return {
                                    label: currentLabel,
                                    value: c.value,
                                };
                            }),
                    };
                }
                return a;
            });
        results.lab = GO_DATA_LAB_FIELDS.sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        }).map((a) => {
            if (a.optionSet) {
                return {
                    ...a,
                    availableOptions: referenceData
                        .filter((b) => b.categoryId === a.optionSet)
                        .map((c) => {
                            const currentLabel = tokens[c.description];
                            return {
                                label: currentLabel,
                                value: c.value,
                            };
                        }),
                };
            }
            return a;
        });
        results.relationship = GO_DATA_RELATIONSHIP_FIELDS.sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        }).map((a) => {
            if (a.optionSet) {
                return {
                    ...a,
                    availableOptions: referenceData
                        .filter((b) => b.categoryId === a.optionSet)
                        .map((c) => {
                            const currentLabel = tokens[c.description];
                            return {
                                label: currentLabel,
                                value: c.value,
                            };
                        }),
                };
            }
            return a;
        });
        results.questionnaire = investigationTemplate;
    } else {
        let columns: Array<Option> = [];
        if (
            mapping.program &&
            mapping.program.metadataOptions &&
            mapping.program.metadataOptions.metadata &&
            mapping.program.metadataOptions.metadata.length > 0
        ) {
            columns = mapping.program.metadataOptions.metadata;
        } else if (data.length > 0) {
            columns = Object.keys(data[0]).map((key) => {
                const option: Option = {
                    label: key,
                    value: key,
                };
                return option;
            });
        }

        let units: Array<Option> = [];
        if (
            ["api", "manual"].indexOf(mapping.orgUnitSource) !== -1 &&
            remoteOrganisations.length > 0 &&
            mapping.remoteOrgUnitLabelField &&
            mapping.remoteOrgUnitValueField
        ) {
            units = remoteOrganisations.map((v: any) => {
                const label = v[mapping.remoteOrgUnitLabelField] || "";
                const value = v[mapping.remoteOrgUnitValueField] || "";
                return { label, value };
            });
        } else {
            units = uniqBy(
                "value",
                data.map((d) => {
                    const option: Option = {
                        label: getOr("", mapping.orgUnitColumn || "", d),
                        value: getOr("", mapping.orgUnitColumn || "", d),
                    };
                    return option;
                })
            );
        }
        if (mapping.aggregate?.attributeOptionComboColumn) {
            results.sourceCategoryOptionCombos = uniqBy(
                "value",
                data.map((d) => {
                    const unit = getOr(
                        "",
                        mapping.aggregate.attributeOptionComboColumn,
                        d
                    );
                    return { label: unit, value: unit };
                })
            );
        }

        results.sourceOrgUnits = units;
        results.sourceColumns = columns;
        results.sourceAttributes = columns;
    }

    if (mapping.isSource) {
        results = {
            sourceColumns: results.destinationColumns,
            destinationColumns: results.sourceColumns,
            sourceOrgUnits: results.destinationOrgUnits,
            destinationOrgUnits: results.sourceOrgUnits,
            sourceAttributes: results.destinationAttributes,
            destinationAttributes: results.sourceAttributes,
            sourceStages: results.destinationStages,
            destinationStages: results.sourceStages,
            uniqueAttributeValues: results.uniqueAttributeValues,
            epidemiology: results.epidemiology,
            case: results.case,
            contact: results.contact,
            questionnaire: results.questionnaire,
            events: results.events,
            lab: results.lab,
            relationship: results.relationship,
            trackedEntityInstanceIds: results.trackedEntityInstanceIds,
            destinationCategories: results.destinationCategories,
            destinationCategoryOptionCombos:
                results.destinationCategoryOptionCombos,
            sourceCategoryOptionCombos: results.destinationCategoryOptionCombos,
            sourceCategories: results.destinationCategories,
        };
    }
    return results;
};
