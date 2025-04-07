import dayjs from "dayjs";
import { diff } from "jiff";
import { Dictionary, maxBy } from "lodash";
import { fromPairs, getOr, groupBy, isEmpty } from "lodash/fp";
import {
    EventStageMapping,
    IEnrollment,
    IMapping,
    IProgramStage,
    Mapping,
    Option,
    StageMapping,
} from "./interfaces";
import { makeEvent } from "./utils";

export const processEvents = ({
    eventStageMapping,
    data,
    programStageMapping,
    trackedEntityInstance,
    enrollment,
    orgUnit,
    program,
    previousEvents,
    stages,
    options,
    dataElements,
    uniqueKey,
    registration,
    flippedAttribution,
    mapping,
}: {
    data: any[];
    programStageMapping: StageMapping;
    trackedEntityInstance?: string;
    enrollment?: IEnrollment;
    orgUnit?: string;
    program: string;
    previousEvents: Map<string, Map<string, Map<string, string>>> | undefined;
    stages: Map<string, IProgramStage>;
    options: Map<string, string>;
    dataElements: Dictionary<Option>;
    uniqueKey?: string;
    registration: boolean;
    eventStageMapping: Map<string, Partial<EventStageMapping>>;
    flippedAttribution: Map<string, string>;
    mapping: Partial<IMapping>;
}) => {
    let eventUpdates = [];
    let newEvents = [];
    let conflicts: any[] = [];
    let errors: any[] = [];

    const {
        hasAttribution,
        attributionMerged,
        attributeOptionComboColumn,
        categoryColumns,
    } = mapping;

    const sortedCategoryColumns = Array.from(categoryColumns.values()).sort();

    const modifiedData = data.flatMap((d) => {
        let currentAttributionValue = "";
        if (hasAttribution && attributionMerged) {
            currentAttributionValue = getOr("", attributeOptionComboColumn, d);
        } else if (hasAttribution && !isEmpty(categoryColumns)) {
            currentAttributionValue = sortedCategoryColumns
                .map((a) => getOr("", a, d))
                .join(" ");
        }
        if (currentAttributionValue) {
            return { ...d, attribution: currentAttributionValue };
        }
        return d;
    });
    for (const [programStage, elements] of programStageMapping) {
        const currentStage = stages.get(programStage);
        if (currentStage) {
            const { repeatable, featureType } = currentStage;
            const stagePreviousEvents = previousEvents?.get(programStage);
            let currentData = fromPairs([["", modifiedData]]);
            const {
                createEvents = false,
                eventDateColumn = "",
                dueDateColumn = "",
                updateEvents = false,
                eventIdColumn = "",
                uniqueEventDate = false,
                geometryColumn = "",
                createEmptyEvents = false,
                completeEvents = false,
            } = eventStageMapping.get(programStage);
            if (createEvents || updateEvents || createEmptyEvents) {
                let uniqueColumns = Array.from(elements.entries()).flatMap(
                    ([, { unique, source }]) => {
                        if (unique && source) {
                            return source;
                        }
                        return [];
                    },
                );
                if (uniqueEventDate) {
                    uniqueColumns = [...uniqueColumns, eventDateColumn];
                }
                if (hasAttribution) {
                    uniqueColumns = [...uniqueColumns, "attribution"];
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
                                        return dayjs(
                                            getOr("", column, item),
                                        ).format("YYYY-MM-DD");
                                    }
                                    return value;
                                })
                                .join(""),
                        modifiedData,
                    );
                }
                for (const [key, currentRow] of Object.entries(currentData)) {
                    let previousEvent = stagePreviousEvents?.get(key);
                    const data = maxBy(currentRow, (d) =>
                        getOr(undefined, eventDateColumn, d),
                    );
                    const attributionValue = flippedAttribution.get(
                        getOr("", "attribution", data),
                    );
                    const {
                        event,
                        conflicts: cs,
                        errors: es,
                    } = makeEvent({
                        eventDateColumn,
                        data,
                        featureType,
                        geometryColumn,
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
                        registration,
                        dueDateColumn,
                        hasAttribution,
                        attributionValue,
                    });
                    if (event && !isEmpty(event.dataValues)) {
                        let { dataValues, event: e, ...others } = event;
                        if (completeEvents) {
                            others = { ...others, status: "COMPLETED" };
                        }
                        if (
                            previousEvent &&
                            previousEvent.get("enrollment") ===
                                enrollment.enrollment
                        ) {
                            const {
                                event,
                                eventDate,
                                enrollment,
                                attributionOptionCombo,
                                ...rest
                            } = Object.fromEntries(previousEvent);
                            const difference = diff(rest, dataValues);
                            const filteredDifferences = difference.filter(
                                ({ op }) =>
                                    ["add", "replace", "copy"].indexOf(op) !==
                                    -1,
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
                        } else if (event) {
                            newEvents = newEvents.concat({
                                ...others,
                                event: e,
                                status: "COMPLETED",
                                dataValues: Object.entries({
                                    ...dataValues,
                                }).map(([dataElement, value]) => ({
                                    dataElement,
                                    value,
                                })),
                            });
                        }
                    } else if (
                        event &&
                        createEmptyEvents &&
                        isEmpty(stagePreviousEvents)
                    ) {
                        const { dataValues, ...others } = event;
                        newEvents = newEvents.concat({
                            ...others,
                            dataValues: [],
                        });
                    } else {
                        errors = errors.concat(es);
                        conflicts = conflicts.concat(cs);
                    }
                    if (!repeatable) {
                        break;
                    }
                }
            }
        }
    }
    return { eventUpdates, newEvents, conflicts, errors };
};
