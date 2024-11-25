import { IBundle } from "@smile-cdr/fhirts/dist/FHIR-R4/interfaces/IBundle";
import {
    flattenEntitiesByEvents,
    flattenEntitiesByInstances,
    flattenTrackedEntityInstances,
} from "./flatten-dhis2";
import { flattenBundle } from "./flatten-fhir";
import { flattenGoData } from "./flatten-go-data";
import { FlattenArgs } from "./interfaces";
import { getOr } from "lodash/fp";

export function getFlattener({ mapping, data, tokens }: FlattenArgs) {
    if (mapping.isSource) {
        if (
            ["csv-line-list", "xlsx-line-list"].indexOf(mapping.dataSource) !==
            -1
        ) {
            return flattenEntitiesByInstances(data.trackedEntityInstances);
        }
        if (mapping.dataSource === "go-data") {
            const flattenedData = flattenTrackedEntityInstances(
                data.trackedEntityInstances,
                "LAST",
            );
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
        return flattenEntitiesByEvents(data.trackedEntityInstances);
    } else {
        if (mapping.dataSource === "dhis2-program") {
            return flattenEntitiesByEvents(data.trackedEntityInstances);
        } else if (mapping.dataSource === "go-data") {
            return flattenGoData(data.goDataData, tokens);
        } else if (mapping.dataSource === "fhir") {
            return flattenBundle(data.data as IBundle);
        }
        return data.data;
    }
}
