import dayjs from "dayjs";
import { diff } from "jiff";
import { Dictionary, maxBy } from "lodash";
import { fromPairs, getOr, groupBy, isEmpty } from "lodash/fp";
import { IEnrollment, IProgramStage, Mapping, Option } from "./interfaces";
import { makeEvent } from "./utils";

export const processEvents = ({
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
}: {
    data: any[];
    programStageMapping: { [key: string]: Mapping };
    trackedEntityInstance?: string;
    enrollment?: IEnrollment;
    orgUnit: string;
    program: string;
    previousEvents: Dictionary<{
        [key: string]: { [key: string]: any };
    }>;
    stages: Dictionary<IProgramStage>;
    options: Dictionary<string>;
    dataElements: Dictionary<Option>;
    uniqueKey: string;
    registration: boolean;
}) => {
    let eventUpdates = [];
    let newEvents = [];
    let conflicts: any[] = [];
    let errors: any[] = [];
    for (const [programStage, mapping] of Object.entries(programStageMapping)) {
        const { repeatable, featureType } = stages[programStage];
        const stagePreviousEvents = previousEvents[programStage] || {};
        let currentData = fromPairs([["", data]]);
        const { info, ...elements } = mapping;
        const {
            createEvents,
            eventDateColumn,
            dueDateColumn,
            updateEvents,
            eventIdColumn,
            uniqueEventDate,
            geometryColumn = "",
            createEmptyEvents,
            completeEvents,
        } = info;
        if (createEvents || updateEvents || createEmptyEvents) {
            let uniqueColumns = Object.entries(elements).flatMap(
                ([, { unique, value }]) => {
                    if (unique && value) {
                        return value;
                    }
                    return [];
                },
            );
            if (uniqueEventDate) {
                uniqueColumns = [...uniqueColumns, eventDateColumn];
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
                    data,
                );
            }
            for (const [key, currentRow] of Object.entries(currentData)) {
                let previousEvent = stagePreviousEvents[key];
                if (
                    !repeatable &&
                    Object.values(stagePreviousEvents).length > 0
                ) {
                    previousEvent = Object.values(stagePreviousEvents)[0];
                }
                const data = maxBy(currentRow, (d) =>
                    getOr(undefined, eventDateColumn, d),
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
                });
                if (event && !isEmpty(event.dataValues)) {
                    let { dataValues, event: e, ...others } = event;
                    if (completeEvents) {
                        others = { ...others, status: "COMPLETED" };
                    }
                    if (
                        previousEvent &&
                        previousEvent.enrollment === enrollment.enrollment
                    ) {
                        const { event, eventDate, enrollment, ...rest } =
                            previousEvent;
                        const difference = diff(rest, dataValues);
                        const filteredDifferences = difference.filter(
                            ({ op }) =>
                                ["add", "replace", "copy"].indexOf(op) !== -1,
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
                    } else {
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
                } else if (createEmptyEvents && isEmpty(stagePreviousEvents)) {
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
    return { eventUpdates, newEvents, conflicts, errors };
};
