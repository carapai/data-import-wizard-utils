import {
    flattenEntitiesByEvents,
    flattenEntitiesByInstances,
} from "./flatten-dhis2";
import { flattenGoData } from "./flatten-go-data";
import { FlattenArgs } from "./interfaces";

export function getFlattener({ mapping, data, tokens }: FlattenArgs) {
    if (mapping.isSource) {
        if (
            ["csv-line-list", "xlsx-line-list"].indexOf(mapping.dataSource) !==
            -1
        ) {
            return flattenEntitiesByInstances(data.trackedEntityInstances);
        }
        return flattenEntitiesByEvents(data.trackedEntityInstances);
    } else {
        if (mapping.dataSource === "dhis2-program") {
            return flattenEntitiesByEvents(data.trackedEntityInstances);
        } else if (mapping.dataSource === "go-data") {
            return flattenGoData(data.goDataData, tokens);
        }

        return data.data;
    }
}
