import { isEmpty } from "lodash";
import { getOr, uniqBy } from "lodash/fp";
import {
    GO_DATA_EPIDEMIOLOGY_FIELDS,
    GO_DATA_EVENTS_FIELDS,
    GO_DATA_LAB_FIELDS,
    GO_DATA_PERSON_FIELDS,
    GO_DATA_RELATIONSHIP_FIELDS,
} from "./constants";
import {
    DHIS2OrgUnit,
    GODataOption,
    IDataSet,
    IGoData,
    IMapping,
    IProgram,
    Mapping,
    Metadata,
    Option,
    StageMapping,
} from "./interfaces";
import {
    findTrackedEntityInstanceIds,
    flattenProgram,
    getAttributes,
} from "./program";

import { flattenGoData } from "./flatten-go-data";
import { sortOptionsByMandatory } from "./utils";

export const getParentName = (parent: Partial<DHIS2OrgUnit>) => {
    let first = parent;
    let allNames: string[] = [];
    while (first && first.name) {
        allNames = [...allNames, first.name];
        first = first.parent;
    }
    return allNames;
};

export const getParent = (parent: Partial<DHIS2OrgUnit>) => {
    let first = parent;
    let allNames: Array<{}> = [];
    while (first && first.name) {
        allNames = [...allNames, first.name];
        first = first.parent;
    }
    return allNames;
};

const getOrgUnits = (program: Partial<IProgram>): Array<Option> => {
    return program.organisationUnits?.map(({ id, name, code, parent }) => {
        const path = [...getParentName(parent).reverse(), name].join("/");
        return {
            label: name,
            value: id,
            code,
            path,
        };
    });
};

export const makeMetadata = ({
    data,
    dhis2Program,
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
    fhir,
}: Partial<{
    data: any[];
    mapping: Partial<IMapping>;
    dhis2Program: Partial<IProgram>;
    remoteOrganisations: any[];
    goData: Partial<IGoData>;
    tokens: Map<string, string>;
    referenceData: GODataOption[];
    trackedEntityInstanceIds: string[];
    program: Partial<IProgram>;
    dataSet: Partial<IDataSet>;
    dhis2DataSet: Partial<IDataSet>;
    indicators: Option[];
    programIndicators: Option[];
    previous: {
        programStageMapping: StageMapping;
        attributeMapping: Mapping;
        organisationUnitMapping: Mapping;
        enrollmentMapping: Mapping;
    };
    fhir: {
        concepts: any[];
        labelColumn: string;
        valueColumn: string;
    };
}>) => {
    let results: Metadata = {
        sourceOrgUnits: [],
        destinationOrgUnits: [],
        sourceColumns: [],
        destinationColumns: [],
        destinationTrackedEntityTypeAttributes: [],
        sourceTrackedEntityTypeAttributes: [],
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
        sourceEnrollmentAttributes: [],
        destinationEnrollmentAttributes: [],
        sourceTrackedEntityAttributes: [],
        destinationTrackedEntityAttributes: [],
    };

    const { type, orgUnitMapping: { orgUnitColumn } = { orgUnitColumn: "" } } =
        mapping;

    if (type === "individual" && !isEmpty(program)) {
        const { elements, attributes } = flattenProgram(program);
        const {
            enrollmentAttributes,
            trackedEntityTypeAttributes,
            attributes: destinationTrackedEntityAttributes,
        } = getAttributes(program);
        results.destinationTrackedEntityAttributes = sortOptionsByMandatory(
            destinationTrackedEntityAttributes,
        );
        results.destinationTrackedEntityTypeAttributes = sortOptionsByMandatory(
            trackedEntityTypeAttributes,
        );
        results.destinationEnrollmentAttributes =
            sortOptionsByMandatory(enrollmentAttributes);
        results.destinationColumns = [...attributes, ...elements];
        const trackedEntityInstanceIds = findTrackedEntityInstanceIds({
            mapping,
            data,
        });
        results.trackedEntityInstanceIds = trackedEntityInstanceIds;

        const destinationOrgUnits = getOrgUnits(program);

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

        results.destinationCategoryOptionCombos =
            program.categoryCombo?.categoryOptionCombos.flatMap(
                ({ id, name, code }) => {
                    if (name !== "default") {
                        return { id, value: id, label: name, code };
                    }
                    return [];
                },
            );

        results.destinationCategories =
            program.categoryCombo.categories.flatMap(({ id, name, code }) => {
                if (name !== "default") {
                    return {
                        id,
                        value: id,
                        label: name,
                        code,
                    };
                }
                return [];
            });
    } else if (mapping.type === "aggregate" && !isEmpty(dataSet)) {
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
                },
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
                }),
        );
        results.destinationOrgUnits = dataSet.organisationUnits.map(
            ({ id, name, code }) => ({ code, label: name, value: id, id }),
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
        if (remoteOrganisations.length > 0) {
            results.sourceOrgUnits = remoteOrganisations;
        }
    } else if (
        mapping.dataSource === "dhis2-indicators" &&
        indicators &&
        indicators.length > 0
    ) {
        results.sourceColumns = indicators;

        if (remoteOrganisations.length > 0) {
            results.sourceOrgUnits = remoteOrganisations;
        }
    } else if (
        mapping.dataSource === "dhis2-data-set" &&
        !isEmpty(dhis2DataSet)
    ) {
        results.sourceColumns = dhis2DataSet.dataSetElements.flatMap(
            ({ dataElement }) =>
                dataElement.categoryCombo?.categoryOptionCombos.map((c) => ({
                    label: `${dataElement.name}:${c.name}`,
                    value: `${dataElement.id},${c.id}`,
                })),
        );
        results.sourceOrgUnits = dhis2DataSet.organisationUnits?.map(
            ({ id, name, code }) => ({ code, label: name, value: id, id }),
        );

        results.sourceCategories =
            dhis2DataSet.categoryCombo?.categories.flatMap(
                ({ id, name, code }) => {
                    if (name !== "default") {
                        return { id, value: id, label: name, code };
                    }
                    return [];
                },
            );

        results.sourceCategoryOptionCombos =
            dhis2DataSet.categoryCombo?.categoryOptionCombos.map(
                ({ id, name, code }) => {
                    return { id, value: id, label: name, code };
                },
            );
    } else if (
        mapping.dataSource === "dhis2-program" &&
        !isEmpty(dhis2Program)
    ) {
        const sourceOrgUnits: Array<Option> = getOrgUnits(dhis2Program);
        const stages = dhis2Program.programStages?.map(({ id, name }) => {
            const option: Option = {
                label: name,
                value: id,
            };
            return option;
        });
        const { elements, attributes } = flattenProgram(dhis2Program);

        const {
            enrollmentAttributes,
            trackedEntityTypeAttributes,
            attributes: sourceTrackedEntityAttributes,
        } = getAttributes(dhis2Program);
        results.sourceStages = stages;
        results.sourceColumns = attributes.concat(elements);
        results.sourceOrgUnits = sourceOrgUnits;
        results.sourceTrackedEntityAttributes = sourceTrackedEntityAttributes;
        results.sourceTrackedEntityTypeAttributes = sortOptionsByMandatory(
            trackedEntityTypeAttributes,
        );
        results.sourceEnrollmentAttributes =
            sortOptionsByMandatory(enrollmentAttributes);

        results.sourceCategories = program.categoryCombo?.categories.flatMap(
            ({ id, name, code }) => {
                if (name !== "default") {
                    return {
                        id,
                        value: id,
                        label: name,
                        code,
                    };
                }
                return [];
            },
        );

        results.sourceCategoryOptionCombos =
            program.categoryCombo?.categoryOptionCombos.map(
                ({ id, name, code }) => {
                    return { id, value: id, label: name, code };
                },
            );
    } else if (mapping.dataSource === "go-data") {
        let units = [];
        let columns: Option[] = [];
        if (remoteOrganisations.length > 0) {
            units = remoteOrganisations.map((v: any) => {
                const label = v["name"] || "";
                const value = v["id"] || "";
                const code = v["code"];
                return { label, value, code };
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
                tokens,
            );
        }
        columns = [...attributes, ...columns, ...investigationTemplate];
        results.sourceOrgUnits = units;
        results.sourceColumns = sortOptionsByMandatory(columns);
        results.sourceTrackedEntityTypeAttributes = attributes;
        results.sourceTrackedEntityAttributes = attributes;
        results.sourceEnrollmentAttributes = attributes;
        results.epidemiology = sortOptionsByMandatory(
            GO_DATA_EPIDEMIOLOGY_FIELDS.map((a) => {
                if (a.optionSetValue && a.optionSet) {
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
            }),
        ).map((a) => {
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
        results.case = sortOptionsByMandatory(
            uniqBy(
                "value",
                GO_DATA_PERSON_FIELDS.filter(
                    ({ entity }) => entity && entity.indexOf("CASE") !== -1,
                ),
            ),
        ).map((a) => {
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
        results.contact = sortOptionsByMandatory(
            uniqBy(
                "value",
                GO_DATA_PERSON_FIELDS.filter(
                    ({ entity }) => entity && entity.indexOf("CONTACT") !== -1,
                ),
            ),
        ).map((a) => {
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
        results.events = sortOptionsByMandatory(
            uniqBy("value", [
                ...attributes.filter(
                    ({ entity }) => entity && entity.indexOf("EVENT") !== -1,
                ),
                ...GO_DATA_EVENTS_FIELDS,
            ]),
        ).map((a) => {
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
        results.lab = sortOptionsByMandatory(GO_DATA_LAB_FIELDS).map((a) => {
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
        results.relationship = sortOptionsByMandatory(
            GO_DATA_RELATIONSHIP_FIELDS,
        ).map((a) => {
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
        results.questionnaire = investigationTemplate;
    } else if (mapping.dataSource === "fhir") {
        let concepts: Option[] = [];
        if (fhir.concepts && fhir.labelColumn && fhir.valueColumn) {
            concepts = fhir.concepts.map((v: any) => {
                const label = getOr("", fhir.labelColumn, v);
                const value = getOr("", fhir.valueColumn, v);
                return {
                    label: `${label}(${value})`,
                    value,
                };
            });
        }
        results.sourceOrgUnits = remoteOrganisations.map((v: any) => {
            const label = v[mapping.remoteOrgUnitLabelField] || "";
            const value = v[mapping.remoteOrgUnitValueField] || "";
            return { label, value };
        });
        results.sourceColumns = [
            { value: "encounter.period.start", label: "Encounter Start" },
            { value: "encounter.period.end", label: "Encounter End" },
            { value: "encounter.id", label: "Encounter ID" },
            { value: "episodeOfCare.id", label: "EpisodeOfCare ID" },
            {
                value: "episodeOfCare.period.start",
                label: "EpisodeOfCare Start",
            },
            { value: "episodeOfCare.period.end", label: "EpisodeOfCare End" },
            { value: "patient.id", label: "Patient ID" },
            { value: "patient.given", label: "Patient Given Name" },
            { value: "patient.family", label: "Patient Family Name" },
            { value: "patient.name", label: "Patient Full Name" },
            { value: "patient.birthDate", label: "Patient Birth Date" },
            { value: "patient.gender", label: "Patient Gender" },
            {
                value: "patient.deceasedDateTime",
                label: "Patient Deceased Date",
            },
            { value: "patient.deceasedBoolean", label: "Patient Deceased" },
            {
                value: "patient.managingOrganization.reference",
                label: "Patient Managing Organization",
            },
            { value: "patient.address.city", label: "Patient City" },
            { value: "patient.address.country", label: "Patient Country" },
            { value: "patient.address.state", label: "Patient State" },
            {
                value: "patient.address.postalCode",
                label: "Patient Postal Code",
            },
            { value: "patient.address.district", label: "Patient District" },
            ...uniqBy("value", concepts),
        ];
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
        } else if (orgUnitColumn) {
            units = uniqBy(
                "value",
                data.flatMap((d) => {
                    const allColumns = orgUnitColumn.split(",");
                    const allUnits = allColumns.flatMap((c) => {
                        const currentValue = getOr("", c, d).trim();
                        if (currentValue) {
                            return currentValue;
                        }
                        return [];
                    });
                    const path = allUnits.join("/");

                    if (mapping.orgUnitMapping.matchHierarchy) {
                        if (allColumns.length === allUnits.length) {
                            const option: Option = {
                                label: path,
                                value: path,
                                path: path,
                            };
                            return option;
                        }

                        return [];
                    } else if (allUnits.length > 0) {
                        const option: Option = {
                            label: allUnits[allUnits.length - 1],
                            value: allUnits[allUnits.length - 1],
                            path: path,
                        };
                        return option;
                    }
                    return [];
                }),
            );
        }
        if (
            mapping.hasAttribution &&
            mapping.attributionMerged &&
            mapping.attributeOptionComboColumn
        ) {
            results.sourceCategoryOptionCombos = uniqBy(
                "value",
                data.map((d) => {
                    const unit = getOr(
                        "",
                        mapping.attributeOptionComboColumn,
                        d,
                    );
                    return { label: unit, value: unit };
                }),
            );
        } else if (
            mapping.hasAttribution &&
            !isEmpty(mapping.categoryColumns)
        ) {
            results.sourceCategoryOptionCombos = uniqBy(
                "value",
                data.map((d) => {
                    const unit = Object.values(mapping.categoryColumns)
                        .sort()
                        .map((a) => getOr("", a, d))
                        .join(" ");
                    return { label: unit, value: unit };
                }),
            );
        }
        results.sourceOrgUnits = units;
        results.sourceColumns = columns;
        results.sourceTrackedEntityTypeAttributes = columns;
    }

    if (mapping.isSource) {
        results = {
            sourceColumns: results.destinationColumns,
            destinationColumns: results.sourceColumns,
            sourceOrgUnits: results.destinationOrgUnits,
            destinationOrgUnits: results.sourceOrgUnits,
            sourceTrackedEntityTypeAttributes:
                results.destinationTrackedEntityTypeAttributes,
            destinationTrackedEntityTypeAttributes:
                results.sourceTrackedEntityTypeAttributes,
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
            sourceEnrollmentAttributes: results.destinationEnrollmentAttributes,
            destinationEnrollmentAttributes: results.sourceEnrollmentAttributes,
            destinationTrackedEntityAttributes:
                results.sourceTrackedEntityTypeAttributes,
            sourceTrackedEntityAttributes:
                results.destinationTrackedEntityTypeAttributes,
        };
    }
    return results;
};
