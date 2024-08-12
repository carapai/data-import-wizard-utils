import { AxiosInstance } from "axios";
import { Dictionary, isArray } from "lodash";
import { chunk, fromPairs, getOr, isEmpty, uniqBy } from "lodash/fp";
import { z } from "zod";
import {
    Enrollment,
    Event,
    IDataSet,
    IMapping,
    IProgram,
    Mapping,
    Option,
    Processed,
    StageMapping,
    TrackedEntityInstance,
    ValueType,
} from "./interfaces";
import { getConflicts } from "./utils";

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
    data: any,
    attributeMapping: Mapping,
): Array<Dictionary<any>> => {
    if (isArray(data)) {
        return data.flatMap((d) => {
            const values = Object.entries(attributeMapping).flatMap(
                ([attribute, mapping]) => {
                    const { unique, value } = mapping;
                    const foundValue = getOr("", value, d);
                    if (unique && value && foundValue) {
                        return { attribute, value: foundValue };
                    }
                    return [];
                },
            );
            if (values.length > 0) {
                return fromPairs<any>(
                    values.map(({ attribute, value }) => [attribute, value]),
                );
            }
            return [];
        });
    }
    return [];
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
                },
            );
            if (eventDateIsUnique) {
                uniqueColumns = [...uniqueColumns, "eventDate"];
            }

            return [stage, uniqueColumns];
        },
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
                },
            ),
        );
    }
    return [];
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
    program: Partial<IProgram>,
): {
    attributes: Option[];
    enrollmentAttributes: Option[];
    trackedEntityAttributes: Option[];
} => {
    if (!isEmpty(program) && program.programTrackedEntityAttributes) {
        const trackedEntityAttributes =
            program.trackedEntityType.trackedEntityTypeAttributes.map(
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
                },
            );
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
            },
        );

        const trackedEntityTypeAttributeIds = trackedEntityAttributes.map(
            ({ value }) => value,
        );

        const enrollmentAttributes = allAttributes.filter(
            ({ value }) => !trackedEntityTypeAttributeIds.includes(value),
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
                    },
                ) => {
                    let zodType = ValueType[valueType];
                    if (!mandatory) {
                        zodType.optional();
                    }
                    return { ...agg, [id]: zodType };
                },
                {},
            ),
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
                        {},
                    ),
                );

                return [id, type];
            }),
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

export const getProgramUniqAttributes = (
    attributeMapping: Mapping,
): string[] => {
    const { info, ...rest } = attributeMapping;
    return Object.entries(rest).flatMap(([attribute, mapping]) => {
        const { unique, value } = mapping;
        if (unique && value) {
            return attribute;
        }
        return [];
    });
};

export const getMandatoryAttributes = (attributeMapping: Mapping): string[] => {
    const { info, ...rest } = attributeMapping;
    return Object.entries(rest).flatMap(([attribute, mapping]) => {
        const { unique, value, mandatory } = mapping;
        if (unique && value && mandatory) {
            return attribute;
        }
        return [];
    });
};

export const getProgramUniqColumns = (attributeMapping: Mapping): string[] => {
    const { info, ...rest } = attributeMapping;
    return Object.entries(rest).flatMap(([_, mapping]) => {
        const { unique, value } = mapping;
        if (unique && value) {
            return value;
        }
        return [];
    });
};

export const getProgramStageUniqColumns = (
    programStageMapping: StageMapping,
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
                },
            );
            if (eventDateIsUnique) {
                uniqueColumns = [...uniqueColumns, info.eventDateColumn || ""];
            }

            return [stage, uniqueColumns];
        },
    );
    return fromPairs(uniqElements);
};

export const getProgramStageUniqElements = (
    programStageMapping: StageMapping,
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
                },
            );
            if (uniqueEventDate) {
                uniqueColumns = [...uniqueColumns, "eventDate"];
            }

            return [stage, uniqueColumns];
        },
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
            },
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
                }),
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
                                    }),
                                ) || [],
                        };
                    },
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
            },
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

export const joinAttributes = (
    trackedEntities: Array<Partial<TrackedEntityInstance>>,
    program: string,
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
        },
    );
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
        }),
    );
};

const convertEvents = (enrollments: Partial<Event>[]) => {
    return enrollments.map(
        ({ trackedEntityInstance, eventDate, dueDate, ...rest }) => ({
            ...rest,
            trackedEntity: trackedEntityInstance,
            scheduledAt: dueDate,
            occurredAt: eventDate,
        }),
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
    let availableEvents = events.concat(eventUpdates);
    let availableEntities = trackedEntityInstances.concat(
        trackedEntityInstanceUpdates,
    );
    for (const instances of chunk(chunkSize, availableEntities)) {
        const instanceIds = instances.map(
            ({ trackedEntityInstance }) => trackedEntityInstance,
        );
        const validEnrollments = enrollments.filter(
            ({ trackedEntityInstance }) =>
                instanceIds.indexOf(trackedEntityInstance) !== -1,
        );
        const enrollmentIds = validEnrollments.map(
            ({ enrollment }) => enrollment,
        );
        const validEvents = availableEvents.filter(
            ({ enrollment }) => enrollmentIds.indexOf(enrollment) !== -1,
        );

        availableEvents = availableEvents.filter(
            ({ enrollment }) => enrollmentIds.indexOf(enrollment) === -1,
        );
        enrollments = enrollments.filter(
            ({ trackedEntityInstance }) =>
                instanceIds.indexOf(trackedEntityInstance) === -1,
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
                    { params: { async } },
                );
                onInsert(data);
            }
        } catch (error: any) {}
    }

    for (const enrollment of chunk(chunkSize, enrollments)) {
        const enrollmentIds = enrollment.map(({ enrollment }) => enrollment);
        const validEvents = availableEvents.filter(
            ({ enrollment }) => enrollmentIds.indexOf(enrollment) !== -1,
        );
        availableEvents = availableEvents.filter(
            ({ enrollment }) => enrollmentIds.indexOf(enrollment) === -1,
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
                    { params: { async } },
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
        trackedEntityInstanceUpdates ?? [],
    );

    for (const instances of chunk(chunkSize, allTrackedEntityInstances)) {
        currentTotalEntities = currentTotalEntities + instances.length;
        callBack(
            `Creating tracked entities ${currentTotalEntities}/${allTrackedEntityInstances.length}`,
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
            failedInstances.indexOf(trackedEntityInstance) === -1,
    );

    for (const enrollment of chunk(50, validEnrollments)) {
        currentTotalEnrollments = currentTotalEnrollments + enrollment.length;
        callBack(
            `Creating Enrollments ${currentTotalEnrollments}/${allTotalEnrollments}`,
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
                failedEnrollments.indexOf(enrollment) === -1,
        );

    for (const currentEvents of chunk(50, validEvents)) {
        currentTotalEvents = currentTotalEvents + currentEvents.length;
        callBack(
            `Creating/Updating Events ${currentTotalEvents}/${events.length}`,
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
    namespaceKey: string,
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
            api.axios.get(`api/dataStore/${namespace}/${namespaceKey}`),
        );
        const all = await Promise.all(query);
        return fromPairs(
            all.map(({ data }, index) => [namespaces[index], data]),
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
            { params: { fields } },
        );
        return data;
    }

    return {} as Partial<T>;
};

export const getPreviousProgramMapping = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    mapping: Partial<IMapping>,
    callBack: (message: string) => void,
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
        mapping.id ?? "",
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
            fields: "id,name,registration,trackedEntityType[id,featureType,trackedEntityTypeAttributes[id,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]],programType,featureType,organisationUnits[id,code,name,parent[name,parent[name,parent[name,parent[name,parent[name]]]]]],programStages[id,repeatable,featureType,name,code,programStageDataElements[id,compulsory,name,dataElement[id,name,code,valueType,optionSetValue,optionSet[id,name,options[id,name,code]]]]],programTrackedEntityAttributes[id,mandatory,sortOrder,allowFutureDate,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]",
        });
    }

    if (mapping.program && mapping.program.remoteProgram) {
        remoteProgram = await loadProgram<Partial<IProgram>>({
            api,
            resource: "programs",
            id: mapping.program.remoteProgram,
            fields: "id,name,registration,trackedEntityType[id,featureType,trackedEntityTypeAttributes[id,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]],programType,featureType,organisationUnits[id,code,name,parent[name,parent[name,parent[name,parent[name,parent[name]]]]]],programStages[id,repeatable,featureType,name,code,programStageDataElements[id,compulsory,name,dataElement[id,name,code,valueType,optionSetValue,optionSet[id,name,options[id,name,code]]]]],programTrackedEntityAttributes[id,mandatory,sortOrder,allowFutureDate,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]]",
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
    callBack: (message: string) => void,
) => {
    callBack("Fetching saved mapping");
    const previousMappings = await loadPreviousMapping(
        api,
        ["iw-ou-mapping", "iw-attribute-mapping", "iw-attribution-mapping"],
        mapping.id ?? "",
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
