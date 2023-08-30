import { format, parseISO } from "date-fns/fp";
import { Dictionary, maxBy, minBy } from "lodash";
import {
    chunk,
    fromPairs,
    getOr,
    groupBy,
    isEmpty,
    set,
    uniqBy,
    update,
} from "lodash/fp";
import { z } from "zod";

import { AxiosInstance } from "axios";
import {
    GO_DATA_EPIDEMIOLOGY_FIELDS,
    GO_DATA_EVENTS_FIELDS,
    GO_DATA_PERSON_FIELDS,
} from "./constants";
import {
    CaseInvestigationTemplate,
    DHIS2OrgUnit,
    DataValue,
    Enrollment,
    Event,
    FlattenedEvent,
    FlattenedInstance,
    IGoData,
    IProgram,
    IProgramMapping,
    IProgramStage,
    Mapping,
    Option,
    StageMapping,
    TrackedEntityInstance,
    ValueType,
} from "./interfaces";
import { generateUid } from "./uid";
import { compareArrays, findDifference, mergeArrays } from "./utils";

export const stepLabels: { [key: number]: string } = {
    0: "Create New Mapping",
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
        [key: string]: Array<{ dataElement: string; value: string }>;
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
                                            const val = getOr("", value, row);
                                            const dv: Partial<DataValue> = {
                                                dataElement,
                                                value: options[val] || val,
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
                const prev = Object.values(stagePreviousEvents);
                if (prev.length === 0) {
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
                    console.log(prev);
                    console.log("This event already exists");
                }
            }
            return [];
        }
    );
};

export const convertFromDHIS2 = async (
    data: Array<Partial<FlattenedInstance>>,
    programMapping: Partial<IProgramMapping>,
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

        if (programMapping.orgUnitColumn) {
            update(
                programMapping.orgUnitColumn,
                () => organisationUnitMapping[instanceData.orgUnit],
                obj
            );
        }
        if (programMapping.incidentDateColumn) {
            update(
                programMapping.incidentDateColumn,
                () => instanceData.enrollment.incidentDate,
                obj
            );
        }
        if (programMapping.enrollmentDateColumn) {
            update(
                programMapping.enrollmentDateColumn,
                () => instanceData.enrollment.enrollmentDate,
                obj
            );
        }
        if (programMapping.trackedEntityInstanceColumn) {
            update(
                programMapping.trackedEntityInstanceColumn,
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
    previousData: any[]
) => {
    const attributes = goData.caseInvestigationTemplate.map(({ variable }) => {
        return variable;
    });
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
    let allAttributes = fromPairs<Option>(
        [
            ...GO_DATA_PERSON_FIELDS,
            ...GO_DATA_EPIDEMIOLOGY_FIELDS,
            ...GO_DATA_EVENTS_FIELDS,
            ...flattenGoData(goData.caseInvestigationTemplate, tokens),
        ].map((attribute) => [attribute.value, attribute])
    );

    let errors: any[] = [];
    let conflicts: any[] = [];
    let updates: any[] = [];
    let inserts: any[] = [];
    data.forEach((instanceData) => {
        let questionnaireAnswers: { [key: string]: Array<{ value: any }> } = {};
        let obj: { [key: string]: any } = {};
        let currentConflicts: any[] = [];
        let currentErrors: any[] = [];
        let currentValue: { [key: string]: any } = {};
        Object.entries(attributeMapping).forEach(([attribute, mapping]) => {
            const currentAttribute = allAttributes[attribute];
            if (mapping.value) {
                const validation = ValueType[mapping.valueType];
                let value = getOr("", mapping.value, instanceData);
                if (mapping.specific) {
                    value = mapping.value;
                }
                let result: any = { success: true };
                if (currentAttribute.optionSetValue) {
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
                        result = { ...result, success: false };
                    }
                } else if (validation) {
                    try {
                        result = validation.parse(value);
                        result = { ...result, success: true };
                    } catch (error) {
                        const { issues } = error;
                        result = { ...issues[0], success: false };
                        if (mapping.mandatory) {
                            currentErrors = [
                                ...currentErrors,
                                ...issues.map((i: any) => ({
                                    ...i,
                                    value,
                                    attribute,
                                    valueType: mapping.valueType,
                                })),
                            ];
                        } else {
                            currentConflicts = [
                                ...currentConflicts,
                                ...issues.map((i: any) => ({
                                    ...i,
                                    value,
                                    attribute,
                                    valueType: mapping.valueType,
                                })),
                            ];
                        }
                    }
                }
                if (value && result.success) {
                    if (attributes.indexOf(attribute) !== -1) {
                        questionnaireAnswers = {
                            ...questionnaireAnswers,
                            [attribute]: [{ value }],
                        };
                    } else {
                        if (mapping.isOrgUnit) {
                            currentValue = set(
                                attribute,
                                flippedUnits[value] || "",
                                currentValue
                            );
                        } else {
                            currentValue = set(attribute, value, currentValue);
                        }
                        obj = { ...obj, ...currentValue };
                    }
                }
            }
        });
        if (currentErrors.length === 0) {
            const instance: { [key: string]: any } = {
                ...obj,
                questionnaireAnswers,
            };
            const prev = previousData.find(
                (i: any) => i.visualId === instance.visualId
            );
            if (prev) {
                updates = [...updates, { ...instance, id: prev.id }];
            } else {
                inserts = [...inserts, instance];
            }
        }
        errors = [...errors, ...currentErrors];
        conflicts = [...conflicts, ...currentConflicts];
    });

    return { updates, inserts, errors, conflicts };
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
        orgUnits: Dictionary<string>;
    },
    data: any[],
    programMapping: Partial<IProgramMapping>,
    organisationUnitMapping: Mapping,
    attributeMapping: Mapping,
    programStageMapping: StageMapping,
    optionMapping: Record<string, string>,
    version: number,
    program: Partial<IProgram>,
    elements: Dictionary<z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>>,
    attributesSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>
) => {
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
        programStages.map((programStage) => {
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

    const flippedOptions = fromPairs(
        Object.entries(optionMapping).map(([option, value]) => {
            return [value, option];
        })
    );

    const orgUnitColumn = programMapping.orgUnitColumn || "";
    const enrollmentDateColumn = programMapping.enrollmentDateColumn || "";
    const incidentDateColumn = programMapping.incidentDateColumn || "";
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
            console.log(flippedOptions);
            const currentAttributes = Object.entries(attributeMapping).flatMap(
                ([attribute, { value, specific, valueType, mandatory }]) => {
                    if (specific) {
                        return { attribute, value };
                    }
                    const validation = ValueType[valueType];
                    let realValue = getOr("", value, current[0]);
                    realValue = flippedUnits[realValue] || realValue;

                    let result: any = { success: true };
                    if (validation) {
                        try {
                            result = validation.parse(realValue);
                            result = { ...result, success: true };
                        } catch (error) {
                            const { issues } = error;
                            result = { ...issues[0], success: false };
                            if (mandatory) {
                                currentErrors = [
                                    ...currentErrors,
                                    ...issues.map((i: any) => ({
                                        ...i,
                                        value,
                                        attribute,
                                        valueType,
                                    })),
                                ];
                            } else {
                                currentConflicts = [
                                    ...currentConflicts,
                                    ...issues.map((i: any) => ({
                                        ...i,
                                        value,
                                        attribute,
                                        valueType,
                                    })),
                                ];
                            }
                        }
                    }
                    if (realValue && result.success) {
                        return {
                            attribute,
                            value: flippedOptions[realValue] || realValue,
                        };
                    }
                    return [];
                }
            );

            const isTheSame = compareArrays(
                currentAttributes,
                previousAttributes,
                "attribute"
            );
            if (previousAttributes.length > 0 && updateEntities) {
                if (!isTheSame) {
                    const attributes = mergeArrays(
                        currentAttributes,
                        previousAttributes,
                        "attribute"
                    );
                    results = {
                        ...results,
                        trackedEntityUpdates: [
                            {
                                trackedEntityInstance: previousTrackedEntity,
                                attributes,
                                trackedEntityType:
                                    programMapping.trackedEntityType,
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
                                attributes: currentAttributes,
                                trackedEntityType:
                                    programMapping.trackedEntityType,
                                orgUnit: previousOrgUnit,
                            },
                        ],
                    };
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
                        program: programMapping.program,
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
                    programMapping.program || "",
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
            currentAttributes.push([attributeKey, attributes]);
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

                            if (stageElements && stageElements.length > 0) {
                                console.log("Are we here now");
                                console.log(
                                    stage,
                                    programStageUniqueElements,
                                    stageElements
                                );
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
                            return [stage, availableEvents.map((e) => [e])];
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
    return program.programTrackedEntityAttributes?.map(
        ({
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
};

export const flattenGoData = (
    caseInvestigationTemplates: CaseInvestigationTemplate[],
    tokens: Dictionary<string> = {}
) => {
    return caseInvestigationTemplates.flatMap(
        ({ variable, required, multiAnswer, answers, answerType, text }) => {
            const original = tokens[text] || variable;
            if (
                answerType ===
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MULTIPLE_ANSWERS"
            ) {
                // return [];
                return answers.flatMap(
                    ({ additionalQuestions, value, order, alert, label }) => {
                        const currentLabel = tokens[label] || label;
                        const currentOpt = {
                            label: `${original} ${currentLabel}`,
                            value,
                            mandatory: false,
                            availableOptions: [],
                            optionSetValue: false,
                        };
                        if (additionalQuestions) {
                            const additional = additionalQuestions.map(
                                ({ variable, text }) => {
                                    return {
                                        label: tokens[text] || variable,
                                        value: variable,
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
                            value,
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
                                        value: variable,
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
    programMapping: Partial<IProgramMapping>,
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
    const destinationAttributes = getAttributes(program);
    const uniqueAttributeValues = findUniqAttributes(data, attributeMapping);
    const destinationStages =
        program?.programStages?.map(({ id, name }) => {
            const option: Option = {
                label: name,
                value: id,
            };
            return option;
        }) || [];
    let results: {
        sourceOrgUnits: Array<Option>;
        destinationOrgUnits: Array<Option>;
        sourceColumns: Array<Option>;
        destinationColumns: Array<Option>;
        sourceAttributes: Array<Option>;
        destinationAttributes: Array<Option>;
        sourceStages: Array<Option>;
        destinationStages: Array<Option>;
        uniqueAttributeValues: Array<{ attribute: string; value: string }>;
        epidemiology: Array<Option>;
        personal: Array<Option>;
        questionnaire: Array<Option>;
        events: Array<Option>;
        lab: Array<Option>;
    } = {
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
        personal: [],
        questionnaire: [],
        events: [],
        lab: [],
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
        const stageDataElements = flattenProgram(dhis2Program);
        if (programMapping.isSource) {
            results = {
                ...results,
                sourceOrgUnits: results.destinationOrgUnits,
                destinationOrgUnits: sourceOrgUnits,
                destinationAttributes: attributes,
                sourceAttributes: results.destinationAttributes,
                destinationColumns: stageDataElements,
                sourceColumns: results.destinationColumns,
                destinationStages: stages,
                sourceStages: results.destinationStages,
            };
        } else {
            results = {
                ...results,
                sourceOrgUnits,
                sourceAttributes: attributes,
                sourceColumns: stageDataElements,
                sourceStages: stages,
            };
        }
    } else if (programMapping.dataSource === "godata") {
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
        ];
        let investigationTemplate = [];
        if (goData && goData.caseInvestigationTemplate) {
            investigationTemplate = flattenGoData(
                goData.caseInvestigationTemplate,
                tokens
            );
        }
        columns = [...attributes, ...columns, ...investigationTemplate];
        if (programMapping.isSource) {
            results = {
                ...results,
                destinationOrgUnits: units,
                sourceOrgUnits: results.destinationOrgUnits,
                sourceAttributes: results.destinationAttributes,
                sourceColumns: results.destinationColumns,
                destinationColumns: columns.sort((a, b) => {
                    if (a.mandatory && !b.mandatory) {
                        return -1;
                    } else if (!a.mandatory && b.mandatory) {
                        return 1;
                    }
                    return 0;
                }),
                destinationAttributes: attributes,
                destinationStages: [],
                sourceStages: results.destinationStages,
                epidemiology: GO_DATA_EPIDEMIOLOGY_FIELDS.sort((a, b) => {
                    if (a.mandatory && !b.mandatory) {
                        return -1;
                    } else if (!a.mandatory && b.mandatory) {
                        return 1;
                    }
                    return 0;
                }),
                personal: GO_DATA_PERSON_FIELDS.sort((a, b) => {
                    if (a.mandatory && !b.mandatory) {
                        return -1;
                    } else if (!a.mandatory && b.mandatory) {
                        return 1;
                    }
                    return 0;
                }),
                events: uniqBy("value", [
                    ...attributes.filter(
                        ({ entity }) => entity && entity.indexOf("EVENT") !== -1
                    ),
                    ...GO_DATA_EVENTS_FIELDS,
                ]),
                questionnaire: investigationTemplate,
            };
        } else {
            results = {
                ...results,
                sourceOrgUnits: units,
                sourceColumns: columns,
                sourceAttributes: attributes,
            };
        }
    } else {
        let columns: Array<Option> = [];
        if (
            programMapping.metadataOptions &&
            programMapping.metadataOptions.metadata &&
            programMapping.metadataOptions.metadata.length > 0
        ) {
            columns = programMapping.metadataOptions.metadata;
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
        if (programMapping.isSource) {
            results = {
                ...results,
                destinationOrgUnits: units,
                sourceOrgUnits: results.destinationOrgUnits,
                sourceAttributes: results.destinationAttributes,
                destinationColumns: columns,
                uniqueAttributeValues,
                sourceStages: results.destinationStages,
                sourceColumns: results.destinationColumns,
                destinationStages: [],
            };
        } else {
            results = {
                ...results,
                sourceOrgUnits: units,
                sourceColumns: columns,
                sourceAttributes: columns,
                uniqueAttributeValues,
            };
        }
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

export const canQueryDHIS2 = (state: Partial<IProgramMapping>) => {
    return (
        state.dataSource === "dhis2" &&
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

const validURL = (
    programMapping: Partial<IProgramMapping>,
    mySchema: z.ZodSchema
) => {
    if (
        !isEmpty(programMapping.name) &&
        ["api", "godata", "dhis2"].indexOf(programMapping.dataSource) !== -1
    ) {
        return mySchema.safeParse(programMapping.authentication?.url).success;
    }
    return true;
};

const hasLogins = (programMapping: Partial<IProgramMapping>) => {
    if (
        ["godata", "api", "dhis2"].indexOf(programMapping.dataSource) &&
        programMapping.authentication.basicAuth
    ) {
        return (
            !isEmpty(programMapping.authentication.username) &&
            !isEmpty(programMapping.authentication.password)
        );
    }
    return true;
};

const hasRemote = (programMapping: Partial<IProgramMapping>) => {
    if (["godata", "dhis2"].indexOf(programMapping.dataSource) !== -1) {
        return !isEmpty(programMapping.remoteProgram);
    }
    return true;
};

const hasProgram = (programMapping: Partial<IProgramMapping>) =>
    !isEmpty(programMapping.program);

const hasOrgUnitColumn = (programMapping: Partial<IProgramMapping>) =>
    !isEmpty(programMapping.orgUnitColumn);

const createEnrollment = (programMapping: Partial<IProgramMapping>) => {
    if (programMapping.createEnrollments) {
        return (
            !isEmpty(programMapping.enrollmentDateColumn) &&
            !isEmpty(programMapping.incidentDateColumn)
        );
    }
    return true;
};

const hasOrgUnitMapping = (
    programMapping: Partial<IProgramMapping>,
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

export const isDisabled = (
    programMapping: Partial<IProgramMapping>,
    programStageMapping: StageMapping,
    attributeMapping: Mapping,
    organisationUnitMapping: Mapping,
    step: number,
    mySchema: z.ZodSchema,
    destinationFields: Option[]
) => {
    if (step === 2) {
        return !hasProgram(programMapping);
    }

    if (step === 3) {
        return (
            !validURL(programMapping, mySchema) || !hasLogins(programMapping)
        );
    }

    if (
        programMapping.isSource &&
        programMapping.dataSource === "godata" &&
        step === 4
    ) {
        return !hasRemote(programMapping);
    }

    if (step === 5 && ["godata", "dhis2"].indexOf(programMapping.dataSource)) {
        return !(Object.keys(organisationUnitMapping).length > 0);
    }
    if (
        programMapping.dataSource === "godata" &&
        step === 6 &&
        programMapping.isSource
    ) {
        return !mandatoryAttributesMapped(
            destinationFields.filter(
                ({ entity }) =>
                    entity && entity.indexOf(programMapping.responseKey) !== -1
            ),
            attributeMapping
        );
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
                        const option: Option = {
                            label: `${stageName}-${name}`,
                            value: `last.${stageId}.values.${id}`,
                            optionSetValue: optionSetValue || false,
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
                        return option;
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
    programMapping: Partial<IProgramMapping>,
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
    let foundInstances: TrackedEntityInstance[] = [];
    if (withAttributes) {
        let page = 1;
        for (const attributeValues of chunk(50, uniqueAttributeValues)) {
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
            params.append("program", programMapping.program || "");
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
    } else {
        let page = 1;
        let instances = 0;
        do {
            const params = new URLSearchParams({
                ouMode: "ALL",
                fields: "*",
                program: programMapping.program || "",
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
