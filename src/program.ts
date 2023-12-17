import { AxiosInstance } from "axios";
import { format, parseISO } from "date-fns/fp";
import { Dictionary, isArray, maxBy, minBy } from "lodash";
import {
    chunk,
    fromPairs,
    getOr,
    groupBy,
    isEmpty,
    uniqBy,
    update,
} from "lodash/fp";
import { z } from "zod";
import {
    GO_DATA_EPIDEMIOLOGY_FIELDS,
    GO_DATA_EVENTS_FIELDS,
    GO_DATA_LAB_FIELDS,
    GO_DATA_PERSON_FIELDS,
    GO_DATA_RELATIONSHIP_FIELDS,
} from "./constants";
import {
    Authentication,
    CaseInvestigationTemplate,
    DHIS2OrgUnit,
    DataValue,
    Enrollment,
    Event,
    FlattenedEvent,
    FlattenedInstance,
    GODataTokenGenerationResponse,
    GoDataEvent,
    GoResponse,
    IGoData,
    IGoDataData,
    IMapping,
    IProgram,
    IProgramMapping,
    IProgramStage,
    Mapping,
    Option,
    ProgramMetadata,
    StageMapping,
    TrackedEntityInstance,
    ValueType,
} from "./interfaces";
import { generateUid } from "./uid";
import {
    evaluateMapping,
    fetchRemote,
    findChanges,
    findUpdates,
    postRemote,
} from "./utils";
import { diff } from "jiff";

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

const parseAndFormatDate = (date: string) => {
    const parsedDate = Date.parse(date);
    if (Number.isNaN(parsedDate)) {
        return new Date(parsedDate);
    }
};

const processEvents = (
    data: any[],
    programStageMapping: { [key: string]: Mapping },
    trackedEntityInstance: string,
    enrollment: string,
    orgUnit: string,
    program: string,
    previousEvents: Dictionary<{
        [key: string]: { [key: string]: any };
    }>,
    stages: Dictionary<IProgramStage>,
    options: Dictionary<string>
) => {
    return Object.entries(programStageMapping).flatMap(
        ([programStage, mapping]) => {
            const { repeatable } = stages[programStage];
            const stagePreviousEvents = previousEvents[programStage] || {};
            let currentData = fromPairs([["all", data]]);
            const { info, ...elements } = mapping;
            const {
                createEvents,
                eventDateColumn,
                updateEvents,
                eventIdColumn,
                eventDateIsUnique,
            } = info;

            if ((createEvents || updateEvents) && eventDateColumn) {
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

                if (uniqueColumns.length > 0) {
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
                                                const val = getOr(
                                                    "",
                                                    value,
                                                    row
                                                );

                                                if (val) {
                                                    return {
                                                        dataElement,
                                                        value:
                                                            options[val] || val,
                                                    };
                                                }
                                                return [];
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
                    const prev = Object.values(stagePreviousEvents);
                    const currentEvents = currentRow.flatMap((row) => {
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
                                            const val = getOr("", value, row);

                                            if (val) {
                                                return {
                                                    dataElement,
                                                    value: options[val] || val,
                                                };
                                            }
                                            return [];
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
                    if (prev.length === 0) {
                        return currentEvents;
                    } else {
                        const [{ event, eventDate, ...rest }] = prev;
                        const [{ dataValues, event: e, ...others }] =
                            currentEvents;
                        const currentDataValues = fromPairs(
                            dataValues.map((d: any) => [d.dataElement, d.value])
                        );
                        const difference = diff(rest, currentDataValues);
                        const filteredDifferences = difference.filter(
                            ({ op }) =>
                                ["add", "replace", "copy"].indexOf(op) !== -1
                        );
                        console.log("are we here");
                        if (filteredDifferences.length > 0) {
                            console.log("Some differences");
                            return {
                                event,
                                eventDate,
                                ...others,
                                dataValues: Object.entries({
                                    ...rest,
                                    ...currentDataValues,
                                }).map(([dataElement, value]) => ({
                                    dataElement,
                                    value,
                                })),
                            };
                        }
                        return [];
                    }
                }
                return [];
            }

            return [];
        }
    );
};

export const convertFromDHIS2 = async (
    data: Array<Partial<FlattenedInstance>>,
    mapping: Partial<IMapping>,
    organisationUnitMapping: Mapping,
    attributeMapping: Mapping,
    addALlData: boolean = false,
    optionMapping: Record<string, string>
) => {
    const flippedOptions = fromPairs(
        Object.entries(optionMapping).map(([option, value]) => {
            return [value, option];
        })
    );
    return data.map((instanceData) => {
        let obj: { [key: string]: any } = {};

        if (mapping.orgUnitColumn) {
            update(
                mapping.orgUnitColumn,
                () => organisationUnitMapping[instanceData.orgUnit],
                obj
            );
        }
        if (mapping.program.incidentDateColumn) {
            update(
                mapping.program.incidentDateColumn,
                () => instanceData.enrollment.incidentDate,
                obj
            );
        }
        if (mapping.program.enrollmentDateColumn) {
            update(
                mapping.program.enrollmentDateColumn,
                () => instanceData.enrollment.enrollmentDate,
                obj
            );
        }
        if (mapping.program.trackedEntityInstanceColumn) {
            update(
                mapping.program.trackedEntityInstanceColumn,
                () => instanceData.trackedEntityInstance,
                obj
            );
        }
        Object.entries(attributeMapping).forEach(([attribute, mapping]) => {
            if (mapping.value) {
                if (mapping.specific) {
                    obj = { ...obj, [attribute]: mapping.value };
                } else {
                    obj = {
                        ...obj,
                        [attribute]:
                            flippedOptions[instanceData[mapping.value]] ||
                            instanceData[mapping.value] ||
                            "",
                    };
                }
            } else {
                obj = { ...obj, [attribute]: "" };
            }
        });

        if (addALlData) {
            obj = { ...obj, ...instanceData };
        }
        return obj;
    });
};

export const convertToGoData = (
    data: Array<Partial<FlattenedInstance>>,
    organisationUnitMapping: Mapping,
    attributeMapping: Mapping,
    goData: Partial<IGoData>,
    optionMapping: Record<string, string>,
    tokens: Dictionary<string>,
    previousData: GoResponse
) => {
    const uniqAttributes = programUniqAttributes(attributeMapping);
    const uniqColumns = programUniqColumns(attributeMapping);
    const flippedUnits = fromPairs(
        Object.entries(organisationUnitMapping).map(([unit, value]) => {
            return [value.value, unit];
        })
    );
    const flippedOptions = fromPairs(
        Object.entries(optionMapping).map(([option, value]) => {
            return [value, option];
        })
    );

    let errors: GoResponse = {
        person: [],
        epidemiology: [],
        events: [],
        relationships: [],
        lab: [],
        questionnaire: [],
    };

    let conflicts: GoResponse = {
        person: [],
        epidemiology: [],
        events: [],
        relationships: [],
        lab: [],
        questionnaire: [],
    };

    let processed: { updates: GoResponse; inserts: GoResponse } = {
        updates: {
            person: [],
            epidemiology: [],
            events: [],
            relationships: [],
            lab: [],
            questionnaire: [],
        },
        inserts: {
            person: [],
            epidemiology: [],
            events: [],
            relationships: [],
            lab: [],
            questionnaire: [],
        },
    };
    data.forEach((instanceData) => {
        const all = [
            GO_DATA_PERSON_FIELDS,
            GO_DATA_EPIDEMIOLOGY_FIELDS,
            GO_DATA_EVENTS_FIELDS,
            GO_DATA_RELATIONSHIP_FIELDS,
            GO_DATA_LAB_FIELDS,
            flattenGoData(goData.caseInvestigationTemplate, tokens),
        ].map((fields) =>
            evaluateMapping(
                attributeMapping,
                fields,
                instanceData,
                flippedOptions,
                flippedUnits,
                uniqAttributes,
                uniqColumns
            )
        );
        const [
            person,
            epidemiology,
            events,
            relationships,
            lab,
            questionnaire,
        ] = all;

        const {
            person: prevPeople,
            epidemiology: prevEpidemiology,
            events: prevEvents,
            relationships: prevRelationships,
            lab: prevLab,
            questionnaire: prevQuestionnaire,
        } = previousData;

        if (!isEmpty(person.results)) {
            const processedPerson = findUpdates(
                prevPeople,
                person.results,
                uniqAttributes.join("")
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,
                    person: [
                        ...processed.updates.person,
                        ...processedPerson.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,
                    person: [
                        ...processed.inserts.person,
                        ...processedPerson.insert,
                    ],
                },
            };
        }
        if (!isEmpty(epidemiology.results)) {
            const processedEpidemiology = findUpdates(
                prevEpidemiology,
                epidemiology.results,
                uniqAttributes.join("")
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,

                    epidemiology: [
                        ...processed.updates.epidemiology,
                        ...processedEpidemiology.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,

                    epidemiology: [
                        ...processed.inserts.epidemiology,
                        ...processedEpidemiology.insert,
                    ],
                },
            };
        }
        if (!isEmpty(events.results)) {
            const processedEvents = findUpdates(
                prevEvents,
                events.results,
                uniqAttributes.join("")
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,

                    events: [
                        ...processed.updates.events,
                        ...processedEvents.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,

                    events: [
                        ...processed.inserts.events,
                        ...processedEvents.insert,
                    ],
                },
            };
        }
        if (!isEmpty(relationships.results)) {
            const processedRelationships = findUpdates(
                prevRelationships,
                relationships.results,
                uniqAttributes.join("")
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,

                    relationships: [
                        ...processed.updates.relationships,
                        ...processedRelationships.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,

                    relationships: [
                        ...processed.inserts.relationships,
                        ...processedRelationships.insert,
                    ],
                },
            };
        }
        if (!isEmpty(lab.results)) {
            const processedLab = findUpdates(
                prevLab,
                lab.results,
                uniqAttributes.join("")
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,
                    lab: [...processed.updates.lab, ...processedLab.update],
                },

                inserts: {
                    ...processed.inserts,

                    lab: [...processed.inserts.lab, ...processedLab.insert],
                },
            };
        }

        if (!isEmpty(questionnaire.results)) {
            const processedPrevious = prevQuestionnaire.map(
                ({ id, visualId, ...rest }: any) => {
                    return {
                        id,
                        visualId,
                        ...fromPairs(
                            Object.entries(rest).map(([key, value]) => {
                                if (
                                    value &&
                                    isArray(value) &&
                                    !isEmpty(value[0])
                                ) {
                                    return [key, value[0].value];
                                }
                                return [];
                            })
                        ),
                    };
                }
            );
            const processedQuestionnaire = findUpdates(
                processedPrevious,
                questionnaire.results,
                uniqAttributes.join("")
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,
                    questionnaire: [
                        ...processed.updates.questionnaire,
                        ...processedQuestionnaire.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,
                    questionnaire: [
                        ...processed.inserts.questionnaire,
                        ...processedQuestionnaire.insert,
                    ],
                },
            };
        }

        errors = {
            ...errors,
            events: [...errors.events, ...events.errors],
            person: [...errors.person, ...person.errors],
            epidemiology: [...errors.epidemiology, ...epidemiology.errors],
            lab: [...errors.lab, ...lab.errors],
            relationships: [...errors.relationships, ...relationships.errors],
            questionnaire: [...errors.questionnaire, ...questionnaire.errors],
        };

        conflicts = {
            ...conflicts,
            events: [...conflicts.events, ...events.conflicts],
            person: [...conflicts.person, ...person.conflicts],
            epidemiology: [
                ...conflicts.epidemiology,
                ...epidemiology.conflicts,
            ],
            lab: [...conflicts.lab, ...lab.conflicts],
            relationships: [
                ...conflicts.relationships,
                ...relationships.conflicts,
            ],
            questionnaire: [
                ...conflicts.questionnaire,
                ...questionnaire.conflicts,
            ],
        };
    });
    return { processed, errors, conflicts };
};
export const convertToDHIS2 = async ({
    program,
    previousData,
    data,
    mapping,
    version,
    attributeMapping,
    programStageMapping,
    organisationUnitMapping,
    optionMapping,
}: {
    previousData: {
        attributes: Dictionary<Array<{ attribute: string; value: string }>>;
        dataElements: Dictionary<
            Dictionary<{
                [key: string]: { [key: string]: any };
            }>
        >;
        enrollments: Dictionary<string>;
        trackedEntities: Dictionary<string>;
        orgUnits: Dictionary<string>;
    };
    data: any[];
    mapping: Partial<IMapping>;
    organisationUnitMapping: Mapping;
    attributeMapping: Mapping;
    programStageMapping: StageMapping;
    optionMapping: Record<string, string>;
    version: number;
    program: Partial<IProgram>;
}) => {
    const attributes = fromPairs(
        getAttributes(program).map((a) => [a.value, a])
    );
    const uniqAttributes = programUniqAttributes(attributeMapping);
    const uniqStageElements = programStageUniqElements(programStageMapping);
    const uniqColumns = programUniqColumns(attributeMapping);
    const uniqStageColumns = programStageUniqColumns(programStageMapping);
    const {
        onlyEnrollOnce,
        selectEnrollmentDatesInFuture,
        selectIncidentDatesInFuture,
        programTrackedEntityAttributes,
        programStages,
    } = program;

    const stages = fromPairs(
        programStages.map((programStage) => {
            return [programStage.id, programStage];
        })
    );

    const { createEntities, createEnrollments, updateEntities } =
        mapping.program;

    const flippedUnits = fromPairs(
        Object.entries(organisationUnitMapping).map(([unit, value]) => {
            return [value.value, unit];
        })
    );

    const flippedOptions = fromPairs(
        Object.entries(optionMapping).map(([option, value]) => {
            return [value, option];
        })
    );

    const orgUnitColumn = mapping.orgUnitColumn || "";
    const enrollmentDateColumn = mapping.program.enrollmentDateColumn || "";
    const incidentDateColumn = mapping.program.incidentDateColumn || "";
    let groupedData: Dictionary<any[]> = {};

    if (uniqColumns.length > 0) {
        groupedData = groupBy(
            (item: any) =>
                uniqColumns
                    .map((column) => getOr("", column, item))
                    .sort()
                    .join(""),
            data
        );
    } else {
        groupedData = groupBy(
            "id",
            data.map((d) => {
                return { id: generateUid(), ...d };
            })
        );
    }
    const processed = Object.entries(groupedData).flatMap(
        ([uniqueKey, current]) => {
            let currentConflicts: any[] = [];
            let currentErrors: any[] = [];
            let results: {
                enrollments: Array<Partial<Enrollment>>;
                trackedEntities: Array<Partial<TrackedEntityInstance>>;
                events: Array<Partial<Event>>;
                eventUpdates: Array<Partial<Event>>;
                trackedEntityUpdates: Array<Partial<TrackedEntityInstance>>;
                conflicts: any[];
                errors: any[];
            } = {
                enrollments: [],
                trackedEntities: [],
                events: [],
                eventUpdates: [],
                trackedEntityUpdates: [],
                errors: [],
                conflicts: [],
            };
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

            let previousOrgUnit = getOr("", uniqueKey, previousData.orgUnits);

            const previousAttributes = getOr(
                [],
                uniqueKey,
                previousData.attributes
            );

            let source = {};
            Object.entries(attributeMapping).forEach(
                ([attribute, aMapping]) => {
                    const currentAttribute = attributes[attribute];
                    if (aMapping.value) {
                        const validation = ValueType[aMapping.valueType];
                        let value = getOr("", aMapping.value, current[0]);
                        if (aMapping.specific) {
                            value = aMapping.value;
                        }
                        let result: any = { success: true };

                        if (
                            currentAttribute &&
                            currentAttribute.optionSetValue
                        ) {
                            value = flippedOptions[value] || value;
                            if (
                                currentAttribute.availableOptions.findIndex(
                                    (v: Option) =>
                                        v.code === value ||
                                        v.id === value ||
                                        v.value === value
                                ) !== -1
                            ) {
                                result = { ...result, success: true };
                            } else {
                                if (aMapping.mandatory) {
                                    currentErrors = [
                                        ...currentErrors,
                                        {
                                            id: Date.now() + Math.random(),
                                            value,
                                            attribute,
                                            valueType:
                                                currentAttribute.valueType,
                                            message: `Expected values (${currentAttribute.availableOptions
                                                .map(({ value }) => value)
                                                .join(",")})`,
                                        },
                                    ];
                                } else if (value) {
                                    currentConflicts = [
                                        ...currentConflicts,
                                        {
                                            id: Date.now() + Math.random(),
                                            value,
                                            attribute,
                                            valueType:
                                                currentAttribute.valueType,
                                            message: `Expected values (${currentAttribute.availableOptions
                                                .map(({ value }) => value)
                                                .join(",")})`,
                                        },
                                    ];
                                }
                                result = { ...result, success: false };
                            }
                        } else if (validation) {
                            try {
                                result = validation.parse(value);
                                result = { ...result, success: true };
                            } catch (error) {
                                const { issues } = error;
                                result = { ...issues[0], success: false };
                                if (aMapping.mandatory) {
                                    currentErrors = [
                                        ...currentErrors,
                                        ...issues.map((i: any) => ({
                                            ...i,
                                            value,
                                            attribute,
                                            valueType: aMapping.valueType,
                                            id: Date.now() + Math.random(),
                                        })),
                                    ];
                                } else if (value) {
                                    currentConflicts = [
                                        ...currentConflicts,
                                        ...issues.map((i: any) => ({
                                            ...i,
                                            value,
                                            attribute,
                                            valueType: aMapping.valueType,
                                            id: Date.now() + Math.random(),
                                        })),
                                    ];
                                }
                            }
                        }
                        if (value && result.success) {
                            source = {
                                ...source,
                                [attribute]: value,
                            };
                        }
                    }
                }
            );

            const destination = fromPairs(
                previousAttributes.map(({ attribute, value }) => [
                    attribute,
                    value,
                ])
            );

            const differences = findChanges({
                destination,
                source,
            });

            const difference = diff(destination, source);
            const filteredDifferences = difference.filter(
                ({ op }) => ["add", "replace", "copy"].indexOf(op) !== -1
            );
            if (
                previousAttributes.length > 0 &&
                updateEntities &&
                currentErrors.length === 0
            ) {
                if (!isEmpty(differences)) {
                    const attributes = Object.entries({
                        ...destination,
                        ...differences,
                    }).map(([attribute, value]) => ({ attribute, value }));
                    results = {
                        ...results,
                        trackedEntityUpdates: [
                            {
                                trackedEntityInstance: previousTrackedEntity,
                                attributes,
                                trackedEntityType:
                                    mapping.program.trackedEntityType,
                                orgUnit: previousOrgUnit,
                            },
                        ],
                    };
                }
            } else if (
                previousAttributes.length === 0 &&
                createEntities &&
                currentErrors.length === 0
            ) {
                previousOrgUnit = getOr(
                    "",
                    getOr("", orgUnitColumn, current[0]),
                    flippedUnits
                );
                previousTrackedEntity = generateUid();
                if (previousOrgUnit) {
                    results = {
                        ...results,
                        trackedEntities: [
                            {
                                trackedEntityInstance: previousTrackedEntity,
                                attributes: Object.entries({
                                    ...differences,
                                }).map(([attribute, value]) => ({
                                    attribute,
                                    value,
                                })),
                                trackedEntityType:
                                    mapping.program.trackedEntityType,
                                orgUnit: previousOrgUnit,
                            },
                        ],
                    };
                } else {
                    currentErrors = [
                        ...currentErrors,
                        {
                            value: "Missing",
                            attribute: "OrgUnit",
                        },
                    ];
                }
            }
            if (createEnrollments && isEmpty(previousEnrollment)) {
                const enrollmentDate = getOr(
                    "",
                    enrollmentDateColumn,
                    current[0]
                );
                const incidentDate = getOr("", incidentDateColumn, current[0]);
                if (previousOrgUnit && enrollmentDate && incidentDate) {
                    previousEnrollment = generateUid();
                    const enrollment = {
                        program: mapping.program.program,
                        trackedEntityInstance: previousTrackedEntity,
                        orgUnit: previousOrgUnit,
                        enrollmentDate: format(
                            "yyyy-MM-dd",
                            parseISO(enrollmentDate)
                        ),
                        incidentDate: format(
                            "yyyy-MM-dd",
                            parseISO(incidentDate)
                        ),
                        enrollment: previousEnrollment,
                    };

                    results = { ...results, enrollments: [enrollment] };
                } else {
                    currentErrors = [
                        ...currentErrors,
                        {
                            value: "Missing",
                            attribute: "enrollment date and/or incident date",
                        },
                    ];
                }
            } else if (!isEmpty(previousEnrollment)) {
            }

            let events = [];
            if (
                previousOrgUnit &&
                previousEnrollment &&
                previousTrackedEntity
            ) {
                events = processEvents(
                    current,
                    programStageMapping,
                    previousTrackedEntity,
                    previousEnrollment,
                    previousOrgUnit,
                    mapping.program.program || "",
                    getOr({}, uniqueKey, previousData.dataElements),
                    stages,
                    flippedOptions
                );
            }
            results = {
                ...results,
                events,
                conflicts: currentConflicts,
                errors: currentErrors,
            };
            return results;
        }
    );

    const trackedEntityInstances = processed.flatMap(
        ({ trackedEntities }) => trackedEntities
    );
    const enrollments = processed.flatMap(({ enrollments }) => enrollments);
    const errors = processed.flatMap(({ errors }) => errors);
    const conflicts = processed.flatMap(({ conflicts }) => conflicts);
    const events = processed.flatMap(({ events }) => events.flat());
    const trackedEntityInstanceUpdates = processed.flatMap(
        ({ trackedEntityUpdates }) => trackedEntityUpdates
    );
    const eventUpdates = processed.flatMap(({ eventUpdates }) =>
        eventUpdates.flat()
    );
    return {
        trackedEntityInstances,
        events,
        enrollments,
        trackedEntityInstanceUpdates,
        eventUpdates,
        errors,
        conflicts,
    };
};

export const processPreviousInstances = (
    trackedEntityInstances: TrackedEntityInstance[],
    programUniqAttributes: string[],
    programStageUniqueElements: Dictionary<string[]>,
    currentProgram: string
) => {
    let currentAttributes: Array<[string, any]> = [];
    let currentElements: Array<[string, any]> = [];
    let currentEnrollments: Array<[string, string]> = [];
    let currentTrackedEntities: Array<[string, string]> = [];
    let currentOrgUnits: Array<[string, string]> = [];
    trackedEntityInstances.forEach(
        ({ enrollments, attributes, trackedEntityInstance, orgUnit }) => {
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
            currentAttributes.push([
                attributeKey,
                attributes.map(({ attribute, value }) => ({
                    attribute,
                    value,
                })),
            ]);
            currentOrgUnits.push([attributeKey, String(orgUnit)]);

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
                            const elements = availableEvents.map((event) => {
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
                                            stageElements &&
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

                                return [dataElementKey, fromPairs(finalValues)];
                            });
                            return [[stage, fromPairs(elements)]];
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
                [key: string]: { [key: string]: any };
            }>
        >(currentElements),
        enrollments: fromPairs<string>(currentEnrollments),
        trackedEntities: fromPairs<string>(currentTrackedEntities),
        orgUnits: fromPairs<string>(currentOrgUnits),
    };
};

const flattenEvent = ({
    dataValues,
    programStage,
    enrollment,
    ...rest
}: Partial<Event>): Partial<FlattenedEvent> => {
    return {
        [programStage]: {
            ...rest,
            programStage,
            values: fromPairs(
                dataValues.map(({ dataElement, value }) => [dataElement, value])
            ),
        },
    };
};

export const flattenEvents = (
    events: Array<Partial<Event>>
): Array<Partial<FlattenedInstance>> =>
    events.map((e) => ({ last: flattenEvent(e) }));

export const flattenTrackedEntityInstances = (response: {
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
}): Array<Partial<FlattenedInstance>> => {
    return response.trackedEntityInstances.map(
        ({ attributes, enrollments, ...otherAttributes }) => {
            const attributeValues = fromPairs(
                attributes.map(({ attribute, value }) => [attribute, value])
            );
            let current: Partial<FlattenedInstance> = {
                ...otherAttributes,
                attribute: attributeValues,
            };
            let first = {};
            let last = {};
            if (enrollments.length > 0) {
                const [{ events, ...enrollmentData }] = enrollments;
                current = { ...current, enrollment: enrollmentData };
                Object.entries(groupBy("programStage", events)).forEach(
                    ([_, currentEvents]) => {
                        const currentLast = maxBy(currentEvents, "eventDate");
                        const currentFirst = minBy(currentEvents, "eventDate");
                        first = { ...first, ...flattenEvent(currentFirst) };
                        last = { ...last, ...flattenEvent(currentLast) };
                    }
                );
            }

            return { ...current, first, last };
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
const getAttributes = (program: Partial<IProgram>): Array<Option> => {
    if (!isEmpty(program) && program.programTrackedEntityAttributes) {
        return program.programTrackedEntityAttributes.map(
            ({
                mandatory,
                trackedEntityAttribute: {
                    id,
                    name,
                    code,
                    unique,
                    optionSetValue,
                    optionSet,
                },
            }) => {
                return {
                    label: name,
                    value: id,
                    code,
                    unique,
                    mandatory,
                    optionSetValue,
                    availableOptions:
                        optionSet?.options.map(({ code, id, name }) => ({
                            label: name,
                            code,
                            value: code,
                            id,
                        })) || [],
                };
            }
        );
    }
    return [];
};

export const flattenGoData = (
    caseInvestigationTemplates: CaseInvestigationTemplate[],
    tokens: Dictionary<string> = {}
) => {
    return caseInvestigationTemplates.flatMap(
        ({
            variable,
            required,
            multiAnswer,
            answers,
            answerType,
            text,
        }): Option[] => {
            const original = tokens[text] || variable;
            if (
                answerType ===
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MULTIPLE_ANSWERS"
            ) {
                return answers.flatMap(
                    ({ additionalQuestions, value, order, alert, label }) => {
                        const currentLabel = tokens[label] || label;
                        const currentOpt = {
                            label: `${original} ${currentLabel}`,
                            value: `questionnaireAnswers.${value}[0].value`,
                            mandatory: false,
                            availableOptions: [],
                            optionSetValue: false,
                            parent: variable,
                        };
                        if (additionalQuestions) {
                            const additional = additionalQuestions.map(
                                ({ variable, text }) => {
                                    return {
                                        label: tokens[text] || variable,
                                        value: `questionnaireAnswers.${variable}[0].value`,
                                    };
                                }
                            );
                            return [currentOpt, ...additional];
                        }
                        return currentOpt;
                    }
                );
            } else {
                return [
                    {
                        label: tokens[text] || variable,
                        value: variable,
                        mandatory: required,
                        availableOptions: answers.map(({ value, label }) => ({
                            value: `questionnaireAnswers.${variable}[0].value`,
                            label: value,
                            name: value,
                            code: "",
                            id: value,
                        })),
                        optionSetValue: answers.length > 0,
                    },
                    ...answers.flatMap(({ additionalQuestions }) => {
                        if (additionalQuestions) {
                            return additionalQuestions.map(
                                ({ variable, text }) => {
                                    return {
                                        label: tokens[text] || variable,
                                        value: `questionnaireAnswers.${variable}[0].value`,
                                    };
                                }
                            );
                        }
                        return [];
                    }),
                ];
            }
        }
    );
};
export const findUniqAttributes = (data: any[], attributeMapping: Mapping) => {
    return data.flatMap((d) => {
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
};

export const makeMetadata = (
    program: Partial<IProgram>,
    programMapping: Partial<IMapping>,
    {
        data,
        attributeMapping,
        dhis2Program,
        programStageMapping,
        goData,
        tokens,
        remoteOrganisations,
    }: Partial<{
        data: any[];
        dhis2Program: Partial<IProgram>;
        programStageMapping: StageMapping;
        attributeMapping: Mapping;
        remoteOrganisations: any[];
        goData: Partial<IGoData>;
        tokens: Dictionary<string>;
    }>
) => {
    const destinationOrgUnits = getOrgUnits(program);
    const destinationAttributes = getAttributes(program).sort((a, b) => {
        if (a.mandatory && !b.mandatory) {
            return -1;
        } else if (!a.mandatory && b.mandatory) {
            return 1;
        }
        return 0;
    });
    const uniqueAttributeValues = findUniqAttributes(data, attributeMapping);
    const destinationStages =
        program?.programStages?.map(({ id, name }) => {
            const option: Option = {
                label: name,
                value: id,
            };
            return option;
        }) || [];
    const results: ProgramMetadata = {
        sourceOrgUnits: [],
        destinationOrgUnits,
        sourceColumns: [],
        destinationColumns: flattenProgram(program),
        destinationAttributes,
        sourceAttributes: [],
        destinationStages,
        sourceStages: [],
        uniqueAttributeValues,
        epidemiology: [],
        case: [],
        questionnaire: [],
        events: [],
        lab: [],
        relationship: [],
        contact: [],
    };

    if (programMapping.dataSource === "dhis2-program") {
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
    } else if (programMapping.dataSource === "go-data") {
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
        ];
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
        });
        results.case = uniqBy(
            "value",
            GO_DATA_PERSON_FIELDS.filter(
                ({ entity }) => entity && entity.indexOf("CASE") !== -1
            )
        ).sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        });
        results.contact = uniqBy(
            "value",
            GO_DATA_PERSON_FIELDS.filter(
                ({ entity }) => entity && entity.indexOf("CONTACT") !== -1
            )
        ).sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        });
        results.events = uniqBy("value", [
            ...attributes.filter(
                ({ entity }) => entity && entity.indexOf("EVENT") !== -1
            ),
            ...GO_DATA_EVENTS_FIELDS,
        ]).sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        });
        results.lab = GO_DATA_LAB_FIELDS.sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        });
        results.relationship = GO_DATA_RELATIONSHIP_FIELDS.sort((a, b) => {
            if (a.mandatory && !b.mandatory) {
                return -1;
            } else if (!a.mandatory && b.mandatory) {
                return 1;
            }
            return 0;
        });
        results.questionnaire = investigationTemplate;
    } else {
        let columns: Array<Option> = [];
        if (
            programMapping.program.metadataOptions &&
            programMapping.program.metadataOptions.metadata &&
            programMapping.program.metadataOptions.metadata.length > 0
        ) {
            columns = programMapping.program.metadataOptions.metadata;
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

        results.sourceOrgUnits = units;
        results.sourceColumns = columns;
        results.sourceAttributes = columns;
    }

    if (programMapping.isSource) {
        return {
            sourceColumns: results.destinationColumns,
            destinationColumns: results.sourceColumns,
            sourceOrgUnits: results.destinationOrgUnits,
            destinationOrgUnits: results.sourceOrgUnits,
            sourceAttributes: results.destinationAttributes,
            destinationAttributes: results.sourceAttributes,
            sourceStages: results.destinationStages,
            destinationStages: results.sourceStages,
            uniqueAttributeValues,
            epidemiology: results.epidemiology,
            case: results.case,
            contact: results.contact,
            questionnaire: results.questionnaire,
            events: results.events,
            lab: results.lab,
            relationship: results.relationship,
        };
    }
    return results;
};

export const makeValidation = (state: Partial<IProgram>) => {
    const { programTrackedEntityAttributes, programStages } = state;
    let attributes = z.object({});
    let elements: Dictionary<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>> =
        {};
    if (programTrackedEntityAttributes) {
        attributes = z.object(
            programTrackedEntityAttributes?.reduce(
                (
                    agg,
                    {
                        mandatory,
                        trackedEntityAttribute: {
                            id,
                            valueType,
                            unique,
                            optionSetValue,
                            optionSet,
                        },
                    }
                ) => {
                    let zodType = ValueType[valueType];
                    if (!mandatory) {
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

export const canQueryDHIS2 = (state: Partial<IMapping>) => {
    return (
        state.dataSource === "dhis2-program" &&
        state.authentication?.url &&
        ((state.authentication?.username && state.authentication?.password) ||
            !isEmpty(state.authentication.headers))
    );
};

export const programUniqAttributes = (attributeMapping: Mapping): string[] => {
    return Object.entries(attributeMapping).flatMap(([attribute, mapping]) => {
        const { unique, value } = mapping;
        if (unique && value) {
            return attribute;
        }
        return [];
    });
};

export const mandatoryAttributes = (attributeMapping: Mapping): string[] => {
    return Object.entries(attributeMapping).flatMap(([attribute, mapping]) => {
        const { unique, value, mandatory } = mapping;
        if (unique && value && mandatory) {
            return attribute;
        }
        return [];
    });
};

export const programUniqColumns = (attributeMapping: Mapping): string[] => {
    return Object.entries(attributeMapping).flatMap(([_, mapping]) => {
        const { unique, value } = mapping;
        if (unique && value) {
            return value;
        }
        return [];
    });
};

export const programStageUniqColumns = (
    programStageMapping: StageMapping
): Dictionary<string[]> => {
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

export const programStageUniqElements = (
    programStageMapping: StageMapping
): Dictionary<string[]> => {
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

const validURL = (programMapping: Partial<IMapping>, mySchema: z.ZodSchema) => {
    return mySchema.safeParse(programMapping.authentication?.url).success;
};

const hasLogins = (programMapping: Partial<IMapping>) => {
    if (programMapping.authentication?.basicAuth) {
        return (
            !isEmpty(programMapping.authentication.username) &&
            !isEmpty(programMapping.authentication.password)
        );
    }
    return true;
};

const hasRemote = (programMapping: Partial<IMapping>) => {
    return !isEmpty(programMapping.program.remoteProgram);
};

const hasName = (programMapping: Partial<IMapping>) => {
    return !!programMapping.name && !!programMapping.dataSource;
};

const hasProgram = (programMapping: Partial<IMapping>) =>
    !isEmpty(programMapping.program.program);

const hasOrgUnitColumn = (programMapping: Partial<IMapping>) =>
    !isEmpty(programMapping.orgUnitColumn);

const createEnrollment = (programMapping: Partial<IMapping>) => {
    if (programMapping.program.createEnrollments) {
        return (
            !isEmpty(programMapping.program.enrollmentDateColumn) &&
            !isEmpty(programMapping.program.incidentDateColumn)
        );
    }
    return true;
};

const hasOrgUnitMapping = (
    programMapping: Partial<IMapping>,
    organisationUnitMapping: Mapping
) =>
    createEnrollment(programMapping) &&
    Object.values(organisationUnitMapping).flatMap(({ value }) => {
        if (value) {
            return value;
        }
        return [];
    }).length > 0;

const mandatoryAttributesMapped = (
    destinationFields: Option[],
    attributeMapping: Mapping
) => {
    const mandatoryFields = destinationFields.flatMap(
        ({ mandatory, value }) => {
            if (
                mandatory &&
                attributeMapping[value] &&
                attributeMapping[value].value
            ) {
                return true;
            } else if (mandatory) {
                return false;
            }
            return [];
        }
    );
    if (mandatoryFields.length > 0) {
        return mandatoryFields.every((value) => value === true);
    }
    return true;
};

const mandatoryGoDataMapped = ({
    mapping,
    attributeMapping,
    metadata,
}: {
    mapping: Partial<IMapping>;
    attributeMapping: Mapping;
    metadata: ProgramMetadata;
}) => {
    const allAttributes = Object.keys(attributeMapping);
    const hasLab = metadata.lab.find(
        ({ value }) => allAttributes.indexOf(value) !== -1
    );
    if (mapping.program.responseKey === "EVENT") {
        return mandatoryAttributesMapped(metadata.events, attributeMapping);
    } else if (mapping.program.responseKey === "CASE") {
        if (hasLab) {
            return mandatoryAttributesMapped(
                [...metadata.case, ...metadata.epidemiology, ...metadata.lab],
                attributeMapping
            );
        }
        return mandatoryAttributesMapped(
            [...metadata.case, ...metadata.epidemiology],
            attributeMapping
        );
    } else if (mapping.program.responseKey === "CONTACT") {
        if (hasLab) {
            return mandatoryAttributesMapped(
                [
                    ...metadata.contact,
                    ...metadata.epidemiology,
                    ...metadata.relationship,
                    ...metadata.lab,
                ],
                attributeMapping
            );
        }
        return mandatoryAttributesMapped(
            [
                ...metadata.contact,
                ...metadata.epidemiology,
                ...metadata.relationship,
            ],
            attributeMapping
        );
    }
};

const isValidProgramStage = (
    program: Partial<IProgram>,
    programStageMapping: StageMapping
) => {
    if (isEmpty(programStageMapping)) {
        return true;
    }

    const all = Object.entries(programStageMapping).map(([stage, mapping]) => {
        const { info, ...rest } = mapping || {};
        const currentStage = program.programStages.find(
            ({ id }) => id === stage
        );
        if (
            (info.createEvents || info.updateEvents) &&
            info.eventDateColumn &&
            currentStage
        ) {
            const allCompulsoryMapped =
                currentStage.programStageDataElements.flatMap(
                    ({ compulsory, dataElement: { id } }) => {
                        if (compulsory && rest[id].value) {
                            return true;
                        } else if (compulsory) {
                            return false;
                        }
                        return true;
                    }
                );
            return allCompulsoryMapped.every((e) => e === true);
        } else if (info.createEvents || info.updateEvents) {
            return false;
        }
        return true;
    });
    return all.every((e) => e === true);
};

export const isDisabled = ({
    programMapping,
    programStageMapping,
    attributeMapping,
    organisationUnitMapping,
    step,
    mySchema,
    destinationFields,
    data,
    program,
    metadata,
    hasError,
}: {
    programMapping: Partial<IMapping>;
    programStageMapping: StageMapping;
    attributeMapping: Mapping;
    organisationUnitMapping: Mapping;
    step: number;
    mySchema: z.ZodSchema;
    destinationFields: Option[];
    data: any[];
    program: Partial<IProgram>;
    metadata: ProgramMetadata;
    hasError: boolean;
}) => {
    const allOptions = {
        2: {
            "go-data":
                !hasName(programMapping) ||
                !validURL(programMapping, mySchema) ||
                !hasLogins(programMapping),
            "csv-line-list": data.length === 0 || !hasName(programMapping),
            "xlsx-line-list": data.length === 0 || !hasName(programMapping),
            "dhis2-program": data.length === 0 || !hasName(programMapping),
            json: data.length === 0 || !hasName(programMapping),
            api: data.length === 0 || !hasName(programMapping),
        },
        3: {
            "go-data": !hasProgram(programMapping),
            "csv-line-list": !hasProgram(programMapping),
            "xlsx-line-list": !hasProgram(programMapping),
            "dhis2-program": !hasProgram(programMapping),
            json: !hasProgram(programMapping),
            api: !hasProgram(programMapping),
        },
        4: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
        },
        5: {
            "go-data": !hasRemote(programMapping),
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
        },
        6: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
        },
        7: {
            "go-data": !hasOrgUnitMapping(
                programMapping,
                organisationUnitMapping
            ),
            "csv-line-list": !hasOrgUnitMapping(
                programMapping,
                organisationUnitMapping
            ),
            "xlsx-line-list": !hasOrgUnitMapping(
                programMapping,
                organisationUnitMapping
            ),
            "dhis2-program": !hasOrgUnitMapping(
                programMapping,
                organisationUnitMapping
            ),
            json: !hasOrgUnitMapping(programMapping, organisationUnitMapping),
            api: !hasOrgUnitMapping(programMapping, organisationUnitMapping),
        },
        8: {
            "go-data": !mandatoryGoDataMapped({
                mapping: programMapping,
                attributeMapping,
                metadata,
            }),
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
        },
        9: {
            "go-data": !mandatoryAttributesMapped(
                destinationFields,
                attributeMapping
            ),
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
        },
        10: {
            "go-data": !isValidProgramStage(program, programStageMapping),
            "csv-line-list": !isValidProgramStage(program, programStageMapping),
            "xlsx-line-list": !isValidProgramStage(
                program,
                programStageMapping
            ),
            "dhis2-program": !isValidProgramStage(program, programStageMapping),
            json: !isValidProgramStage(program, programStageMapping),
            api: !isValidProgramStage(program, programStageMapping),
        },
        11: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
        },
        12: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
        },
        13: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
        },
    };
    if (hasError) return hasError;
    if (programMapping.dataSource) {
        return allOptions[step][programMapping.dataSource];
    }
    return true;
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

export const label = (step: number, programMapping: Partial<IMapping>) => {
    if (step === 12) return "Import";
    if (step === 13) return "Go To Mappings";
    return stepLabels[step];
};

export const flattenProgram = (program: Partial<IProgram>) => {
    if (!isEmpty(program)) {
        const { programTrackedEntityAttributes, programStages } = program;
        const attributes = programTrackedEntityAttributes.map(
            ({
                trackedEntityAttribute: { id, name, optionSetValue, optionSet },
            }) => {
                const option: Option = {
                    label: name,
                    value: `attribute.${id}`,
                    optionSetValue,
                    availableOptions:
                        optionSet?.options.map(({ code, id, name }) => ({
                            label: name,
                            code,
                            value: code,
                            id,
                        })) || [],
                };
                return option;
            }
        );
        const elements = programStages.flatMap(
            ({ id: stageId, name: stageName, programStageDataElements }) => {
                const dataElements = programStageDataElements.map(
                    ({
                        dataElement: { id, name, optionSetValue, optionSet },
                    }) => {
                        return {
                            label: `${stageName}-${name}`,
                            value: `last.${stageId}.values.${id}`,
                            optionSetValue: optionSetValue || false,
                            id,
                            availableOptions:
                                optionSet?.options.map(
                                    ({ code, id, name }) => ({
                                        label: name,
                                        code,
                                        value: code,
                                        id,
                                    })
                                ) || [],
                        };
                    }
                );

                return [
                    ...dataElements,
                    {
                        label: `${stageName}-Event`,
                        value: `last.${stageId}.event`,
                    },
                    {
                        label: `${stageName}-Event Date`,
                        value: `last.${stageId}.eventDate`,
                    },
                    {
                        label: `${stageName}-Event Due Date`,
                        value: `last.${stageId}.dueDate`,
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
                label: "Organisation Name",
                value: "orgUnitName",
            },
            {
                label: "Enrollment Date",
                value: "enrollment.enrollmentDate",
            },
            {
                label: "Incident Date",
                value: "enrollment.incidentDate",
            },
            ...elements,
        ];
    }
    return [];
};

const fetchStageEvents = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    programStage: string,
    program: string,
    pageSize: number,
    others: { [key: string]: string } = {}
) => {
    let page = 1;
    let currentEvents = 0;
    let allEvents: Array<Partial<Event>> = [];
    do {
        const params = new URLSearchParams({
            ouMode: "ALL",
            programStage,
            program,
            pageSize: String(pageSize),
            page: String(page),
            ...others,
        });

        console.log(`Querying page ${page}`);

        if (api.engine) {
            const {
                data: { events },
            }: any = await api.engine.query({
                data: {
                    resource: `events.json?${params.toString()}`,
                },
            });
            allEvents = [...allEvents, ...events];
            currentEvents = events.length;
        } else if (api.axios) {
            const {
                data: { events },
            } = await api.axios.get<{
                events: Event[];
            }>(`events.json?${params.toString()}`);
            allEvents = [...allEvents, ...events];
            currentEvents = events.length;
        }
        page = page + 1;
    } while (currentEvents > 0);
    return allEvents;
};

export const fetchEvents = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    programStages: string[],
    pageSize: number,
    program: string,
    others: { [key: string]: string } = {}
): Promise<Array<Partial<TrackedEntityInstance>>> => {
    let allEvents: Array<Partial<Event>> = [];
    for (const programStage of programStages) {
        const currentEvents = await fetchStageEvents(
            api,
            programStage,
            program,
            pageSize,
            others
        );
        allEvents = [...allEvents, ...currentEvents];
    }

    const grouped = groupBy("trackedEntityInstance", allEvents);

    const keys = Object.keys(grouped).filter((k) => !isEmpty(k));

    if (keys.length > 0) {
        const entities = await fetchTrackedEntityInstancesByIds(
            api,
            program,
            keys
        );

        return entities.map((instance) => {
            const events = grouped[instance.trackedEntityInstance];
            return {
                ...instance,
                enrollments: instance.enrollments?.map((e) => ({
                    ...e,
                    events,
                })),
            };
        });
    } else {
        return allEvents.map((events) => ({
            enrollments: [{ events: [events] }],
        }));
    }
};

export const fetchTrackedEntityInstances = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    programMapping: Partial<IMapping>,
    additionalParams: { [key: string]: string } = {},
    uniqueAttributeValues: Array<{ attribute: string; value: string }> = [],
    withAttributes: boolean = false,
    callback: (
        trackedEntityInstances: TrackedEntityInstance[],
        currentAttributes: Array<{
            attribute: string;
            value: string;
        }>,
        page: number
    ) => Promise<any> = undefined
) => {
    console.log("Are we here");
    let foundInstances: TrackedEntityInstance[] = [];
    if (withAttributes && uniqueAttributeValues.length > 0) {
        let page = 1;
        for (const attributeValues of chunk(
            50,
            uniqueAttributeValues.filter(({ value }) => !!value)
        )) {
            let params = new URLSearchParams(additionalParams);
            Object.entries(groupBy("attribute", attributeValues)).forEach(
                ([attribute, values]) => {
                    params.append(
                        "filter",
                        `${attribute}:in:${values
                            .map(({ value }) => value)
                            .join(";")}`
                    );
                }
            );
            params.append("fields", "*");
            params.append("program", programMapping.program.program || "");
            params.append("ouMode", "ALL");
            if (api.engine) {
                const {
                    data: { trackedEntityInstances },
                }: any = await api.engine.query({
                    data: {
                        resource: `trackedEntityInstances.json?${params.toString()}`,
                    },
                });
                if (callback) {
                    await callback(
                        trackedEntityInstances,
                        attributeValues,
                        page
                    );
                } else {
                    foundInstances = [
                        ...foundInstances,
                        ...trackedEntityInstances,
                    ];
                }
            } else if (api.axios) {
                const {
                    data: { trackedEntityInstances },
                } = await api.axios.get<{
                    trackedEntityInstances: TrackedEntityInstance[];
                }>(`trackedEntityInstances.json?${params.toString()}`);
                if (callback) {
                    await callback(
                        trackedEntityInstances,
                        attributeValues,
                        page
                    );
                } else {
                    foundInstances = [
                        ...foundInstances,
                        ...trackedEntityInstances,
                        ,
                    ];
                }
            }
            page = page + 1;
        }
    } else if (!withAttributes) {
        let page = 1;
        let instances = 0;
        do {
            const params = new URLSearchParams({
                ouMode: "ALL",
                fields: "*",
                program: programMapping.program.program || "",
                page: String(page),
                pageSize: "50",
            });

            console.log(`Querying page ${page}`);

            if (api.engine) {
                const {
                    data: { trackedEntityInstances },
                }: any = await api.engine.query({
                    data: {
                        resource: `trackedEntityInstances.json?${params.toString()}`,
                    },
                });
                if (callback) {
                    await callback(trackedEntityInstances, [], page);
                } else {
                    foundInstances = [
                        ...foundInstances,
                        ...trackedEntityInstances,
                    ];
                }
                instances = trackedEntityInstances.length;
            } else if (api.axios) {
                const {
                    data: { trackedEntityInstances },
                } = await api.axios.get<{
                    trackedEntityInstances: TrackedEntityInstance[];
                }>(`trackedEntityInstances.json?${params.toString()}`);
                if (callback) {
                    await callback(trackedEntityInstances, [], page);
                } else {
                    foundInstances = [
                        ...foundInstances,
                        ...trackedEntityInstances,
                    ];
                }
                instances = trackedEntityInstances.length;
            }
            console.log("Processing to queried page");
            page = page + 1;
        } while (instances > 0);
    } else if (callback) {
        await callback([], [], 1);
    }
    return { trackedEntityInstances: foundInstances };
};

export const fetchTrackedEntityInstancesByIds = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    program: string,
    ids: string[]
) => {
    let instances: Array<Partial<TrackedEntityInstance>> = [];
    if (ids.length > 0) {
        for (const c of chunk(50, ids)) {
            const params = new URLSearchParams({
                trackedEntityInstance: `${c.join(";")}`,
                fields: "trackedEntityInstance,orgUnit,attributes,enrollments[enrollmentDate,enrollment,program,incidentDate]",
                skipPaging: "true",
                program,
                ouMode: "ALL",
            });

            let currentInstances: TrackedEntityInstance[] = [];

            if (api.engine) {
                const {
                    data: { trackedEntityInstances },
                }: any = await api.engine.query({
                    data: {
                        resource: `trackedEntityInstances.json?${params.toString()}`,
                    },
                });
                currentInstances =
                    trackedEntityInstances as TrackedEntityInstance[];
            } else if (api.axios) {
                const {
                    data: { trackedEntityInstances },
                } = await api.axios.get<{
                    trackedEntityInstances: TrackedEntityInstance[];
                }>(`trackedEntityInstances.json?${params.toString()}`);
                currentInstances = trackedEntityInstances;
            }

            instances = [...instances, ...currentInstances];
        }
    }
    return instances;
};

export const fetchGoDataData = async (
    goData: Partial<IGoData>,
    authentication: Partial<Authentication>
) => {
    const {
        params,
        basicAuth,
        hasNextLink,
        headers,
        password,
        username,
        ...rest
    } = authentication;

    const response = await postRemote<GODataTokenGenerationResponse>(
        rest,
        "api/users/login",
        {
            email: username,
            password,
        }
    );

    const prev = await fetchRemote<Array<Partial<IGoDataData>>>(
        rest,
        `api/outbreaks/${goData.id}/cases`,
        {
            auth: {
                param: "access_token",
                value: response.id,
                forUpdates: false,
            },
        }
    );

    const allPrev = fromPairs(prev.map(({ visualId, id }) => [id, visualId]));

    const prevQuestionnaire = prev.map(
        ({ id, visualId, questionnaireAnswers }) => ({
            ...questionnaireAnswers,
            id,
            visualId,
        })
    );

    const prevEpidemiology = prev.map(
        ({
            id,
            visualId,
            classification,
            dateOfOnset,
            isDateOfOnsetApproximate,
            dateBecomeCase,
            dateOfInfection,
            outcomeId,
            dateOfOutcome,
            transferRefused,
            dateRanges,
            dateOfBurial,
            burialPlaceName,
            burialLocationId,
            safeBurial,
        }) => ({
            classification,
            visualId,
            id,
            dateOfOnset: dateOfOnset ? dateOfOnset.slice(0, 10) : undefined,
            isDateOfOnsetApproximate,
            dateBecomeCase: dateBecomeCase
                ? dateBecomeCase.slice(0, 10)
                : undefined,
            dateOfInfection: dateOfInfection
                ? dateOfInfection.slice(0, 10)
                : undefined,
            outcomeId,
            dateOfOutcome: dateOfOutcome
                ? dateOfOutcome.slice(0, 10)
                : undefined,
            transferRefused,
            dateRanges,
            dateOfBurial: dateOfBurial ? dateOfBurial.slice(0, 10) : undefined,
            burialPlaceName,
            burialLocationId,
            safeBurial,
        })
    );

    const prevPeople = prev.map(
        ({
            id,
            visualId,
            firstName,
            middleName,
            lastName,
            age,
            dob,
            gender,
            pregnancyStatus,
            occupation,
            riskLevel,
            riskReason,
            dateOfReporting,
            isDateOfReportingApproximate,
            responsibleUserId,
            followUpTeamId,
            followUp,
            vaccinesReceived,
            documents,
            addresses,
        }) => ({
            id,
            visualId,
            firstName,
            middleName,
            lastName,
            age,
            dob: dob ? dob.slice(0, 10) : undefined,
            gender,
            pregnancyStatus,
            occupation,
            riskLevel,
            riskReason,
            dateOfReporting: dateOfReporting
                ? dateOfReporting.slice(0, 10)
                : undefined,
            isDateOfReportingApproximate,
            responsibleUserId,
            followUpTeamId,
            followUp,
            vaccinesReceived,
            documents,
            addresses,
        })
    );

    const prevEvents = await fetchRemote<Array<Partial<GoDataEvent>>>(
        rest,
        `api/outbreaks/${goData.id}/events`,
        {
            auth: {
                param: "access_token",
                value: response.id,
                forUpdates: false,
            },
        }
    );

    const labResponse = await Promise.all(
        prev.map(({ id }) =>
            fetchRemote<Array<any>>(
                rest,
                `api/outbreaks/${goData.id}/cases/${id}/lab-results`,
                {
                    auth: {
                        param: "access_token",
                        value: response.id,
                        forUpdates: false,
                    },
                }
            )
        )
    );

    const prevLab = labResponse.flat().map(({ personId, ...rest }) => ({
        ...rest,
        personId,
        visualId: allPrev[personId],
        dateSampleTaken: rest.dateSampleTaken
            ? rest.dateSampleTaken.slice(0, 10)
            : undefined,
        dateSampleDelivered: rest.dateSampleDelivered
            ? rest.dateSampleDelivered.slice(0, 10)
            : undefined,
        dateTesting: rest.dateTesting
            ? rest.dateTesting.slice(0, 10)
            : undefined,
        dateOfResult: rest.dateOfResult
            ? rest.dateOfResult.slice(0, 10)
            : undefined,
    }));
    return {
        metadata: {
            person: prevPeople,
            lab: prevLab,
            events: prevEvents,
            questionnaire: prevQuestionnaire,
            relationships: [],
            epidemiology: prevEpidemiology,
        },
        prev: allPrev,
    };
};
