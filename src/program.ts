import { AxiosInstance } from "axios";
import { isFuture } from "date-fns";
import { format, isValid, parseISO } from "date-fns/fp";
import { diff } from "jiff";
import {
    Dictionary,
    isArray,
    maxBy,
    minBy,
    range,
    unionBy,
    uniq,
} from "lodash";
import {
    chunk,
    fromPairs,
    getOr,
    groupBy,
    isEmpty,
    uniqBy,
    update,
} from "lodash/fp";
// import pLimit from "p-limit";
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
    DataSource,
    Enrollment,
    Event,
    FlattenedEvent,
    FlattenedInstance,
    GODataOption,
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
    Processed,
    Metadata,
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
    getConflicts,
    getGeometry,
    makeEvent,
    postRemote,
    processAttributes,
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

export const findUniqAttributes = (
    data: any[],
    attributeMapping: Mapping
): Array<Dictionary<any>> => {
    return data.flatMap((d) => {
        const values = Object.entries(attributeMapping).flatMap(
            ([attribute, mapping]) => {
                const { unique, value } = mapping;
                const foundValue = getOr("", value, d);
                if (unique && value && foundValue) {
                    return { attribute, value: foundValue };
                }
                return [];
            }
        );
        if (values.length > 0) {
            return fromPairs<any>(
                values.map(({ attribute, value }) => [attribute, value])
            );
        }
        return [];
    });
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
    options: Dictionary<string>,
    dataElements: Dictionary<Option>,
    uniqueKey: string
) => {
    let eventUpdates = [];
    let newEvents = [];
    let conflicts: any[] = [];
    let errors: any[] = [];
    for (const [programStage, mapping] of Object.entries(programStageMapping)) {
        const { repeatable, featureType } = stages[programStage];
        const stagePreviousEvents = previousEvents[programStage] || {};
        let currentData = fromPairs([["all", data]]);
        const { info, ...elements } = mapping;
        const {
            createEvents,
            eventDateColumn,
            dueDateColumn,
            updateEvents,
            eventIdColumn,
            uniqueEventDate,
            geometryColumn = "",
            geometryMerged = false,
            latitudeColumn = "",
            longitudeColumn = "",
            stage,
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
            if (uniqueEventDate) {
                uniqueColumns = [...uniqueColumns, eventDateColumn];
            }

            if (eventIdColumn) {
                uniqueColumns = [eventIdColumn];
            }
            if (uniqueColumns.length > 0) {
                currentData = groupBy(
                    (item: any) =>
                        uniqueColumns
                            .map((column) => {
                                const value = getOr("", column, item);
                                if (column === eventDateColumn && value) {
                                    return format(
                                        "yyyy-MM-dd",
                                        parseISO(getOr("", column, item))
                                    );
                                }
                                return value;
                            })
                            .join(""),
                    data
                );
            }
            for (const [key, currentRow] of Object.entries(currentData)) {
                const previousEvent = stagePreviousEvents[key];
                const data = maxBy(currentRow, eventDateColumn);
                const {
                    event,
                    conflicts: cs,
                    errors: es,
                } = makeEvent({
                    eventDateColumn,
                    data,
                    featureType,
                    geometryColumn,
                    geometryMerged,
                    latitudeColumn,
                    longitudeColumn,
                    eventIdColumn,
                    elements,
                    programStage,
                    enrollment,
                    trackedEntityInstance,
                    program,
                    orgUnit,
                    options,
                    dataElements,
                    uniqueKey,
                });

                if (event && !isEmpty(event.dataValues)) {
                    const { dataValues, event: e, ...others } = event;
                    if (previousEvent) {
                        const { event, eventDate, ...rest } = previousEvent;
                        const difference = diff(rest, dataValues);
                        const filteredDifferences = difference.filter(
                            ({ op }) =>
                                ["add", "replace", "copy"].indexOf(op) !== -1
                        );
                        if (filteredDifferences.length > 0) {
                            eventUpdates = eventUpdates.concat({
                                event,
                                eventDate,
                                ...others,
                                dataValues: Object.entries({
                                    ...rest,
                                    ...dataValues,
                                }).map(([dataElement, value]) => ({
                                    dataElement,
                                    value,
                                })),
                            });
                        }
                    } else {
                        newEvents = newEvents.concat({
                            ...others,
                            event: e,
                            dataValues: Object.entries({
                                ...dataValues,
                            }).map(([dataElement, value]) => ({
                                dataElement,
                                value,
                            })),
                        });
                    }

                    if (!repeatable) {
                        break;
                    }
                } else {
                    errors = errors.concat(es);
                    conflicts = conflicts.concat(cs);
                    if (!repeatable) {
                        break;
                    }
                }
            }
        }
    }
    return { eventUpdates, newEvents, conflicts, errors };
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
                if (mapping.isSpecific) {
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
    const allElements = fromPairs(
        getDataElements(program).map((e) => [e.value, e])
    );
    const uniqAttributes = programUniqAttributes(attributeMapping);
    const uniqStageElements = programStageUniqElements(programStageMapping);
    const uniqColumns = programUniqColumns(attributeMapping);
    const uniqStageColumns = programStageUniqColumns(programStageMapping);
    const trackedEntityGeometryType =
        program.trackedEntityType.featureType ?? "";

    const enrollmentGeometryType = program.featureType ?? "";
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

    const {
        enrollmentDateColumn = "",
        incidentDateColumn = "",
        trackedEntityInstanceColumn = "",
        enrollmentGeometryColumn = "",
        enrollmentGeometryMerged = false,
        enrollmentLatitudeColumn = "",
        enrollmentLongitudeColumn = "",

        geometryColumn = "",
        geometryMerged = false,
        latitudeColumn = "",
        longitudeColumn = "",
    } = mapping.program;

    const orgUnitColumn = mapping.orgUnitColumn || "";

    let groupedData: Dictionary<any[]> = {};
    if (mapping.program.trackedEntityInstanceColumn) {
        groupedData = groupBy(
            mapping.program.trackedEntityInstanceColumn,
            data
        );
    } else if (uniqColumns.length > 0) {
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
                enrollment: Partial<Enrollment>;
                trackedEntity: Partial<TrackedEntityInstance>;
                events: Array<Partial<Event>>;
                eventUpdates: Array<Partial<Event>>;
                trackedEntityUpdate: Partial<TrackedEntityInstance>;
                conflicts: any[];
                errors: any[];
            } = {
                enrollment: {},
                trackedEntity: {},
                events: [],
                eventUpdates: [],
                trackedEntityUpdate: {},
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
            const trackedEntityGeometry = getGeometry({
                data: current[0],
                geometryMerged,
                geometryColumn,
                latitudeColumn,
                longitudeColumn,
                featureType: trackedEntityGeometryType,
            });
            const enrollmentGeometry = getGeometry({
                data: current[0],
                geometryMerged: enrollmentGeometryMerged,
                geometryColumn: enrollmentGeometryColumn,
                latitudeColumn: enrollmentLatitudeColumn,
                longitudeColumn: enrollmentLongitudeColumn,
                featureType: enrollmentGeometryType,
            });
            const previousAttributes = getOr(
                [],
                uniqueKey,
                previousData.attributes
            );

            let { source, errors, conflicts } = processAttributes({
                attributeMapping,
                attributes,
                flippedOptions,
                data: current[0],
                uniqueKey,
            });

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
                        trackedEntityUpdate: {
                            trackedEntityInstance: previousTrackedEntity,
                            attributes,
                            trackedEntityType:
                                mapping.program.trackedEntityType,
                            orgUnit: previousOrgUnit,
                        },
                    };

                    if (!isEmpty(trackedEntityGeometry)) {
                        results = {
                            ...results,
                            trackedEntityUpdate: {
                                ...results.trackedEntityUpdate,
                                geometry: trackedEntityGeometry,
                            },
                        };
                    }
                }
            } else if (
                previousAttributes.length === 0 &&
                createEntities &&
                currentErrors.length === 0
            ) {
                const currentUnit = getOr("", orgUnitColumn, current[0]);
                previousOrgUnit = getOr("", currentUnit, flippedUnits);
                previousTrackedEntity = getOr(
                    generateUid(),
                    trackedEntityInstanceColumn,
                    current[0]
                );
                if (previousOrgUnit) {
                    results = {
                        ...results,
                        trackedEntity: {
                            trackedEntityInstance: previousTrackedEntity,
                            attributes: Object.entries({
                                ...differences,
                                ...source,
                            }).map(([attribute, value]) => ({
                                attribute,
                                value,
                            })),
                            trackedEntityType:
                                mapping.program.trackedEntityType,
                            orgUnit: previousOrgUnit,
                        },
                    };
                    if (!isEmpty(trackedEntityGeometry)) {
                        results = {
                            ...results,
                            trackedEntity: {
                                ...results.trackedEntity,
                                geometry: trackedEntityGeometry,
                            },
                        };
                    }
                } else {
                    currentErrors = [
                        ...currentErrors,
                        {
                            value: `Missing equivalent mapping for organisation unit ${currentUnit}`,
                            attribute: `OrgUnit for ${uniqueKey}`,
                        },
                    ];
                }
            }

            if (
                previousOrgUnit &&
                createEnrollments &&
                isEmpty(previousEnrollment)
            ) {
                const enrollmentDate = parseISO(
                    getOr("", enrollmentDateColumn, current[0])
                );
                const incidentDate = parseISO(
                    getOr("", incidentDateColumn, current[0])
                );
                if (isValid(enrollmentDate) && isValid(incidentDate)) {
                    let dateAreValid = true;

                    if (
                        !selectEnrollmentDatesInFuture &&
                        isFuture(enrollmentDate)
                    ) {
                        dateAreValid = false;
                        currentErrors = [
                            ...currentErrors,
                            {
                                value: `Date ${format(
                                    "yyyy-MM-dd",
                                    enrollmentDate
                                )} is in the future`,
                                attribute: `Enrollment date for ${uniqueKey}`,
                            },
                        ];
                    }

                    if (
                        !selectIncidentDatesInFuture &&
                        isFuture(incidentDate)
                    ) {
                        dateAreValid = false;
                        currentErrors = [
                            ...currentErrors,
                            {
                                value: `Date ${format(
                                    "yyyy-MM-dd",
                                    incidentDate
                                )} is in the future`,
                                attribute: `Incident date for ${uniqueKey}`,
                            },
                        ];
                    }
                    if (dateAreValid) {
                        previousEnrollment = generateUid();
                        let currentEnrollment: Partial<Enrollment> = {
                            program: mapping.program.program,
                            trackedEntityInstance: previousTrackedEntity,
                            orgUnit: previousOrgUnit,
                            enrollmentDate: format(
                                "yyyy-MM-dd",
                                enrollmentDate
                            ),
                            incidentDate: format("yyyy-MM-dd", incidentDate),
                            enrollment: previousEnrollment,
                        };
                        if (!isEmpty(enrollmentGeometry)) {
                            currentEnrollment = {
                                ...currentEnrollment,
                                geometry: enrollmentGeometry,
                            };
                        }
                        results = {
                            ...results,
                            enrollment: currentEnrollment,
                        };
                    }
                } else {
                    currentErrors = [
                        ...currentErrors,
                        {
                            value: "Missing",
                            attribute: "enrollment date and/or incident date",
                        },
                    ];
                }
            }

            if (
                previousOrgUnit &&
                previousEnrollment &&
                previousTrackedEntity
            ) {
                const { eventUpdates, newEvents } = processEvents(
                    current,
                    programStageMapping,
                    previousTrackedEntity,
                    previousEnrollment,
                    previousOrgUnit,
                    mapping.program.program || "",
                    getOr({}, uniqueKey, previousData.dataElements),
                    stages,
                    flippedOptions,
                    allElements,
                    uniqueKey
                );

                results = {
                    ...results,
                    events: newEvents,
                    eventUpdates,
                    conflicts: [...currentConflicts, ...conflicts],
                    errors: [...currentErrors, ...errors],
                };
            }

            return {
                ...results,
                conflicts: results.conflicts.filter((a) => !!a),
                errors: results.errors.filter((a) => !!a),
            };
        }
    );

    const trackedEntityInstances = processed.flatMap(({ trackedEntity }) => {
        if (!isEmpty(trackedEntity)) return trackedEntity;
        return [];
    });

    const enrollments = processed.flatMap(({ enrollment }) => {
        if (!isEmpty(enrollment)) return enrollment;
        return [];
    });
    const errors = processed.flatMap(({ errors }) => errors);
    const conflicts = processed.flatMap(({ conflicts }) => conflicts);
    const events = processed.flatMap(({ events }) => events.flat());
    const trackedEntityInstanceUpdates = processed.flatMap(
        ({ trackedEntityUpdate }) => {
            if (!isEmpty(trackedEntityUpdate)) return trackedEntityUpdate;
            return [];
        }
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

export const processPreviousInstances = ({
    trackedEntityInstances,
    programUniqAttributes,
    programStageUniqueElements,
    currentProgram,
    trackedEntityIdIdentifiesInstance,
    eventIdIdentifiesEvent,
}: Partial<{
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
    programUniqAttributes: string[];
    programStageUniqueElements: Dictionary<string[]>;
    currentProgram: string;
    trackedEntityIdIdentifiesInstance: boolean;
    eventIdIdentifiesEvent: boolean;
}>) => {
    let currentAttributes: Array<[string, any]> = [];
    let currentElements: Array<[string, any]> = [];
    let currentEnrollments: Array<[string, string]> = [];
    let currentTrackedEntities: Array<[string, string]> = [];
    let currentOrgUnits: Array<[string, string]> = [];

    if (trackedEntityInstances) {
        trackedEntityInstances.forEach(
            ({ enrollments, attributes, trackedEntityInstance, orgUnit }) => {
                const allAttributes = attributes.concat(
                    enrollments.flatMap(({ attributes }) => attributes),
                    {
                        attribute: "trackedEntityInstance",
                        value: trackedEntityInstance,
                    }
                );
                const uniqueAttributes = uniqBy("attribute", allAttributes);
                let attributeKey = uniqueAttributes
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

                if (trackedEntityIdIdentifiesInstance) {
                    attributeKey = trackedEntityInstance;
                }
                currentTrackedEntities.push([
                    attributeKey,
                    trackedEntityInstance,
                ]);
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
                        currentEnrollments.push([
                            attributeKey,
                            String(enrollment),
                        ]);
                        const groupedEvents = groupBy("programStage", events);
                        const uniqueEvents = Object.entries(
                            groupedEvents
                        ).flatMap(([stage, availableEvents]) => {
                            const stageElements =
                                programStageUniqueElements[stage];
                            const elements = availableEvents.map((event) => {
                                if (event.eventDate) {
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

                                    let dataElementKey = finalValues
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

                                    if (eventIdIdentifiesEvent) {
                                        dataElementKey = event.event;
                                    }

                                    return [
                                        dataElementKey,
                                        fromPairs(finalValues),
                                    ];
                                }
                                return [];
                            });
                            return [[stage, fromPairs(elements)]];
                        });
                        currentElements.push([
                            attributeKey,
                            fromPairs(uniqueEvents),
                        ]);
                    }
                }
            }
        );
    }

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

// const flattenEvent = (event: Partial<Event>): Partial<FlattenedEvent> => {
//     if (event) {
//         const { dataValues, programStage, enrollment, ...rest } = event;
//         return {
//             [programStage]: {
//                 ...rest,
//                 programStage,
//                 values: fromPairs(
//                     dataValues.map(({ dataElement, value }) => [
//                         dataElement,
//                         value,
//                     ])
//                 ),
//             },
//         };
//     }
//     return {};
// };

// export const flattenEvents = (
//     events: Array<Partial<Event>>
// ): Array<Partial<FlattenedInstance>> =>
//     events.map((e) => ({ last: flattenEvent(e) }));

export const flattenTrackedEntityInstances = (
    response: {
        trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
    },
    flatteningOption: "ALL" | "LAST" | "FIRST"
): Array<Partial<FlattenedInstance>> => {
    return response.trackedEntityInstances.flatMap(
        ({ attributes, enrollments, ...otherAttributes }) => {
            const attributeValues = fromPairs(
                attributes.map(({ attribute, value }) => [attribute, value])
            );
            const current: Partial<FlattenedInstance> = {
                ...otherAttributes,
                attribute: attributeValues,
            };
            if (enrollments.length > 0) {
                const [{ events, ...enrollmentData }] = enrollments;
                current.enrollment = enrollmentData;
                let validEvents: Array<Partial<FlattenedInstance>> = [];
                for (const [stage, availableEvents] of Object.entries(
                    groupBy("programStage", events)
                )) {
                    if (flatteningOption === "ALL") {
                        validEvents = validEvents.concat(
                            flattenEvents(availableEvents, current)
                        );
                    } else if (flatteningOption === "FIRST") {
                        validEvents = validEvents.concat(
                            flattenEvents(
                                [minBy(availableEvents, "eventDate")],
                                current
                            )
                        );
                    } else {
                        validEvents = validEvents.concat(
                            flattenEvents(
                                [maxBy(availableEvents, "eventDate")],
                                current
                            )
                        );
                    }
                }
                if (validEvents.length > 0) {
                    return validEvents;
                }
            }
            return current;
        }
    );
};

export const findUniqueDataElements = (programStageMapping: StageMapping) => {
    const uniqElements = Object.entries(programStageMapping).map(
        ([stage, mapping]) => {
            const { info, ...elements } = mapping;
            const eventDateIsUnique = info.uniqueEventDate;
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

const getDataElements = (program: Partial<IProgram>): Option[] => {
    if (!isEmpty(program) && program.programStages) {
        return program.programStages.flatMap(({ programStageDataElements }) =>
            programStageDataElements.map(
                ({
                    dataElement: {
                        id,
                        code,
                        name,
                        optionSet,
                        optionSetValue,
                        valueType,
                    },
                    compulsory,
                    allowFutureDate,
                }) => {
                    return {
                        label: name,
                        value: id,
                        code,
                        unique: false,
                        mandatory: compulsory,
                        optionSetValue,
                        valueType: String(valueType),
                        allowFutureDate,
                        availableOptions:
                            optionSet?.options.map(({ code, id, name }) => ({
                                label: name,
                                code,
                                value: code,
                                id,
                            })) || [],
                    };
                }
            )
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

export const findTrackedEntityInstanceIds = (
    data: any[],
    programMapping: Partial<IProgramMapping>
): string[] => {
    if (programMapping && programMapping.trackedEntityInstanceColumn) {
        return data.flatMap((d) => {
            return getOr("", programMapping.trackedEntityInstanceColumn, d);
        });
    }

    return [];
};

export const getAttributes = (program: Partial<IProgram>): Array<Option> => {
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
                    valueType,
                },
            }) => {
                return {
                    label: name,
                    value: id,
                    code,
                    unique,
                    mandatory,
                    optionSetValue,
                    valueType: String(valueType),
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

export const flattenEvents = (
    events: Array<Partial<Event>>,
    additional: Partial<FlattenedInstance>
) => {
    return events.map(({ dataValues, programStage, ...rest }) => {
        return {
            ...additional,
            [programStage]: {
                ...rest,
                programStage,
                values: fromPairs(
                    dataValues.map(({ dataElement, value }) => [
                        dataElement,
                        value,
                    ])
                ),
            },
        };
    });
};

export const programStageUniqColumns = (
    programStageMapping: StageMapping
): Dictionary<string[]> => {
    const uniqElements = Object.entries(programStageMapping).map(
        ([stage, mapping]) => {
            const { info, ...elements } = mapping;
            const eventDateIsUnique = info.uniqueEventDate;
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
            const eventDateIsUnique = info.customDueDateColumn;
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
    return !isEmpty(programMapping.program?.remoteProgram);
};

const hasName = (programMapping: Partial<IMapping>) => {
    return !!programMapping.name && !!programMapping.dataSource;
};
const hasData = (programMapping: Partial<IMapping>, data: any[]) => {
    if (programMapping.isSource) {
        return true;
    }

    return data.length > 0;
};

const hasProgram = (programMapping: Partial<IMapping>) =>
    !isEmpty(programMapping.program?.program);

const hasRemoteProgram = (programMapping: Partial<IMapping>) =>
    !isEmpty(programMapping.program?.remoteProgram);

const hasOrgUnitColumn = (programMapping: Partial<IMapping>) =>
    !isEmpty(programMapping.orgUnitColumn);

const createEnrollment = (programMapping: Partial<IMapping>) => {
    if (programMapping.program?.createEnrollments) {
        return (
            !isEmpty(programMapping.program?.enrollmentDateColumn) &&
            !isEmpty(programMapping.program?.incidentDateColumn)
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
    metadata: Metadata;
}) => {
    const allAttributes = Object.keys(attributeMapping);
    const hasLab = metadata.lab.find(
        ({ value }) => allAttributes.indexOf(value) !== -1
    );
    if (mapping.program?.responseKey === "EVENT") {
        return mandatoryAttributesMapped(metadata.events, attributeMapping);
    } else if (mapping.program?.responseKey === "CASE") {
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
    } else if (mapping.program?.responseKey === "CONTACT") {
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
                        if (compulsory && rest[id]?.value) {
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
    mapping,
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
    mapping: Partial<IMapping>;
    programStageMapping: StageMapping;
    attributeMapping: Mapping;
    organisationUnitMapping: Mapping;
    step: number;
    mySchema: z.ZodSchema;
    destinationFields: Option[];
    data: any[];
    program: Partial<IProgram>;
    metadata: Metadata;
    hasError: boolean;
}) => {
    const allOptions = {
        2: {
            "go-data":
                !hasName(mapping) ||
                !validURL(mapping, mySchema) ||
                !hasLogins(mapping),
            "csv-line-list": !hasData(mapping, data) || !hasName(mapping),
            "xlsx-line-list": !hasData(mapping, data) || !hasName(mapping),
            "dhis2-program": !hasName(mapping),
            json: !hasData(mapping, data) || !hasName(mapping),
            api: data.length === 0 || !hasName(mapping),
        },
        3: {
            "go-data": !hasProgram(mapping),
            "csv-line-list": !hasProgram(mapping),
            "xlsx-line-list": !hasProgram(mapping),
            "dhis2-program": !hasProgram(mapping),
            json: !hasProgram(mapping),
            api: !hasProgram(mapping),
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
            "go-data": !hasRemote(mapping),
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
            "dhis2-program": !hasRemoteProgram(mapping),
            json: false,
            api: false,
        },
        7: {
            "go-data": !hasOrgUnitMapping(mapping, organisationUnitMapping),
            "csv-line-list": !hasOrgUnitMapping(
                mapping,
                organisationUnitMapping
            ),
            "xlsx-line-list": !hasOrgUnitMapping(
                mapping,
                organisationUnitMapping
            ),
            "dhis2-program": !hasOrgUnitMapping(
                mapping,
                organisationUnitMapping
            ),
            json: !hasOrgUnitMapping(mapping, organisationUnitMapping),
            api: !hasOrgUnitMapping(mapping, organisationUnitMapping),
        },
        8: {
            "go-data": !mandatoryGoDataMapped({
                mapping: mapping,
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

        // !isValidProgramStage(
        //         program,
        //         programStageMapping
        //     )

        10: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
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
    if (mapping.dataSource) {
        return allOptions[step]?.[mapping.dataSource];
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
                            value: `${stageId}.values.${id}`,
                            optionSetValue: optionSetValue || false,
                            id,
                            availableOptions:
                                optionSet?.options.map(
                                    ({ code, id, name }) => ({
                                        label: `${name}(${code})`,
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
                        value: `${stageId}.event`,
                    },
                    {
                        label: `${stageName}-Event Date`,
                        value: `${stageId}.eventDate`,
                    },
                    {
                        label: `${stageName}-Event Due Date`,
                        value: `${stageId}.dueDate`,
                    },
                    {
                        label: `${stageName}-Geometry`,
                        value: `${stageId}.geometry`,
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
            {
                label: "Tracked Entity Type Geometry",
                value: "geometry",
            },
            {
                label: "Enrollment Geometry",
                value: "enrollment.geometry",
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

export const joinAttributes = (
    trackedEntities: Array<Partial<TrackedEntityInstance>>,
    program: string
) => {
    return trackedEntities.map(
        ({ enrollments, attributes, ...trackedEntityInstance }) => {
            const search = enrollments?.find((e) => program === e.program);
            if (search) {
                attributes = attributes.concat(search.attributes);
            }
            return {
                ...trackedEntityInstance,
                enrollments,
                attributes: uniqBy("attribute", attributes),
            };
        }
    );
};

export const queryTrackedEntityInstances = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    params: URLSearchParams | URLSearchParams[]
): Promise<
    Partial<{
        pager: {
            page: number;
            pageCount: number;
            total: number;
            pageSize: number;
        };
    }> &
        Required<{
            trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
        }>
> => {
    if (isArray(params) && api.engine) {
        const response: {
            [key: string]: {
                trackedEntityInstances: TrackedEntityInstance[];
            };
        } = await api.engine.query(
            fromPairs(
                params.map((currentParam, index) => [
                    `x${index}`,
                    {
                        resource: `trackedEntityInstances.json?${currentParam.toString()}`,
                    },
                ])
            )
        );

        let currentInstances: TrackedEntityInstance[] = [];

        for (const { trackedEntityInstances } of Object.values(response)) {
            currentInstances = unionBy(
                currentInstances,
                trackedEntityInstances,
                "trackedEntityInstance"
            );
        }
        return { trackedEntityInstances: currentInstances };
    }

    if (isArray(params) && api.axios) {
        const allQueries = await Promise.all(
            params.map((currentParam) =>
                api.axios.get<
                    Partial<{
                        pager: {
                            page: number;
                            pageCount: number;
                            total: number;
                            pageSize: number;
                        };
                    }> &
                        Required<{
                            trackedEntityInstances: Array<
                                Partial<TrackedEntityInstance>
                            >;
                        }>
                >(`api/trackedEntityInstances.json?${currentParam.toString()}`)
            )
        );

        let currentInstances: Array<Partial<TrackedEntityInstance>> = [];

        for (const {
            data: { trackedEntityInstances },
        } of allQueries) {
            currentInstances = unionBy(
                currentInstances,
                trackedEntityInstances,
                "trackedEntityInstance"
            );
        }
        return { trackedEntityInstances: currentInstances };
    }

    if (api.engine) {
        const { data }: any = await api.engine.query({
            data: {
                resource: `trackedEntityInstances.json?${params.toString()}`,
            },
        });
        return data;
    }

    if (api.axios) {
        const { data } = await api.axios.get<
            Partial<{
                pager: {
                    page: number;
                    pageCount: number;
                    total: number;
                    pageSize: number;
                };
            }> &
                Required<{
                    trackedEntityInstances: Array<
                        Partial<TrackedEntityInstance>
                    >;
                }>
        >(`api/trackedEntityInstances.json?${params.toString()}`);

        return data;
    }

    return { trackedEntityInstances: [] };
};

export const fetchTrackedEntityInstances = async (
    {
        api,
        program,
        trackedEntityType,
        additionalParams = { includeDeleted: "false" },
        uniqueAttributeValues = [],
        withAttributes = false,
        trackedEntityInstances = [],
        fields = "*",
        pageSize = "50",
        numberOfUniqAttribute = 1,
    }: Partial<{
        additionalParams: { [key: string]: string };
        uniqueAttributeValues: Array<{ [key: string]: string }>;
        withAttributes: boolean;
        trackedEntityInstances: string[];
        program: string;
        trackedEntityType: string;
        fields: string;
        pageSize: string;
        numberOfUniqAttribute: number;
    }> &
        Required<{
            api: Partial<{ engine: any; axios: AxiosInstance }>;
        }>,
    callback: (
        trackedEntityInstances: Array<Partial<TrackedEntityInstance>>,
        info: Partial<{
            currentAttributes: Array<{
                attribute: string;
                value: string;
            }>;
            pager: {
                page: number;
                pageCount: number;
                total: number;
                pageSize: number;
            };
        }>
    ) => Promise<any> = undefined
) => {
    let foundInstances: Array<Partial<TrackedEntityInstance>> = [];
    if (trackedEntityInstances.length > 0) {
        const data = await fetchTrackedEntityInstancesByIds(
            api,
            program,
            trackedEntityInstances
        );

        if (callback) {
            await callback(data, {});
        } else {
            foundInstances = [...foundInstances, ...data];
        }
    } else if (
        withAttributes &&
        uniqueAttributeValues.length > 0 &&
        numberOfUniqAttribute === 1
    ) {
        let page = 1;
        const attribute = Object.keys(uniqueAttributeValues[0])[0];
        const allValues = uniq(
            uniqueAttributeValues.map((o) => Object.values(o)[0])
        );
        const chunkedData = chunk(Number(pageSize), allValues);

        for (const attributeValues of chunkedData) {
            let params = new URLSearchParams(additionalParams);
            params.append(
                "filter",
                `${attribute}:in:${attributeValues.join(";")}`
            );
            params.append("fields", fields);
            if (program) {
                params.append("program", program);
            } else if (trackedEntityType) {
                params.append("trackedEntityType", trackedEntityType);
            }
            params.append("skipPaging", "true");
            if (!additionalParams["ou"]) {
                params.append("ouMode", "ALL");
            }
            const { trackedEntityInstances } =
                await queryTrackedEntityInstances(api, params);
            const joinedInstances = joinAttributes(
                trackedEntityInstances,
                program
            );
            const pager = {
                pageSize: Number(pageSize),
                total: allValues.length,
                page,
                pageCount: chunkedData.length,
            };
            if (callback) {
                await callback(joinedInstances, {
                    pager,
                });
            } else {
                foundInstances = foundInstances.concat(joinedInstances);
            }
            page = page + 1;
        }
    } else if (
        withAttributes &&
        uniqueAttributeValues.length > 0 &&
        numberOfUniqAttribute > 1
    ) {
        console.log("We are in searching");
        let page = 1;
        const chunkedData = chunk(Number(pageSize), uniqueAttributeValues);
        for (const attributeValues of chunkedData) {
            const all = attributeValues.map((a) => {
                let params = new URLSearchParams(additionalParams);
                Object.entries(a).forEach(([attribute, value]) =>
                    params.append("filter", `${attribute}:eq:${value}`)
                );
                params.append("fields", fields);
                if (program) {
                    params.append("program", program);
                } else if (trackedEntityType) {
                    params.append("trackedEntityType", trackedEntityType);
                }
                params.append("skipPaging", "true");
                if (!additionalParams["ou"]) {
                    params.append("ouMode", "ALL");
                }
                return queryTrackedEntityInstances(api, params);
            });
            const result = await Promise.all(all);
            const trackedEntityInstances = result.flatMap(
                ({ trackedEntityInstances }) => trackedEntityInstances
            );

            const joinedInstances = joinAttributes(
                uniqBy("trackedEntityInstance", trackedEntityInstances),
                program
            );

            if (callback) {
                await callback(joinedInstances, {
                    pager: {
                        total: uniqueAttributeValues.length,
                        page,
                        pageCount: chunkedData.length,
                        pageSize: Number(pageSize),
                    },
                });
            } else {
                foundInstances = foundInstances.concat(joinedInstances);
            }
            page = page + 1;
        }
    } else if (!withAttributes) {
        console.log("We are in attributes");
        let page = 1;
        let params: { [key: string]: string } = {
            fields,
            page: String(page),
            pageSize,
            ...additionalParams,
        };
        if (program) {
            params = { ...params, program };
        } else if (trackedEntityType) {
            params = { ...params, trackedEntityType };
        }
        if (!additionalParams["ou"] && !additionalParams["ouMode"]) {
            params = { ...params, ouMode: "ALL" };
        }
        const { pager, trackedEntityInstances } =
            await queryTrackedEntityInstances(
                api,
                new URLSearchParams({ ...params, totalPages: "true" })
            );

        const joinedInstances = joinAttributes(trackedEntityInstances, program);
        if (callback) {
            await callback(joinedInstances, {
                pager,
            });
        } else {
            foundInstances = foundInstances.concat(joinedInstances);
        }
        if (!isEmpty(pager) && pager.pageCount > 1) {
            for (let p = 2; p <= pager.pageCount; p++) {
                try {
                    const { trackedEntityInstances } =
                        await queryTrackedEntityInstances(
                            api,
                            new URLSearchParams({ ...params, page: String(p) })
                        );
                    const joinedInstances = joinAttributes(
                        trackedEntityInstances,
                        program
                    );

                    if (callback) {
                        await callback(joinedInstances, {
                            pager: { ...pager, page: p },
                        });
                    } else {
                        foundInstances = foundInstances.concat(joinedInstances);
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        }
    } else if (callback) {
        await callback([], {});
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
                fields: "*",
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
                }>(`api/trackedEntityInstances.json?${params.toString()}`);
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

const convertEntities = (entities: Partial<TrackedEntityInstance>[]) => {
    return entities.map(({ trackedEntityInstance, ...rest }) => ({
        ...rest,
        trackedEntity: trackedEntityInstance,
    }));
};

const convertEnrollments = (enrollments: Partial<Enrollment>[]) => {
    return enrollments.map(
        ({ trackedEntityInstance, incidentDate, enrollmentDate, ...rest }) => ({
            ...rest,
            trackedEntity: trackedEntityInstance,
            enrolledAt: enrollmentDate,
            occurredAt: incidentDate,
        })
    );
};

const convertEvents = (enrollments: Partial<Event>[]) => {
    return enrollments.map(
        ({ trackedEntityInstance, eventDate, dueDate, ...rest }) => ({
            ...rest,
            trackedEntity: trackedEntityInstance,
            scheduledAt: dueDate,
            occurredAt: eventDate,
        })
    );
};

export const insertTrackerData38 = async ({
    processedData,
    api,
    async,
    chunkSize,
    onInsert,
}: {
    processedData: Partial<Processed>;
    api: Partial<{ engine: any; axios: AxiosInstance }>;
    async: boolean;
    chunkSize: number;
    onInsert: (response: any) => void;
}) => {
    let {
        enrollments,
        events,
        trackedEntityInstances,
        trackedEntityInstanceUpdates,
        eventUpdates,
    } = processedData;

    let availableEvents = events.concat(eventUpdates ?? []);
    let availableEntities = trackedEntityInstances.concat(
        trackedEntityInstanceUpdates ?? []
    );
    for (const instances of chunk(chunkSize, availableEntities)) {
        const instanceIds = instances.map(
            ({ trackedEntityInstance }) => trackedEntityInstance
        );
        const validEnrollments = enrollments.filter(
            ({ trackedEntityInstance }) =>
                instanceIds.indexOf(trackedEntityInstance) !== -1
        );
        const enrollmentIds = validEnrollments.map(
            ({ enrollment }) => enrollment
        );
        const validEvents = availableEvents.filter(
            ({ enrollment }) => enrollmentIds.indexOf(enrollment) !== -1
        );

        availableEvents = availableEvents.filter(
            ({ enrollment }) => enrollmentIds.indexOf(enrollment) === -1
        );
        enrollments = enrollments.filter(
            ({ trackedEntityInstance }) =>
                instanceIds.indexOf(trackedEntityInstance) === -1
        );
        try {
            if (api.engine) {
                const response: any = await api.engine.mutate({
                    type: "create",
                    resource: "tracker",
                    data: {
                        trackedEntities: convertEntities(instances),
                        enrollments: convertEnrollments(validEnrollments),
                        events: convertEvents(validEvents),
                    },
                    params: { async },
                });
                onInsert(response);
            } else if (api.axios) {
                const { data } = await api.axios.post(
                    "api/trackedEntityInstances",
                    {
                        trackedEntities: convertEntities(instances),
                        enrollments: convertEnrollments(validEnrollments),
                        events: convertEvents(validEvents),
                    },
                    { params: { async } }
                );
                onInsert(data);
            }
        } catch (error: any) {}
    }

    for (const enrollment of chunk(chunkSize, enrollments)) {
        const enrollmentIds = enrollment.map(({ enrollment }) => enrollment);
        const validEvents = availableEvents.filter(
            ({ enrollment }) => enrollmentIds.indexOf(enrollment) !== -1
        );
        availableEvents = availableEvents.filter(
            ({ enrollment }) => enrollmentIds.indexOf(enrollment) === -1
        );

        try {
            if (api.engine) {
                const response: any = await api.engine.mutate({
                    type: "create",
                    resource: "tracker",
                    data: {
                        enrollments: convertEnrollments(enrollment),
                        events: convertEvents(validEvents),
                    },
                    params: { async },
                });
                onInsert(response);
            } else if (api.axios) {
                const { data } = await api.axios.post(
                    "api/tracker",
                    {
                        enrollments: convertEnrollments(enrollment),
                        events: convertEvents(validEvents),
                    },
                    { params: { async } }
                );
                onInsert(data);
            }
        } catch (error: any) {}
    }

    for (const currentEvents of chunk(chunkSize, availableEvents)) {
        try {
            if (api.engine) {
                const response = await api.engine.mutate({
                    type: "create",
                    resource: "tracker",
                    data: { events: convertEvents(currentEvents) },
                    params: { async },
                });
                onInsert(response);
            } else if (api.axios) {
                const { data } = await api.axios.post(
                    "api/tracker",
                    {
                        events: convertEvents(currentEvents),
                    },
                    { params: { async } }
                );
                onInsert(data);
            }
        } catch (error: any) {}
    }
};

export const insertTrackerData = async ({
    processedData,
    callBack,
    api,
    onInsert,
    chunkSize,
}: {
    processedData: Partial<Processed>;
    callBack: (message: string) => void;
    api: Partial<{ engine: any; axios: AxiosInstance }>;
    chunkSize: number;
    onInsert: (resource: string, response: any) => void;
}) => {
    const {
        enrollments,
        events,
        trackedEntityInstances,
        trackedEntityInstanceUpdates,
        eventUpdates,
    } = processedData;

    const allTotalEnrollments = enrollments?.length;
    let currentTotalEntities = 0;
    let currentTotalEvents = 0;
    let currentTotalEnrollments = 0;
    callBack(`Found ${trackedEntityInstances.length} instances`);
    let failedInstances: string[] = [];
    let failedEnrollments: string[] = [];

    const allTrackedEntityInstances = trackedEntityInstances.concat(
        trackedEntityInstanceUpdates ?? []
    );

    for (const instances of chunk(chunkSize, allTrackedEntityInstances)) {
        currentTotalEntities = currentTotalEntities + instances.length;
        callBack(
            `Creating tracked entities ${currentTotalEntities}/${allTrackedEntityInstances.length}`
        );
        try {
            if (api.engine) {
                const { response }: any = await api.engine.mutate({
                    type: "create",
                    resource: "trackedEntityInstances",
                    data: { trackedEntityInstances: instances },
                });
                onInsert("entities", response);
            } else if (api.axios) {
                const {
                    data: { response },
                } = await api.axios.post("api/trackedEntityInstances", {
                    trackedEntityInstances: instances,
                });
                onInsert("entities", response);
            }
        } catch (error: any) {
            const { failed, ...rest } = getConflicts(error.details ?? error);
            failedInstances = failedInstances.concat(failed);
            onInsert("entities", rest);
        }
    }

    const validEnrollments = enrollments?.filter(
        ({ trackedEntityInstance }) =>
            trackedEntityInstance &&
            failedInstances.indexOf(trackedEntityInstance) === -1
    );

    for (const enrollment of chunk(50, validEnrollments)) {
        currentTotalEnrollments = currentTotalEnrollments + enrollment.length;
        callBack(
            `Creating Enrollments ${currentTotalEnrollments}/${allTotalEnrollments}`
        );
        try {
            if (api.engine) {
                const { response }: any = await api.engine.mutate({
                    type: "create",
                    resource: "enrollments",
                    data: { enrollments: enrollment },
                });
                onInsert("enrollments", response);
            } else if (api.axios) {
                const {
                    data: { response },
                } = await api.axios.post("api/enrollments", {
                    enrollments: enrollment,
                });
                onInsert("enrollments", response);
            }
        } catch (error: any) {
            const actualError = error.details ?? error;
            const { failed, ...rest } = getConflicts(actualError);
            onInsert("enrollments", rest);
            failedEnrollments = failedEnrollments.concat(failed);
        }
    }

    const validEvents = events
        .concat(eventUpdates ?? [])
        .filter(
            ({ trackedEntityInstance, enrollment }) =>
                trackedEntityInstance &&
                enrollment &&
                failedInstances.indexOf(trackedEntityInstance) === -1 &&
                failedEnrollments.indexOf(enrollment) === -1
        );

    for (const currentEvents of chunk(50, validEvents)) {
        currentTotalEvents = currentTotalEvents + currentEvents.length;
        callBack(
            `Creating/Updating Events ${currentTotalEvents}/${events.length}`
        );
        try {
            if (api.engine) {
                const { response } = await api.engine.mutate({
                    type: "create",
                    resource: "events",
                    data: { events: currentEvents },
                });
                onInsert("events", response);
            } else if (api.axios) {
                const {
                    data: { response },
                } = await api.axios.post("api/events", {
                    events: currentEvents,
                });
                onInsert("events", response);
            }
        } catch (error: any) {
            const { failed, ...rest } = getConflicts(error.details ?? error);
            onInsert("events", rest);
        }
    }
};

export const loadPreviousMapping = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    namespaces: string[],
    namespaceKey: string
) => {
    if (api.engine) {
        const query = namespaces.map((namespace) => [
            namespace,
            {
                resource: `dataStore/${namespace}/${namespaceKey}`,
            },
        ]);
        return await api.engine.query(fromPairs(query));
    } else if (api.axios) {
        const query = namespaces.map((namespace) =>
            api.axios.get(`api/dataStore/${namespace}/${namespaceKey}`)
        );
        const all = await Promise.all(query);
        return fromPairs(
            all.map(({ data }, index) => [namespaces[index], data])
        );
    }
};

export const loadProgram = async <T>({
    resource,
    api,
    id,
    fields,
}: {
    api: Partial<{ engine: any; axios: AxiosInstance }>;
    resource: string;
    id: string;
    fields: string;
}) => {
    if (api.engine) {
        const query = {
            data: {
                resource: `${resource}/${id}.json`,
                params: {
                    fields,
                },
            },
        };

        const { data }: any = await api.engine.query(query);

        return data as Partial<T>;
    } else if (api.axios) {
        const { data } = await api.axios.get<Partial<T>>(
            `api/${resource}/${id}.json`,
            { params: { fields } }
        );
        return data;
    }

    return {} as Partial<T>;
};

export const getPreviousProgramMapping = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    mapping: Partial<IMapping>,
    callBack: (message: string) => void
) => {
    callBack("Fetching other mappings");
    const previousMappings = await loadPreviousMapping(
        api,
        [
            "iw-ou-mapping",
            "iw-attribute-mapping",
            "iw-stage-mapping",
            "iw-option-mapping",
        ],
        mapping.id ?? ""
    );
    const programStageMapping: StageMapping =
        previousMappings["iw-stage-mapping"] || {};
    const attributeMapping: Mapping =
        previousMappings["iw-attribute-mapping"] || {};
    const organisationUnitMapping: Mapping =
        previousMappings["iw-ou-mapping"] || {};
    const optionMapping: Record<string, string> =
        previousMappings["iw-option-mapping"] || {};

    callBack("Loading program for saved mapping");

    let program = {};

    if (mapping.program && mapping.program.program) {
        program = await loadProgram<IProgram>({
            api,
            resource: "programs",
            id: mapping.program.program,
            fields: "id,name,trackedEntityType[id,featureType],programType,featureType,organisationUnits[id,code,name,parent[name,parent[name,parent[name,parent[name,parent[name]]]]]],programStages[id,repeatable,featureType,name,code,programStageDataElements[id,compulsory,name,dataElement[id,name,code,optionSetValue,optionSet[id,name,options[id,name,code]]]]],programTrackedEntityAttributes[id,mandatory,sortOrder,allowFutureDate,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]",
        });
    }
    return {
        programStageMapping,
        attributeMapping,
        organisationUnitMapping,
        optionMapping,
        program,
    };
};
