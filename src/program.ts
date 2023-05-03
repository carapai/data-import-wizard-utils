import { format, parseISO } from "date-fns/fp";
import { Dictionary } from "lodash";
import {
    fromPairs,
    get,
    getOr,
    groupBy,
    isEmpty,
    uniqBy,
    update,
} from "lodash/fp";
import { z } from "zod";
import axios from "axios";

import { generateUid } from "./uid";
import {
    Attribute,
    DataValue,
    Enrollment,
    Event,
    IProgram,
    IProgramMapping,
    IProgramStage,
    Mapping,
    TrackedEntityInstance,
    StageMapping,
    Option,
    ValueType,
    Authentication,
    IGoData,
} from "./interfaces";
import { createOptions } from "./utils";
import { GO_DATA_DEFAULT_FIELDS } from "./constants";

export const stepLabels: { [key: number]: string } = {
    0: "Create New Mapping",
    1: "Next",
    2: "Next",
    3: "Next",
    4: "Next",
    5: "Next",
    6: "Next",
    7: "Import",
    8: "Finish",
};

const parseAndFormatDate = (date: string) => {
    const parsedDate = Date.parse(date);
    if (Number.isNaN(parsedDate)) {
        return new Date(parsedDate);
    }
};

export const compareArrays = <TData>(
    source: TData[],
    destination: TData[],
    key: string
) => {
    const sourceKeys = source.map((val) => get(key, val)).sort();
    const sourceValues = source.map((val) => get("value", val)).sort();
    const destinationKeys = destination.map((val) => get(key, val)).sort();
    const destinationValues = destination
        .map((val) => get("value", val))
        .sort();

    const haveSameKeys = sourceKeys.every((element) => {
        return destinationKeys.includes(element);
    });
    const haveSameValues = sourceValues.every((element) => {
        return destinationValues.includes(element);
    });
    return haveSameKeys && haveSameValues;
};

export const mergeArrays = <TData>(
    source: TData[],
    destination: TData[],
    key: string
) => {
    const sources = source.map((val: TData) => [get(key, val), val]);
    let destinations = fromPairs<TData>(
        destination.map((val) => [get(key, val), val])
    );

    sources.forEach(([key, value]) => {
        destinations = { ...destinations, [key]: value };
    });
    return Object.values(destinations);
};

const processEvents = (
    data: any[],
    programStageMapping: { [key: string]: Mapping },
    trackedEntityInstance: string,
    enrollment: string,
    orgUnit: string,
    program: string,
    previousEvents: Dictionary<{
        [key: string]: Array<{ dataElement: string; value: string }>;
    }>,
    stages: Dictionary<IProgramStage>
) => {
    return Object.entries(programStageMapping).flatMap(
        ([programStage, mapping]) => {
            const { repeatable } = stages[programStage];
            const stagePreviousEvents = previousEvents[programStage];
            let currentData = fromPairs([["all", data]]);
            const { info, ...elements } = mapping;
            const eventDateColumn = info.eventDateColumn || "";
            const eventDateIsUnique = info.eventDateIsUnique;
            const eventIdColumn = info.eventIdColumn || "";

            let uniqueColumns = Object.entries(elements).flatMap(
                ([, { unique, value }]) => {
                    if (unique && value) {
                        return value;
                    }
                    return [];
                }
            );
            if (eventDateIsUnique) {
                uniqueColumns = [...uniqueColumns, eventDateColumn];
            }

            if (eventIdColumn) {
                uniqueColumns = [...uniqueColumns, eventIdColumn];
            }

            if (uniqueColumns.length) {
                currentData = groupBy(
                    (item: any) =>
                        uniqueColumns.map((column) => {
                            if (column === eventDateColumn) {
                                return format(
                                    "yyyy-MM-dd",
                                    parseISO(getOr("", column, item))
                                );
                            }
                            return getOr("", column, item);
                        }),
                    data
                );
            }

            const allValues = Object.entries(currentData);
            if (repeatable) {
                return allValues.flatMap(([key, currentRow]) => {
                    const prev = stagePreviousEvents[key];
                    return currentRow.flatMap((row) => {
                        const eventDate: string = format(
                            "yyyy-MM-dd",
                            parseISO(getOr("", eventDateColumn, row))
                        );
                        if (eventDate) {
                            const eventId = generateUid();
                            const dataValues: Array<Partial<DataValue>> =
                                Object.entries(elements).flatMap(
                                    ([dataElement, { value }]) => {
                                        if (value) {
                                            const dv: Partial<DataValue> = {
                                                dataElement,
                                                value: getOr("", value, row),
                                            };
                                            return dv;
                                        }
                                        return [];
                                    }
                                );
                            return {
                                eventDate,
                                dataValues,
                                programStage,
                                enrollment,
                                trackedEntityInstance,
                                program,
                                orgUnit,
                                event: eventId,
                            };
                        }
                        return [];
                    });
                });
            } else if (allValues.length > 0) {
                const [key, currentRow] = allValues[0];
                const prev = stagePreviousEvents[key];
                if (isEmpty(prev)) {
                    return currentRow.flatMap((row) => {
                        const eventDate: string = format(
                            "yyyy-MM-dd",
                            parseISO(getOr("", eventDateColumn, row))
                        );
                        if (eventDate) {
                            const eventId = generateUid();
                            const dataValues: Array<Partial<DataValue>> =
                                Object.entries(elements).flatMap(
                                    ([dataElement, { value }]) => {
                                        if (value) {
                                            const dv: Partial<DataValue> = {
                                                dataElement,
                                                value: getOr("", value, row),
                                            };
                                            return dv;
                                        }
                                        return [];
                                    }
                                );
                            return {
                                eventDate,
                                dataValues,
                                programStage,
                                enrollment,
                                trackedEntityInstance,
                                program,
                                orgUnit,
                                event: eventId,
                            };
                        }
                        return [];
                    });
                } else {
                }
            }
            return [];
        }
    );
};

export const convertFromDHIS2 = async (
    data: { trackedEntityInstances: TrackedEntityInstance[] },
    programMapping: Partial<IProgramMapping>,
    organisationUnitMapping: Mapping,
    attributeMapping: Mapping,
    programStageMapping: { [key: string]: Mapping }
) => {
    const flattenedData = flattenTrackedEntityInstances(data);
    const groupedData = groupBy("trackedEntityInstance", flattenedData);
    return Object.values(groupedData).map((instanceData) => {
        let obj: { [key: string]: any } = {};
        const data = instanceData[0];
        const dataGroupedByStages = groupBy("programStage", instanceData);
        update(
            programMapping.orgUnitColumn,
            () => organisationUnitMapping[data["orgUnit"]].value,
            obj
        );
        update(
            programMapping.incidentDateColumn,
            () => data["incidentDate"],
            obj
        );
        update(
            programMapping.enrollmentDateColumn,
            () => data["enrollmentDate"],
            obj
        );
        if (programMapping.trackedEntityInstanceColumn) {
            update(
                programMapping.trackedEntityInstanceColumn,
                () => data["trackedEntityInstance"],
                obj
            );
        }

        Object.entries(attributeMapping).forEach(([attribute, mapping]) => {
            if (mapping.value) {
                update(mapping.value, () => data[attribute], obj);
            }
        });
        Object.entries(programStageMapping).forEach(([stage, stageMapping]) => {
            const stageData = dataGroupedByStages[stage] || [];
            if (stageData.length > 0) {
                const stageDataAtIndex0 = stageData[0];
                Object.entries(stageMapping).forEach(
                    ([dataElement, mapping]) => {
                        if (mapping.value) {
                            update(
                                mapping.value,
                                () => stageDataAtIndex0[dataElement],
                                obj
                            );
                        }
                    }
                );
            }
        });
        return obj;
    });
};

export const convertToGoData = async (
    data: { trackedEntityInstances: TrackedEntityInstance[] },
    organisationUnitMapping: Mapping,
    attributeMapping: Mapping,
    goData: Partial<IGoData>
) => {
    const flippedUnits = fromPairs(
        Object.entries(organisationUnitMapping).map(([unit, value]) => {
            return [value.value, unit];
        })
    );
    const flattenedData = flattenTrackedEntityInstances(data);
    const groupedData = groupBy("trackedEntityInstance", flattenedData);
    const attributes = goData.caseInvestigationTemplate.map(({ variable }) => {
        return variable;
    });

    return Object.values(groupedData).flatMap((instanceData) => {
        let questionnaireAnswers: { [key: string]: Array<{ value: any }> } = {};
        const firstRecord = instanceData[0];
        const orgUnit = instanceData["orgUnit"];

        console.log(orgUnit);
        console.log(flippedUnits);

        let obj: { [key: string]: any } = {
            addresses: [
                {
                    locationId: flippedUnits[orgUnit] || "",
                },
            ],
        };

        Object.entries(attributeMapping).forEach(([attribute, mapping]) => {
            if (mapping.value && attributes.indexOf(attribute) !== -1) {
                const values = instanceData.flatMap((d) => {
                    console.log(mapping.value, d[mapping.value]);
                    const actualValue = d[mapping.value];
                    if (actualValue) {
                        return { value: actualValue };
                    }
                    return [];
                });
                if (values.length > 0) {
                    questionnaireAnswers = {
                        ...questionnaireAnswers,
                        [attribute]: values,
                    };
                }
            } else {
                obj = { ...obj, [attribute]: firstRecord[mapping.value] };
            }
        });
        return { ...obj, questionnaireAnswers };
    });
};

export const convertToDHIS2 = async (
    previousData: {
        attributes: Dictionary<Array<{ attribute: string; value: string }>>;
        dataElements: Dictionary<
            Dictionary<{
                [key: string]: Array<{ dataElement: string; value: string }>;
            }>
        >;
        enrollments: Dictionary<string>;
        trackedEntities: Dictionary<string>;
    },
    data: any[],
    programMapping: Partial<IProgramMapping>,
    organisationUnitMapping: Mapping,
    attributeMapping: Mapping,
    programStageMapping: { [key: string]: Mapping },
    programUniqAttributes: string[],
    programStageUniqueElements: { [key: string]: string[] },
    programUniqColumns: string[],
    version: number,
    program: Partial<IProgram>,
    elements: Dictionary<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>>,
    attributesSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>
) => {
    const {
        onlyEnrollOnce,
        selectEnrollmentDatesInFuture,
        selectIncidentDatesInFuture,
        programTrackedEntityAttributes,
        programStages,
    } = program;
    const programAttributes = fromPairs(
        programTrackedEntityAttributes?.map(
            ({ trackedEntityAttribute, mandatory }) => {
                return [
                    trackedEntityAttribute.id,
                    { ...trackedEntityAttribute, mandatory },
                ];
            }
        )
    );

    const stages = fromPairs(
        programStages?.map((programStage) => {
            return [programStage.id, programStage];
        })
    );

    const { createEntities, createEnrollments, updateEntities } =
        programMapping;

    const flippedUnits = fromPairs(
        Object.entries(organisationUnitMapping).map(([unit, value]) => {
            return [value.value, unit];
        })
    );

    const orgUnitColumn = programMapping.orgUnitColumn || "";
    const enrollmentDateColumn = programMapping.enrollmentDateColumn || "";
    const incidentDateColumn = programMapping.incidentDateColumn || "";
    let groupedData = groupBy(
        "id",
        data.map((d) => {
            return { id: generateUid(), ...d };
        })
    );

    if (programUniqColumns.length > 0) {
        groupedData = groupBy(
            (item: any) =>
                programUniqColumns
                    .map((column) => getOr("", column, item))
                    .sort()
                    .join(""),
            data
        );
    }
    const processed = Object.entries(groupedData).flatMap(
        ([uniqueKey, current]) => {
            const orgUnit = getOr(
                "",
                getOr("", orgUnitColumn, current[0]),
                flippedUnits
            );
            let results: {
                enrollments: Array<Partial<Enrollment>>;
                trackedEntities: Array<Partial<TrackedEntityInstance>>;
                events: Array<Partial<Event>>;
                eventUpdates: Array<Partial<Event>>;
                trackedEntityUpdates: Array<Partial<TrackedEntityInstance>>;
            } = {
                enrollments: [],
                trackedEntities: [],
                events: [],
                eventUpdates: [],
                trackedEntityUpdates: [],
            };
            if (orgUnit) {
                let previousTrackedEntity = getOr(
                    "",
                    uniqueKey,
                    previousData.trackedEntities
                );
                let previousEnrollment = getOr(
                    "",
                    uniqueKey,
                    previousData.enrollments
                );

                const trackedEntityInstanceId =
                    previousTrackedEntity || generateUid();

                const enrollmentId = previousEnrollment || generateUid();

                const previousAttributes = getOr(
                    [],
                    uniqueKey,
                    previousData.attributes
                );

                const currentAttributes = Object.entries(
                    attributeMapping
                ).flatMap(([attribute, { value }]) => {
                    const attributeDetails = programAttributes[attribute];
                    const realValue = getOr("", value || "", current[0]);
                    if (realValue) {
                        const attr: Partial<Attribute> = {
                            attribute,
                            value: realValue,
                        };
                        return attr;
                    }
                    return [];
                });

                const currentAttributeValues = fromPairs(
                    currentAttributes.map(({ attribute, value }) => [
                        attribute,
                        value,
                    ])
                );
                const { ["lZGmxYbs97q"]: removed, ...rest } =
                    currentAttributeValues;

                if (previousAttributes.length > 0 && updateEntities) {
                    if (
                        !compareArrays(
                            currentAttributes,
                            previousAttributes,
                            "attribute"
                        )
                    ) {
                        const attributes = mergeArrays(
                            currentAttributes,
                            previousAttributes,
                            "attribute"
                        );
                        results = {
                            ...results,
                            trackedEntityUpdates: [
                                {
                                    trackedEntityInstance:
                                        trackedEntityInstanceId,
                                    attributes,
                                    trackedEntityType:
                                        programMapping.trackedEntityType,
                                    orgUnit,
                                },
                            ],
                        };
                    }
                } else if (previousAttributes.length === 0 && createEntities) {
                    results = {
                        ...results,
                        trackedEntities: [
                            {
                                trackedEntityInstance: trackedEntityInstanceId,
                                attributes: currentAttributes,
                                trackedEntityType:
                                    programMapping.trackedEntityType,
                                orgUnit,
                            },
                        ],
                    };
                }
                if (createEnrollments && isEmpty(previousEnrollment)) {
                    const enrollmentDate = getOr(
                        "",
                        enrollmentDateColumn,
                        current[0]
                    );
                    const incidentDate = getOr(
                        "",
                        incidentDateColumn,
                        current[0]
                    );

                    if (enrollmentDate && incidentDate) {
                        const enrollment = {
                            program: programMapping.program,
                            trackedEntityInstance: trackedEntityInstanceId,
                            orgUnit,
                            enrollmentDate: format(
                                "yyyy-MM-dd",
                                parseISO(enrollmentDate)
                            ),
                            incidentDate: format(
                                "yyyy-MM-dd",
                                parseISO(incidentDate)
                            ),
                            enrollment: enrollmentId,
                        };

                        results = { ...results, enrollments: [enrollment] };
                    }
                }

                const events = processEvents(
                    current,
                    programStageMapping,
                    trackedEntityInstanceId,
                    enrollmentId,
                    orgUnit,
                    programMapping.program || "",
                    getOr(
                        {},
                        getOr(
                            "",
                            programUniqColumns.sort().join(""),
                            current[0]
                        ),
                        previousData.dataElements
                    ),
                    stages
                );
                results = { ...results, events };
                return results;
            }
            return results;
        }
    );

    const trackedEntityInstances = processed.flatMap(
        ({ trackedEntities }) => trackedEntities
    );
    const enrollments = processed.flatMap(({ enrollments }) => enrollments);
    const events = processed.flatMap(({ events }) => events.flat());
    return { trackedEntityInstances, events, enrollments };
};

export const processPreviousInstances = (
    trackedEntityInstances: TrackedEntityInstance[],
    programUniqAttributes: string[],
    programStageUniqueElements: { [key: string]: string[] },
    currentProgram: string
) => {
    let currentAttributes: Array<[string, any]> = [];
    let currentElements: Array<[string, any]> = [];
    let currentEnrollments: Array<[string, string]> = [];
    let currentTrackedEntities: Array<[string, string]> = [];
    trackedEntityInstances.forEach(
        ({ enrollments, attributes, trackedEntityInstance }) => {
            const attributeKey = [
                ...attributes,
                {
                    attribute: "trackedEntityInstance",
                    value: trackedEntityInstance,
                },
            ]
                .flatMap(({ attribute, value }) => {
                    if (
                        attribute &&
                        programUniqAttributes.indexOf(attribute) !== -1
                    ) {
                        return value;
                    }
                    return [];
                })
                .sort()
                .join("");
            currentTrackedEntities.push([attributeKey, trackedEntityInstance]);
            currentAttributes.push([attributeKey, attributes]);
            if (enrollments.length > 0) {
                const previousEnrollment = enrollments.find(
                    ({ program }: any) => program === currentProgram
                );
                if (previousEnrollment) {
                    const { events, enrollment } = previousEnrollment;
                    currentEnrollments.push([attributeKey, String(enrollment)]);
                    const groupedEvents = groupBy("programStage", events);
                    const uniqueEvents = Object.entries(groupedEvents).flatMap(
                        ([stage, availableEvents]) => {
                            const stageElements =
                                programStageUniqueElements[stage];
                            if (stageElements) {
                                const elements = availableEvents.map(
                                    (event) => {
                                        const finalValues = [
                                            ...event.dataValues,
                                            {
                                                dataElement: "eventDate",
                                                value: format(
                                                    "yyyy-MM-dd",
                                                    parseISO(event.eventDate)
                                                ),
                                            },
                                            {
                                                dataElement: "event",
                                                value: event.event,
                                            },
                                        ].map(({ dataElement, value }) => [
                                            dataElement,
                                            value,
                                        ]);
                                        const dataElementKey = finalValues
                                            .flatMap(([dataElement, value]) => {
                                                if (
                                                    dataElement &&
                                                    stageElements.indexOf(
                                                        dataElement
                                                    ) !== -1
                                                ) {
                                                    return value;
                                                }
                                                return [];
                                            })
                                            .sort()
                                            .join("");

                                        return [
                                            dataElementKey,
                                            fromPairs(finalValues),
                                        ];
                                    }
                                );
                                return [[stage, fromPairs(elements)]];
                            }
                            return [];
                        }
                    );
                    currentElements.push([
                        attributeKey,
                        fromPairs(uniqueEvents),
                    ]);
                }
            }
        }
    );
    return {
        attributes:
            fromPairs<Array<{ attribute: string; value: string }>>(
                currentAttributes
            ),
        dataElements: fromPairs<
            Dictionary<{
                [key: string]: Array<{ dataElement: string; value: string }>;
            }>
        >(currentElements),
        enrollments: fromPairs<string>(currentEnrollments),
        trackedEntities: fromPairs<string>(currentTrackedEntities),
    };
};

export const flattenTrackedEntityInstances = (response: {
    trackedEntityInstances: Array<TrackedEntityInstance>;
}) => {
    return response.trackedEntityInstances.flatMap(
        ({
            attributes,
            trackedEntityInstance,
            enrollments,
            orgUnit,
            deleted,
            trackedEntityType,
        }) => {
            const attributeValues = fromPairs(
                attributes.map(({ attribute, value }) => [
                    `${attribute}`,
                    value,
                ])
            );
            const foundEvents = enrollments.flatMap(
                ({ events, enrollment, enrollmentDate, incidentDate }) => {
                    const processedEvents = events.map(
                        ({
                            dataValues,
                            programStage,
                            program,
                            orgUnit,
                            orgUnitName,
                            event,
                            eventDate,
                            enrollment,
                        }) => {
                            const dvs = fromPairs(
                                dataValues.map(({ dataElement, value }) => [
                                    `${programStage}.${dataElement}`,
                                    value,
                                ])
                            );
                            return {
                                trackedEntityInstance,
                                deleted,
                                trackedEntityType,
                                orgUnit,
                                enrollmentDate,
                                incidentDate,
                                enrollment,
                                programStage,
                                program,
                                orgUnitName,
                                [`${programStage}.event`]: event,
                                [`${programStage}.eventDate`]: eventDate,
                                ...dvs,
                                ...attributeValues,
                            };
                        }
                    );

                    if (processedEvents.length > 0) {
                        return processedEvents;
                    }
                    return {
                        trackedEntityInstance,
                        deleted,
                        trackedEntityType,
                        orgUnit,
                        enrollmentDate: "",
                        incidentDate: "",
                        programStage: "",
                        program: "",
                        orgUnitName: "",
                        event: "",
                        eventDate: "",
                        enrollment,
                        ...attributeValues,
                    };
                }
            );
            if (foundEvents.length > 0) {
                return foundEvents;
            }
            return {
                ...attributeValues,
                trackedEntityInstance,
                deleted,
                trackedEntityType,
                orgUnit,
                enrollmentDate: "",
                incidentDate: "",
                programStage: "",
                program: "",
                orgUnitName: "",
                event: "",
                eventDate: "",
                enrollment: "",
            };
        }
    );
};

export const findUniqueDataElements = (programStageMapping: StageMapping) => {
    const uniqElements = Object.entries(programStageMapping).map(
        ([stage, mapping]) => {
            const { info, ...elements } = mapping;
            const eventDateIsUnique = info.eventDateIsUnique;
            let uniqueColumns = Object.entries(elements).flatMap(
                ([element, { unique, value }]) => {
                    if (unique && value) {
                        return element;
                    }
                    return [];
                }
            );
            if (eventDateIsUnique) {
                uniqueColumns = [...uniqueColumns, "eventDate"];
            }

            return [stage, uniqueColumns];
        }
    );
    return fromPairs(uniqElements);
};

const getOrgUnits = (program: Partial<IProgram>): Array<Option> => {
    return program.organisationUnits?.map(({ id, name, code }) => {
        return {
            label: name,
            value: id,
            code,
        };
    });
};
const getAttributes = (program: Partial<IProgram>): Array<Option> => {
    return program.programTrackedEntityAttributes?.map(
        ({
            trackedEntityAttribute: { id, name, code, unique, optionSetValue },
        }) => {
            return {
                label: name,
                value: id,
                code,
                unique,
                optionSetValue,
            };
        }
    );
};

export const makeMetadata = (
    programMapping: Partial<IProgramMapping>,
    program: Partial<IProgram>,
    data: any[],
    dhis2Program: Partial<IProgram>,
    programStageMapping: StageMapping,
    attributeMapping: Mapping,
    remoteOrganisations: any[],
    goData: Partial<IGoData>
) => {
    const destinationOrgUnits = getOrgUnits(program);
    const destinationAttributes = getAttributes(program);
    let results: {
        sourceOrgUnits: Array<Option>;
        destinationOrgUnits: Array<Option>;
        sourceColumns: Array<Option>;
        destinationColumns: Array<Option>;
        sourceAttributes: Array<Option>;
        destinationAttributes: Array<Option>;
        stages: Array<Option>;
        uniqueAttributeValues: Array<{ attribute: string; value: string }>;
    } = {
        sourceOrgUnits: [],
        destinationOrgUnits,
        sourceColumns: [],
        destinationColumns: flattenProgram(program),
        destinationAttributes,
        sourceAttributes: [],
        // attributes: [],
        stages: [],
        uniqueAttributeValues: [],
    };

    if (programMapping.dataSource === "dhis2") {
        const sourceOrgUnits: Array<Option> = getOrgUnits(dhis2Program);
        const attributes = getAttributes(dhis2Program);
        const stages = dhis2Program.programStages?.map(({ id, name }) => {
            const option: Option = {
                label: name,
                value: id,
            };
            return option;
        });
        const stageDataElements = dhis2Program.programStages?.flatMap(
            ({ id: stageId, name: stageName, programStageDataElements }) => {
                return programStageDataElements.map(
                    ({ dataElement: { id, name, code }, compulsory }) => {
                        const option: Option = {
                            label: `${stageName} - ${name}`,
                            value: `${stageId}.${id}`,
                            code,
                            mandatory: compulsory,
                        };
                        return option;
                    }
                );
            }
        );
        if (programMapping.isSource) {
            results = {
                ...results,
                sourceOrgUnits: results.destinationOrgUnits,
                destinationOrgUnits: sourceOrgUnits,
                destinationAttributes: attributes,
                sourceAttributes: results.destinationAttributes,
                destinationColumns: stageDataElements,
                sourceColumns: results.destinationColumns,
                stages: stages,
            };
        } else {
            results = {
                ...results,
                sourceOrgUnits,
                sourceAttributes: attributes,
                sourceColumns: stageDataElements,
                stages: stages,
            };
        }
    } else if (programMapping.dataSource === "godata") {
        let units = [];
        let columns = [];
        if (remoteOrganisations.length > 0) {
            units = remoteOrganisations.map((v: any) => {
                const label = v["name"] || "";
                const value = v["id"] || "";
                return { label, value };
            });
        }
        const attributes = createOptions(GO_DATA_DEFAULT_FIELDS);
        if (goData && goData.caseInvestigationTemplate) {
            columns = goData.caseInvestigationTemplate.map(
                ({ variable, required }) => {
                    const opt: Option = {
                        label: variable,
                        value: variable,
                        mandatory: required,
                    };
                    return opt;
                }
            );

            columns = [...attributes, ...columns];
        }

        if (programMapping.isSource) {
            results = {
                ...results,
                destinationOrgUnits: units,
                sourceOrgUnits: results.destinationOrgUnits,
                sourceAttributes: results.destinationAttributes,
                sourceColumns: results.destinationColumns,
                destinationColumns: columns,
                destinationAttributes: attributes,
            };
        } else {
            results = {
                ...results,
                sourceOrgUnits: units,
                sourceColumns: columns,
                sourceAttributes: attributes,
            };
        }
    } else if (programMapping.orgUnitColumn) {
        let columns: Array<Option> = [];
        if (data.length > 0) {
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
            ["api", "manual"].indexOf(programMapping.orgUnitSource) !== -1 &&
            remoteOrganisations.length > 0 &&
            programMapping.remoteOrgUnitLabelField &&
            programMapping.remoteOrgUnitValueField
        ) {
            units = remoteOrganisations.map((v: any) => {
                const label = v[programMapping.remoteOrgUnitLabelField] || "";
                const value = v[programMapping.remoteOrgUnitValueField] || "";
                return { label, value };
            });
        } else {
            units = uniqBy(
                "value",
                data.map((d) => {
                    const option: Option = {
                        label: getOr("", programMapping.orgUnitColumn || "", d),
                        value: getOr("", programMapping.orgUnitColumn || "", d),
                    };
                    return option;
                })
            );
        }
        const uniqueAttributeValues = data.flatMap((d) => {
            const values = Object.entries(attributeMapping).flatMap(
                ([attribute, mapping]) => {
                    const { unique, value } = mapping;
                    if (unique && value) {
                        return { attribute, value: getOr("", value, d) };
                    }
                    return [];
                }
            );
            return values;
        });
        if (programMapping.isSource) {
            results = {
                ...results,
                destinationOrgUnits: units,
                sourceOrgUnits: results.destinationOrgUnits,
                sourceAttributes: results.destinationAttributes,
                destinationColumns: columns,
                // destinationAttributes:att
                uniqueAttributeValues,
            };
        } else {
            results = {
                ...results,
                sourceOrgUnits: units,
                // columns,
                // attributes: columns,
                uniqueAttributeValues,
            };
        }
    }
    return results;
};

export const makeRemoteApi = (
    authentication: Partial<Authentication> | undefined
) => {
    if (!isEmpty(authentication) && authentication.url) {
        let params = new URLSearchParams();
        Object.values(authentication.params || {}).forEach(
            ({ param, value }) => {
                if (param && value) {
                    params.append(param, value);
                }
            }
        );
        if (
            authentication.basicAuth &&
            authentication.username &&
            authentication.password
        ) {
            return axios.create({
                baseURL: authentication.url,
                auth: {
                    username: authentication.username,
                    password: authentication.password,
                },
                params,
            });
        }
        return axios.create({
            baseURL: authentication.url,
            params,
        });
    }
    return undefined;
};

export const makeValidation = (state: Partial<IProgram>) => {
    const { programTrackedEntityAttributes, programStages } = state;
    let attributes: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}> = z.object(
        {}
    );
    let elements: Dictionary<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>> =
        {};
    if (programTrackedEntityAttributes) {
        attributes = z.object(
            programTrackedEntityAttributes?.reduce(
                (
                    agg,
                    {
                        mandatory,
                        trackedEntityAttribute: { id, valueType, unique },
                    }
                ) => {
                    let zodType = ValueType[valueType];
                    if (!(mandatory || unique)) {
                        zodType.optional();
                    }
                    return { ...agg, [id]: zodType };
                },
                {}
            )
        );
    }
    if (programStages) {
        elements = fromPairs(
            programStages.map(({ id, programStageDataElements }) => {
                const type = z.object(
                    programStageDataElements.reduce(
                        (agg, { dataElement: { id } }) => ({
                            ...agg,
                            [id]: z.string(),
                        }),
                        {}
                    )
                );

                return [id, type];
            })
        );
    }
    return { elements, attributes };
};

export const canQueryDHIS2 = (state: Partial<IProgramMapping>) => {
    if (
        state.dataSource === "api" &&
        state.authentication?.url &&
        state.authentication?.username &&
        state.authentication?.password &&
        state.isDHIS2
    ) {
        return true;
    }
    return false;
};

export const programUniqAttributes = (attributeMapping: Mapping) => {
    return Object.entries(attributeMapping).flatMap(([attribute, mapping]) => {
        const { unique, value } = mapping;
        if (unique && value) {
            return attribute;
        }
        return [];
    });
};

export const programUniqColumns = (attributeMapping: Mapping) => {
    return Object.entries(attributeMapping).flatMap(([_, mapping]) => {
        const { unique, value } = mapping;
        if (unique && value) {
            return value;
        }
        return [];
    });
};

export const programStageUniqColumns = (programStageMapping: StageMapping) => {
    const uniqElements = Object.entries(programStageMapping).map(
        ([stage, mapping]) => {
            const { info, ...elements } = mapping;
            const eventDateIsUnique = info.eventDateIsUnique;
            let uniqueColumns = Object.entries(elements).flatMap(
                ([_, { unique, value }]) => {
                    if (unique && value) {
                        return value;
                    }
                    return [];
                }
            );
            if (eventDateIsUnique) {
                uniqueColumns = [...uniqueColumns, info.eventDateColumn || ""];
            }

            return [stage, uniqueColumns];
        }
    );
    return fromPairs(uniqElements);
};

export const programStageUniqElements = (programStageMapping: StageMapping) => {
    const uniqElements = Object.entries(programStageMapping).map(
        ([stage, mapping]) => {
            const { info, ...elements } = mapping;
            const eventDateIsUnique = info.eventDateIsUnique;
            let uniqueColumns = Object.entries(elements).flatMap(
                ([element, { unique, value }]) => {
                    if (unique && value) {
                        return element;
                    }
                    return [];
                }
            );
            if (eventDateIsUnique) {
                uniqueColumns = [...uniqueColumns, "eventDate"];
            }

            return [stage, uniqueColumns];
        }
    );
    return fromPairs(uniqElements);
};

export const columns = (state: any[]) => {
    if (state.length > 0) {
        return Object.keys(state[0]).map((key) => {
            const option: Option = {
                label: key,
                value: key,
            };
            return option;
        });
    }
    return [];
};

export const isDisabled = (
    programMapping: Partial<IProgramMapping>,
    step: number,
    mySchema: z.ZodSchema
) => {
    if (
        programMapping.dataSource === "api" &&
        step === 2 &&
        mySchema.safeParse(programMapping.authentication?.url).success === false
    ) {
        return true;
    }
    return false;
};

export const findColumns = (state: any[]) => {
    if (state.length > 0) {
        return Object.keys(state[0]).map((key) => {
            const option: Option = {
                label: key,
                value: key,
            };
            return option;
        });
    }
    return [];
};

export const label = (
    step: number,
    programMapping: Partial<IProgramMapping>
) => {
    return stepLabels[step];
};

export const flattenProgram = (program: Partial<IProgram>): Array<Option> => {
    if (!isEmpty(program)) {
        const { programTrackedEntityAttributes, programStages } = program;
        const attributes = programTrackedEntityAttributes.map(
            ({ trackedEntityAttribute: { id, name } }) => {
                const option: Option = { label: name, value: id };
                return option;
            }
        );
        const elements = programStages.flatMap(
            ({ id: stageId, name: stageName, programStageDataElements }) => {
                const dataElements = programStageDataElements.map(
                    ({ dataElement: { id, name } }) => {
                        const option: Option = {
                            label: `${stageName}-${name}`,
                            value: `${stageId}.${id}`,
                        };
                        return option;
                    }
                );

                return [
                    ...dataElements,
                    {
                        label: `${stageName}-Event`,
                        value: `${stageId}.event`,
                    },
                    {
                        label: `${stageName}-Event Date`,
                        value: `${stageId}.eventDate`,
                    },
                ];
            }
        );

        return [
            ...attributes,
            {
                label: "Tracked Entity Instance",
                value: "trackedEntityInstance",
            },
            {
                label: "Organisation Unit",
                value: "orgUnit",
            },
            {
                label: "Enrollment Date",
                value: "enrollmentDate",
            },
            {
                label: "Incident Date",
                value: "incidentDate",
            },
            ...elements,
        ];
    }
    return [];
};
