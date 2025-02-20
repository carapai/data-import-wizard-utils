import { IBundle } from "@smile-cdr/fhirts/dist/FHIR-R4/interfaces/IBundle";
import {
    flattenEntitiesByEvents,
    flattenEntitiesByInstances,
    flattenForGoData,
    flattenEntitiesByEnrollment,
} from "./flatten-dhis2";
import { flattenBundle } from "./flatten-fhir";
import { flattenGoData } from "./flatten-go-data";
import { FlattenArgs } from "./interfaces";
import { getOr } from "lodash/fp";

export function getFlattener({ mapping, data, tokens }: FlattenArgs) {
    if (mapping.dataSource === "go-data" && mapping.isSource) {
        const flattenedData = flattenForGoData(data.trackedEntityInstances);
        if (
            mapping.dhis2SourceOptions &&
            mapping.dhis2SourceOptions.dataElementFilters
        ) {
            return flattenedData.filter((d) => {
                const search =
                    mapping.dhis2SourceOptions.dataElementFilters.map(
                        (f) => d && getOr("", f.attribute, d) === f.value,
                    );
                return search.every((v) => v === true);
            });
        }
        return flattenedData;
    }
    if (
        mapping.dataSource === "dhis2-program" &&
        mapping.dhis2SourceOptions.flattenBy === "events"
    ) {
        return flattenEntitiesByEvents(data.trackedEntityInstances);
    }
    if (
        mapping.dataSource === "dhis2-program" &&
        mapping.dhis2SourceOptions.flattenBy === "trackedEntities"
    ) {
        return flattenEntitiesByInstances(data.trackedEntityInstances);
    }
    if (
        mapping.dataSource === "dhis2-program" &&
        mapping.dhis2SourceOptions.flattenBy === "enrollments"
    ) {
        return flattenEntitiesByEnrollment(data.trackedEntityInstances);
    }
    if (mapping.dataSource === "go-data") {
        return flattenGoData(data.goDataData, tokens);
    }
    if (mapping.dataSource === "fhir") {
        return flattenBundle(data.data as IBundle);
    }
    return data.data;
}
