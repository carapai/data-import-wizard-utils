import { AxiosInstance } from "axios";
import { Dictionary, isArray, maxBy, minBy, unionBy, uniq } from "lodash";
import { chunk, fromPairs, getOr, groupBy, isEmpty, uniqBy } from "lodash/fp";
import { z } from "zod";
import {
    Authentication,
    CaseInvestigationTemplate,
    Enrollment,
    Event,
    GODataTokenGenerationResponse,
    GoDataEvent,
    IDataSet,
    IGoData,
    IGoDataData,
    IMapping,
    IProgram,
    Mapping,
    Option,
    Processed,
    StageMapping,
    TrackedEntityInstance,
    ValueType,
} from "./interfaces";
import { fetchRemote, getConflicts, postRemote } from "./utils";

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

export const flattenTrackedEntityInstances = (
    response: {
        trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
    },
    flatteningOption: "ALL" | "LAST" | "FIRST",
    specificStages: string[] = []
) => {
    return response.trackedEntityInstances.flatMap(
        ({ attributes, enrollments, ...otherAttributes }) => {
            let current: Record<string, any> = {
                ...otherAttributes,
                ...fromPairs(
                    attributes.map(({ attribute, value }) => [attribute, value])
                ),
            };
            if (enrollments.length > 0) {
                return enrollments.flatMap(
                    ({ events, program, attributes, ...enrollmentData }) => {
                        current = {
                            ...current,
                            ...fromPairs(
                                attributes.map(({ attribute, value }) => [
                                    attribute,
                                    value,
                                ])
                            ),
                            enrollment: enrollmentData,
                        };
                        console.log("==========", events, "=========");

                        if (events && events.length > 0) {
                            if (specificStages.length > 0) {
                                events = events.filter(
                                    (e) =>
                                        specificStages.indexOf(
                                            e.programStage
                                        ) !== -1
                                );
                            }
                            return Object.entries(
                                groupBy("programStage", events)
                            ).flatMap(([_, availableEvents]) => {
                                if (flatteningOption === "ALL") {
                                    return flattenEvents(availableEvents, {
                                        [current.trackedEntityInstance]:
                                            current,
                                    });
                                } else if (flatteningOption === "FIRST") {
                                    return flattenEvents(
                                        [minBy(availableEvents, "eventDate")],
                                        {
                                            [current.trackedEntityInstance]:
                                                current,
                                        }
                                    );
                                } else {
                                    return flattenEvents(
                                        [maxBy(availableEvents, "eventDate")],
                                        {
                                            [current.trackedEntityInstance]:
                                                current,
                                        }
                                    );
                                }
                            });
                        }
                        return current;
                    }
                );
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

export const getDataElements = (program: Partial<IProgram>): Option[] => {
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
                        ...rest
                    },
                    compulsory,
                    allowFutureDate,
                }) => {
                    console.log(rest, valueType);
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

export const findTrackedEntityInstanceIds = ({
    attributeMapping,
    data,
}: {
    data: any[];
    attributeMapping: Mapping;
}): string[] => {
    const {
        info: { trackedEntityInstanceColumn } = {
            trackedEntityInstanceColumn: "",
        },
    } = attributeMapping;
    if (trackedEntityInstanceColumn) {
        return data.flatMap((d) => {
            return getOr("", trackedEntityInstanceColumn, d);
        });
    }

    return [];
};

export const getAttributes = (
    program: Partial<IProgram>
): {
    attributes: Option[];
    enrollmentAttributes: Option[];
    trackedEntityAttributes: Option[];
} => {
    if (!isEmpty(program) && program.programTrackedEntityAttributes) {
        const allAttributes = program.programTrackedEntityAttributes.map(
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

        const enrollmentAttributeIds =
            program.trackedEntityType?.trackedEntityTypeAttributes.map(
                ({ trackedEntityAttribute: { id } }) => id
            );

        const enrollmentAttributes = allAttributes.filter(({ value }) =>
            enrollmentAttributeIds.includes(value)
        );
        const trackedEntityAttributes = allAttributes.filter(
            ({ value }) => !enrollmentAttributeIds.includes(value)
        );
        return {
            attributes: allAttributes,
            trackedEntityAttributes,
            enrollmentAttributes,
        };
    }
    return {
        attributes: [],
        trackedEntityAttributes: [],
        enrollmentAttributes: [],
    };
};

export const makeProgramTypes = (state: Partial<IProgram>) => {
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
    const { info, ...rest } = attributeMapping;
    return Object.entries(rest).flatMap(([attribute, mapping]) => {
        const { unique, value } = mapping;
        if (unique && value) {
            return attribute;
        }
        return [];
    });
};

export const mandatoryAttributes = (attributeMapping: Mapping): string[] => {
    const { info, ...rest } = attributeMapping;
    return Object.entries(rest).flatMap(([attribute, mapping]) => {
        const { unique, value, mandatory } = mapping;
        if (unique && value && mandatory) {
            return attribute;
        }
        return [];
    });
};

export const programUniqColumns = (attributeMapping: Mapping): string[] => {
    const { info, ...rest } = attributeMapping;
    return Object.entries(rest).flatMap(([_, mapping]) => {
        const { unique, value } = mapping;
        if (unique && value) {
            return value;
        }
        return [];
    });
};

export const flattenEvents = (
    events: Array<Partial<Event>>,
    trackedEntityInstances?: Record<string, any>
) => {
    return events.map(
        ({
            dataValues,
            enrollment,
            programStage,
            trackedEntityInstance,
            program,
            ...rest
        }) => {
            const obj = {
                [programStage]: {
                    ...fromPairs(
                        dataValues.map(({ dataElement, value }) => [
                            dataElement,
                            value,
                        ])
                    ),
                    ...rest,
                },
            };
            if (
                trackedEntityInstances &&
                trackedEntityInstances[trackedEntityInstance]
            ) {
                return {
                    ...obj,
                    ...trackedEntityInstances[trackedEntityInstance],
                };
            }

            return obj;
        }
    );
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
            const { uniqueEventDate } = info;
            let uniqueColumns = Object.entries(elements).flatMap(
                ([element, { unique, value }]) => {
                    if (unique && value) {
                        return element;
                    }
                    return [];
                }
            );
            if (uniqueEventDate) {
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
        const {
            programTrackedEntityAttributes,
            programStages,
            trackedEntityType,
        } = program;
        const attributes = programTrackedEntityAttributes.map(
            ({
                trackedEntityAttribute: { id, name, optionSetValue, optionSet },
            }) => {
                const option: Option = {
                    label: name,
                    value: id,
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

        const trackedEntityTypeAttributes =
            trackedEntityType?.trackedEntityTypeAttributes.map(
                ({
                    trackedEntityAttribute: {
                        id,
                        name,
                        optionSetValue,
                        optionSet,
                    },
                }) => ({
                    label: name,
                    value: id,
                    optionSetValue,
                    availableOptions:
                        optionSet?.options.map(({ code, id, name }) => ({
                            label: name,
                            code,
                            value: code,
                            id,
                        })) || [],
                })
            );
        const elements = programStages.flatMap(
            ({ id: stageId, name: stageName, programStageDataElements }) => {
                const dataElements = programStageDataElements.map(
                    ({
                        dataElement: { id, name, optionSetValue, optionSet },
                    }) => {
                        return {
                            label: `${stageName}-${name}`,
                            value: `${stageId}.${id}`,
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

        return {
            attributes: [
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
                    label: "Enrollment",
                    value: "enrollment.enrollment",
                },
                {
                    label: "Tracked Entity Type Geometry",
                    value: "geometry",
                },
                {
                    label: "Enrollment Geometry",
                    value: "enrollment.geometry",
                },
            ],
            elements,
            trackedEntityTypeAttributes,
        };
    }
    return { elements: [], trackedEntityTypeAttributes: [], attributes: [] };
};

export const fetchStageEvents = async ({
    api,
    programStage,
    others = {},
    pageSize = 50,
    afterFetch,
    fetchInstances,
    program,
}: {
    api: Partial<{ engine: any; axios: AxiosInstance }>;
    programStage: string;
    pageSize?: number;
    others?: { [key: string]: string };
    afterFetch: (
        trackedEntityInstances: Array<Partial<TrackedEntityInstance>>
    ) => Promise<void> | void;
    fetchInstances?: boolean;
    program: string;
}) => {
    let page = 1;
    let currentEvents = 0;
    do {
        let params: { [key: string]: string } = {
            programStage,
            pageSize: String(pageSize),
            page: String(page),
            ...others,
        };

        if (params.orgUnit) {
            params = { ...params, ouMode: "DESCENDANTS" };
        } else {
            params = { ...params, ouMode: "ALL" };
        }

        console.log(`Querying page ${page}`);
        let workingEvents: Array<Partial<Event>> = [];

        if (api.engine) {
            const {
                data: { events },
            }: any = await api.engine.query({
                data: {
                    resource: `events.json?${new URLSearchParams(
                        params
                    ).toString()}`,
                },
            });
            workingEvents = events;
            currentEvents = events.length;
        } else if (api.axios) {
            const {
                data: { events },
            } = await api.axios.get<{
                events: Event[];
            }>(`events.json?${new URLSearchParams(params).toString()}`);
            workingEvents = events;
            currentEvents = events.length;
        }
        if (fetchInstances) {
            const ids = workingEvents.map(
                ({ trackedEntityInstance }) => trackedEntityInstance
            );
            const instances = await fetchTrackedEntityInstancesByIds({
                api,
                ids,
                program,
                fields: "created,orgUnit,createdAtClient,trackedEntityInstance,lastUpdated,trackedEntityType,lastUpdatedAtClient,potentialDuplicate,inactive,deleted,featureType,programOwners,relationships[*],attributes[*],enrollments[storedBy,createdAtClient,program,lastUpdated,created,orgUnit,enrollment,trackedEntityInstance,trackedEntityType,lastUpdatedAtClient,orgUnitName,enrollmentDate,deleted,incidentDate,status,attributes[*]]",
            });

            const events = groupBy((a) => {
                return `${a.trackedEntityInstance}${a.enrollment}`;
            }, workingEvents);

            await afterFetch(
                instances.map((e) => ({
                    ...e,
                    enrollments: [
                        ...e.enrollments.map((enrollment) => ({
                            ...enrollment,
                            events: events[
                                `${e.trackedEntityInstance}${enrollment.enrollment}`
                            ],
                        })),
                    ],
                }))
            );
        } else {
            await afterFetch([{ enrollments: [{ events: workingEvents }] }]);
        }
        page = page + 1;
    } while (currentEvents > 0);
};

export const fetchEvents = async ({
    api,
    programStages,
    pageSize,
    others = {},
    program,
    afterFetch,
    fetchInstances,
}: {
    api: Partial<{ engine: any; axios: AxiosInstance }>;
    programStages: string[];
    pageSize: number;
    program: string;
    others: { [key: string]: string };
    afterFetch: (
        events: Array<Partial<TrackedEntityInstance>>
    ) => Promise<void> | void;
    fetchInstances: boolean;
}) => {
    for (const programStage of programStages) {
        await fetchStageEvents({
            api,
            programStage,
            pageSize,
            others,
            afterFetch: afterFetch,
            program,
            fetchInstances,
        });
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
    } else if (isArray(params) && api.axios) {
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
    } else if (api.engine) {
        const { data }: any = await api.engine.query({
            data: {
                resource: `trackedEntityInstances.json?${params.toString()}`,
            },
        });
        return data;
    } else if (api.axios) {
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
): Promise<{
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
}> => {
    let foundInstances: Array<Partial<TrackedEntityInstance>> = [];
    if (trackedEntityInstances.length > 0) {
        const data = await fetchTrackedEntityInstancesByIds({
            api,
            program,
            ids: trackedEntityInstances,
        });

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
            if (additionalParams["ou"]) {
                params.append("ouMode", "DESCENDANTS");
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

                if (additionalParams["ou"]) {
                    params.append("ouMode", "DESCENDANTS");
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
        if (additionalParams["ou"]) {
            params = { ...params, ouMode: "DESCENDANTS" };
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

export const fetchTrackedEntityInstancesByIds = async ({
    api,
    program,
    ids,
    fields = "*",
}: {
    api: Partial<{ engine: any; axios: AxiosInstance }>;
    program: string;
    ids: string[];
    fields?: string;
}) => {
    let instances: Array<Partial<TrackedEntityInstance>> = [];
    if (ids.length > 0) {
        for (const c of chunk(50, ids)) {
            const params = new URLSearchParams({
                trackedEntityInstance: `${c.join(";")}`,
                fields,
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

    let availableEvents = events ?? [].concat(eventUpdates ?? []);
    let availableEntities =
        trackedEntityInstances ?? [].concat(trackedEntityInstanceUpdates ?? []);
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
            const processedData = {
                trackedEntities: convertEntities(instances),
                enrollments: convertEnrollments(validEnrollments),
                events: convertEvents(validEvents),
            };
            if (api.engine) {
                const response: any = await api.engine.mutate({
                    type: "create",
                    resource: "tracker",
                    data: processedData,
                    params: { async },
                });
                onInsert(response);
            } else if (api.axios) {
                const { data } = await api.axios.post(
                    "api/tracker",
                    processedData,
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

        const payload = {
            enrollments: convertEnrollments(enrollment),
            events: convertEvents(validEvents),
        };

        try {
            if (api.engine) {
                const response: any = await api.engine.mutate({
                    type: "create",
                    resource: "tracker",
                    data: payload,
                    params: { async },
                });
                onInsert(response);
            } else if (api.axios) {
                const { data } = await api.axios.post("api/tracker", payload, {
                    params: { async },
                });
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
            "iw-enrollment-mapping",
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
    const enrollmentMapping: Mapping =
        previousMappings["iw-enrollment-mapping"] || {};

    callBack("Loading program for saved mapping");

    let program: Partial<IProgram> = {};
    let remoteProgram: Partial<IProgram> = {};

    if (mapping.program && mapping.program.program) {
        program = await loadProgram<Partial<IProgram>>({
            api,
            resource: "programs",
            id: mapping.program.program,
            fields: "id,name,registration,trackedEntityType[id,featureType,trackedEntityTypeAttributes[id,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]],programType,featureType,organisationUnits[id,code,name,parent[name,parent[name,parent[name,parent[name,parent[name]]]]]],programStages[id,repeatable,featureType,name,code,programStageDataElements[id,compulsory,name,dataElement[id,name,valueType,code,optionSetValue,optionSet[id,name,options[id,name,code]]]]],programTrackedEntityAttributes[id,mandatory,sortOrder,allowFutureDate,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]",
        });
    }

    if (mapping.program && mapping.program.remoteProgram) {
        remoteProgram = await loadProgram<Partial<IProgram>>({
            api,
            resource: "programs",
            id: mapping.program.remoteProgram,
            fields: "id,name,trackedEntityType[id,featureType,trackedEntityTypeAttributes[id,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]],programType,featureType,organisationUnits[id,code,name,parent[name,parent[name,parent[name,parent[name,parent[name]]]]]],programStages[id,repeatable,featureType,name,code,programStageDataElements[id,compulsory,name,dataElement[id,name,valueType,code,optionSetValue,optionSet[id,name,options[id,name,code]]]]],programTrackedEntityAttributes[id,mandatory,sortOrder,allowFutureDate,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]",
        });
    }
    return {
        programStageMapping,
        attributeMapping,
        organisationUnitMapping,
        optionMapping,
        program,
        remoteProgram,
        enrollmentMapping,
    };
};

export const getPreviousAggregateMapping = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    mapping: Partial<IMapping>,
    callBack: (message: string) => void
) => {
    callBack("Fetching saved mapping");
    const previousMappings = await loadPreviousMapping(
        api,
        ["iw-ou-mapping", "iw-attribute-mapping", "iw-attribution-mapping"],
        mapping.id ?? ""
    );
    const attributeMapping: Mapping =
        previousMappings["iw-attribute-mapping"] || {};
    const organisationUnitMapping: Mapping =
        previousMappings["iw-ou-mapping"] || {};
    const attributionMapping: Mapping =
        previousMappings["iw-attribution-mapping"] || {};

    let dataSet: Partial<IDataSet> = {};
    let remoteDataSet: Partial<IDataSet> = {};
    if (mapping.aggregate?.dataSet) {
        callBack("Loading data set for saved mapping");
        dataSet = await loadProgram<Partial<IDataSet>>({
            api,
            resource: "dataSets",
            id: mapping.aggregate.dataSet,
            fields: "id,name,code,organisationUnits[id,name,code],categoryCombo[categories[id,name,code,categoryOptions[id,name,code]],categoryOptionCombos[code,name,id,categoryOptions[id,name,code]]],dataSetElements[dataElement[id,name,code,categoryCombo[categories[id,name,code,categoryOptions[id,name,code]],categoryOptionCombos[code,name,id,categoryOptions[id,name,code]]]]]",
        });
    }

    if (mapping.aggregate && mapping.aggregate.remote) {
        remoteDataSet = await loadProgram<Partial<IDataSet>>({
            api,
            resource: "dataSets",
            id: mapping.aggregate.remote,
            fields: "id,name,code,organisationUnits[id,name,code],categoryCombo[categories[id,name,code,categoryOptions[id,name,code]],categoryOptionCombos[code,name,id,categoryOptions[id,name,code]]],dataSetElements[dataElement[id,name,code,categoryCombo[categories[id,name,code,categoryOptions[id,name,code]],categoryOptionCombos[code,name,id,categoryOptions[id,name,code]]]]]",
        });
    }
    return {
        attributeMapping,
        organisationUnitMapping,
        dataSet,
        attributionMapping,
        remoteDataSet,
    };
};
