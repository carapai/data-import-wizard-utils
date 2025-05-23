import { AxiosInstance } from "axios";
import { isArray, isEmpty, uniq } from "lodash";
import { getOr } from "lodash/fp";
import { emptyProcessedData } from "./constants";
import { convertToDHIS2 } from "./dhis2-converter";
import { processPreviousInstances } from "./entities-processor";
import { fetchEvents } from "./fetch-events";
import { fetchGoDataData } from "./fetch-go-data";
import { fetchTrackedEntityInstances } from "./fetch-tracked-entities";
import { getFetcher } from "./fetchers";
import { getFlattener } from "./flatteners";
import { convertToGoData } from "./go-data-converter";
import {
    GODataOption,
    IGoData,
    IMapping,
    IProgram,
    Mapping,
    Metadata,
    Processed,
    StageMapping,
} from "./interfaces";
import {
    getProgramStageUniqElements,
    getProgramUniqAttributes,
} from "./program";
import { isExcel, processInstances } from "./utils";

export const convert = async ({
    mapping,
    attributeMapping,
    enrollmentMapping,
    organisationUnitMapping,
    optionMapping,
    programStageMapping,
    sourceApi,
    destinationApi,
    setMessage,
    afterConversion,
    additionalParams,
    version,
    data,
    goData,
    tokens,
    program,
    metadata,
    referenceData,
    attributionMapping,
}: {
    mapping: Partial<IMapping>;
    attributeMapping: Mapping;
    enrollmentMapping: Mapping;
    attributionMapping: Mapping;
    organisationUnitMapping: Mapping;
    optionMapping: Map<string, string>;
    programStageMapping: StageMapping;
    sourceApi: Partial<{ engine: any; axios: AxiosInstance }>;
    destinationApi: Partial<{ engine: any; axios: AxiosInstance }>;
    setMessage: (message: string) => void;
    afterConversion: (
        data: Processed,
        pager: Partial<{
            page: number;
            pageCount: number;
            total: number;
            pageSize: number;
        }>,
    ) => void;
    additionalParams?: {
        [key: string]: string;
    };
    version: number;
    data: any[];
    goData: Partial<IGoData>;
    tokens: Map<string, string>;
    program: Partial<IProgram>;
    metadata: Metadata;
    referenceData: GODataOption[];
}) => {
    const programUniqAttributes = getProgramUniqAttributes({
        ...attributeMapping,
        ...enrollmentMapping,
    });
    const uniqueAttributeValues = data.map((d) => {
        return programUniqAttributes.reduce<Record<string, string>>(
            (acc, attribute) => {
                const value = getOr<string>("", attribute.source, d);
                if (value) {
                    acc[attribute.destination] = value;
                }
                return acc;
            },
            {},
        );
    });
    const programStageUniqueElements = getProgramStageUniqElements(
        mapping.eventStageMapping,
        programStageMapping,
    );

    const {
        trackedEntityMapping: { trackedEntityInstanceColumn } = {
            trackedEntityMapping: { trackedEntityInstanceColumn: "" },
        },
    } = mapping;
    await getFetcher({
        data,
        mapping,
        afterFetch: async ({
            trackedEntityInstances,
            data,
            goDataData,
            pager,
            events,
        }) => {
            const flattenedData = getFlattener({
                mapping,
                data: { trackedEntityInstances, data, goDataData },
                tokens,
            });
            if (mapping.isSource) {
                if (isExcel(mapping)) {
                    afterConversion(
                        {
                            ...emptyProcessedData,
                            processedData: flattenedData,
                        },
                        pager,
                    );
                } else if (mapping.dataSource === "api") {
                } else if (mapping.dataSource === "dhis2-program") {
                    await processInstances(
                        {
                            mapping,
                            attributeMapping,
                            enrollmentMapping,
                            programStageMapping,
                            organisationUnitMapping,
                            optionMapping,
                            trackedEntityInstances,
                            program,
                            version,
                            api: destinationApi,
                            setMessage,
                            attributionMapping,
                        },
                        async (data) => afterConversion(data, pager),
                    );
                } else if (mapping.dataSource === "go-data") {
                    const { metadata } = await fetchGoDataData(
                        goData,
                        mapping.authentication,
                    );
                    const convertedGoData = convertToGoData(
                        flattenedData,
                        organisationUnitMapping,
                        attributeMapping,
                        goData,
                        optionMapping,
                        tokens,
                        metadata,
                        referenceData,
                    );

                    afterConversion(
                        {
                            ...emptyProcessedData,
                            goData: convertedGoData,
                        },
                        pager,
                    );
                } else if (mapping.dataSource === "fhir") {
                }
            } else {
                if (mapping.dataSource === "dhis2-program") {
                    await processInstances(
                        {
                            mapping,
                            attributeMapping,
                            enrollmentMapping,
                            programStageMapping,
                            organisationUnitMapping,
                            optionMapping,
                            trackedEntityInstances,
                            program,
                            version,
                            api: destinationApi,
                            setMessage,
                            attributionMapping,
                        },
                        async (processed) => afterConversion(processed, pager),
                    );
                } else {
                    if (
                        mapping &&
                        mapping.program &&
                        mapping.program.isTracker
                    ) {
                        const validUniqueAttributeValues =
                            uniqueAttributeValues.filter((v) => !isEmpty(v));
                        let instances = [];
                        if (trackedEntityInstanceColumn) {
                            instances = flattenedData.flatMap((d: any) => {
                                const value = getOr(
                                    "",
                                    trackedEntityInstanceColumn,
                                    d,
                                );
                                if (value) {
                                    return value;
                                }
                                return [];
                            });
                        }
                        await fetchTrackedEntityInstances(
                            {
                                api: destinationApi,
                                additionalParams,
                                numberOfUniqAttribute:
                                    programUniqAttributes.length,
                                fields: "*",
                                program: mapping.program.program,
                                trackedEntityInstances: instances,
                                trackedEntityType:
                                    mapping.program.trackedEntityType,
                                uniqueAttributeValues:
                                    validUniqueAttributeValues,
                                withAttributes:
                                    programUniqAttributes.length > 0,
                                setMessage,
                            },
                            ({ trackedEntityInstances, pager }) => {
                                const previousData = processPreviousInstances({
                                    programUniqAttributes,
                                    programStageUniqueElements,
                                    currentProgram: mapping.program.program,
                                    trackedEntityIdIdentifiesInstance:
                                        !!trackedEntityInstanceColumn,
                                    programStageMapping,
                                    trackedEntityInstances,
                                    eventStageMapping:
                                        mapping.eventStageMapping,
                                    isTracker: mapping.program.isTracker,
                                });
                                const convertedData = convertToDHIS2({
                                    program,
                                    previousData,
                                    data: flattenedData,
                                    mapping,
                                    version,
                                    attributeMapping,
                                    programStageMapping,
                                    organisationUnitMapping,
                                    optionMapping,
                                    enrollmentMapping,
                                    attributionMapping,
                                });
                                afterConversion(
                                    {
                                        ...emptyProcessedData,
                                        dhis2: convertedData,
                                    },
                                    pager,
                                );
                            },
                        );
                    } else if (
                        mapping &&
                        mapping.program &&
                        !isEmpty(mapping.eventStageMapping)
                    ) {
                        const eventIdColumns: string[] = [];
                        for (const [, currentMapping] of Object.entries(
                            mapping.eventStageMapping,
                        )) {
                            const { eventIdColumn } = currentMapping;
                            if (eventIdColumn) {
                                eventIdColumns.push(eventIdColumn);
                            }
                        }

                        if (
                            eventIdColumns.length > 0 &&
                            isArray(flattenedData)
                        ) {
                            const eventIds = flattenedData.flatMap((d) =>
                                uniq(
                                    eventIdColumns.flatMap((c) => {
                                        const value = getOr("", c, d);
                                        if (value) {
                                            return value;
                                        }
                                        return [];
                                    }),
                                ),
                            );
                            await fetchEvents({
                                api: destinationApi,
                                program: mapping.program.program,
                                programStages: Object.keys(programStageMapping),
                                fetchInstances: false,
                                events: eventIds,
                                afterFetch: ({ events }) => {
                                    const previousData =
                                        processPreviousInstances({
                                            programStageUniqueElements,
                                            currentProgram:
                                                mapping.program.program,
                                            programStageMapping,
                                            eventStageMapping:
                                                mapping.eventStageMapping,
                                            events,
                                        });
                                    const convertedData = convertToDHIS2({
                                        program,
                                        previousData,
                                        data: flattenedData,
                                        mapping,
                                        version,
                                        attributeMapping,
                                        programStageMapping,
                                        organisationUnitMapping,
                                        optionMapping,
                                        enrollmentMapping,
                                        attributionMapping,
                                    });
                                    afterConversion(
                                        {
                                            ...emptyProcessedData,
                                            dhis2: convertedData,
                                        },
                                        pager,
                                    );
                                },
                                pageSize: "10",
                                others: {},
                            });
                        } else {
                            const convertedData = convertToDHIS2({
                                program,
                                previousData: {
                                    attributes: new Map(),
                                    enrollments: new Map(),
                                    dataElements: new Map(),
                                    orgUnits: new Map(),
                                    trackedEntities: new Map(),
                                    events: new Map(),
                                },
                                data: flattenedData,
                                mapping,
                                version,
                                attributeMapping,
                                programStageMapping,
                                organisationUnitMapping,
                                optionMapping,
                                enrollmentMapping,
                                attributionMapping,
                            });
                            afterConversion(
                                {
                                    ...emptyProcessedData,
                                    dhis2: convertedData,
                                },
                                pager,
                            );
                        }
                    }
                }
            }
        },
        api: sourceApi,
        setMessage,
        goData,
    });
};
