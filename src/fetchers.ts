import { fetchApiData } from "./fetch-api-data";
import { fetchEvents } from "./fetch-events";
import { fetchGoDataData } from "./fetch-go-data";
import { fetchTrackedEntityInstances } from "./fetch-tracked-entities";
import { FetchArgs } from "./interfaces";
import { buildParameters } from "./utils";

export async function getFetcher({
    mapping,
    api,
    afterFetch,
    pageSize,
    fields = "*",
    goData,
    data,
    uniqueAttributeValues,
    numberOfUniqAttribute,
    withAttributes,
    setMessage,
}: Partial<FetchArgs>) {
    const additionalParams = buildParameters(mapping);
    if (mapping.isSource && mapping.program.isTracker) {
        await fetchTrackedEntityInstances(
            {
                api,
                program: mapping.program.program,
                trackedEntityType: mapping.program.trackedEntityType,
                additionalParams,
                trackedEntityInstances: [
                    mapping.dhis2SourceOptions.trackedEntityInstance,
                ],
                fields,
                pageSize,
                uniqueAttributeValues,
                numberOfUniqAttribute,
                withAttributes,
                setMessage,
                filters: mapping.dhis2SourceOptions.attributeFilters,
            },
            afterFetch,
        );
    } else if (mapping.isSource && !mapping.program.isTracker) {
        await fetchEvents({
            api,
            program: mapping.program.program,
            others: additionalParams,
            programStages: [],
            pageSize,
            fetchInstances: false,
            afterFetch,
        });
    } else if (
        !mapping.isSource &&
        mapping.dataSource === "dhis2-program" &&
        mapping.program.remoteIsTracker
    ) {
        await fetchTrackedEntityInstances(
            {
                api,
                program: mapping.program.remoteProgram,
                trackedEntityType: mapping.program.trackedEntityType,
                additionalParams,
                trackedEntityInstances:
                    mapping.dhis2SourceOptions.trackedEntityInstance?.split(
                        ",",
                    ) ?? [],
                fields,
                pageSize,
                uniqueAttributeValues,
                numberOfUniqAttribute,
                withAttributes,
                setMessage,
                fetchBy: mapping.dhis2SourceOptions.fetchBy,
            },
            afterFetch,
        );
    } else if (
        !mapping.isSource &&
        mapping.dataSource === "dhis2-program" &&
        !mapping.program.remoteIsTracker
    ) {
        await fetchEvents({
            api,
            program: mapping.program.remoteProgram,
            others: additionalParams,
            programStages: [],
            pageSize,
            fetchInstances: false,
            afterFetch,
        });
    } else if (
        !mapping.isSource &&
        mapping.dataSource === "go-data" &&
        goData
    ) {
        const foundGoData = await fetchGoDataData(
            goData,
            mapping.authentication,
        );
        afterFetch({ goDataData: foundGoData });
    } else if (!mapping.isSource && mapping.dataSource === "api") {
        const apiData = await fetchApiData(mapping.authentication);
        afterFetch({ data: apiData });
    } else {
        afterFetch({ data });
    }
}
