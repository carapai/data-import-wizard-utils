import { Dictionary } from "lodash";
import { convertToDHIS2 } from "./dhis2-converter";
import { processPreviousInstances } from "./entities-processor";
import { fetchGoDataData } from "./fetch-go-data";
import { fetchTrackedEntityInstances } from "./fetch-tracked-entities";
import { getFetcher } from "./fetchers";
import { getFlattener } from "./flatteners";
import { convertToGoData } from "./go-data-converter";
import {
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
    getProgramUniqColumns,
} from "./program";
import { processInstances } from "./utils";
import { AxiosInstance } from "axios";

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
}: {
    mapping: Partial<IMapping>;
    attributeMapping: Mapping;
    enrollmentMapping: Mapping;
    organisationUnitMapping: Mapping;
    optionMapping: Record<string, string>;
    programStageMapping: StageMapping;
    sourceApi: Partial<{ engine: any; axios: AxiosInstance }>;
    destinationApi: Partial<{ engine: any; axios: AxiosInstance }>;
    setMessage: React.Dispatch<React.SetStateAction<string>>;
    afterConversion: (data: Processed | any) => void;
    additionalParams?: {
        [key: string]: string;
    };
    version: number;
    data: any[];
    goData: Partial<IGoData>;
    tokens: Dictionary<string>;
    program: Partial<IProgram>;
    metadata: Metadata;
}) => {
    const programUniqAttributes = getProgramUniqAttributes(attributeMapping);
    const programStageUniqueElements =
        getProgramStageUniqElements(programStageMapping);
    const {
        info: { trackedEntityInstanceColumn } = {
            trackedEntityInstanceColumn: "",
        },
    } = attributeMapping;
    await getFetcher({
        data,
        mapping,
        afterFetch: async ({
            trackedEntityInstances,
            data,
            goDataData,
            pager,
        }) => {
            const flattenedData = getFlattener({
                mapping,
                data: { trackedEntityInstances, data, goDataData },
                tokens,
            });
            if (mapping.isSource) {
                if (
                    ["csv-line-list", "xlsx-line-list"].indexOf(
                        mapping.dataSource,
                    ) !== -1
                ) {
                    afterConversion(flattenedData);
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
                        },
                        async (data) => afterConversion(data),
                    );
                } else if (mapping.dataSource === "go-data") {
                    const { metadata, prev } = await fetchGoDataData(
                        {},
                        mapping.authentication,
                    );
                    const convertedData = convertToGoData(
                        flattenedData,
                        organisationUnitMapping,
                        attributeMapping,
                        goData,
                        optionMapping,
                        tokens,
                        metadata,
                    );
                    afterConversion(convertedData);
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
                        },
                        async (processed) => afterConversion(processed),
                    );
                } else if (mapping.dataSource === "go-data") {
                } else {
                    setMessage(() => "Fetching previous data");
                    const previousData = await fetchTrackedEntityInstances({
                        api: destinationApi,
                        additionalParams,
                        numberOfUniqAttribute: programUniqAttributes.length,
                        fields: "*",
                        program: mapping.program.program,
                        trackedEntityInstances:
                            mapping.dhis2SourceOptions?.trackedEntityInstance?.split(
                                ",",
                            ) ?? [],
                        trackedEntityType: mapping.program.trackedEntityType,
                        uniqueAttributeValues: metadata.uniqueAttributeValues,
                        withAttributes:
                            metadata.uniqueAttributeValues.length > 0,
                        setMessage,
                    });
                    const convertedData = convertToDHIS2({
                        program,
                        previousData: processPreviousInstances({
                            programUniqAttributes,
                            programStageUniqueElements,
                            currentProgram: mapping.program.program,
                            trackedEntityIdIdentifiesInstance:
                                !!trackedEntityInstanceColumn,
                            programStageMapping,
                            trackedEntityInstances:
                                previousData.trackedEntityInstances,
                        }),
                        data,
                        mapping,
                        version,
                        attributeMapping,
                        programStageMapping,
                        organisationUnitMapping,
                        optionMapping,
                        enrollmentMapping,
                    });
                    afterConversion(convertedData);
                }
            }
        },
        api: sourceApi,
        setMessage,
    });
};
