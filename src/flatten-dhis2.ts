import { groupBy, orderBy } from "lodash/fp";
import { TrackedEntityInstance, Event } from "./interfaces";
import { fromPairs, maxBy, minBy } from "lodash";

export const groupEvents = (events: Array<Partial<Event>>) => {
    const groupedEvents = groupBy("programStage", events);
    const allEvents = Object.entries(groupedEvents).map(
        ([programStage, events]) => [
            programStage,
            orderBy("eventDate", "asc", events).map(
                ({ dataValues, ...eventDetails }) => ({
                    ...eventDetails,
                    ...fromPairs(
                        dataValues.map(({ dataElement, value }) => [
                            dataElement,
                            value,
                        ]),
                    ),
                }),
            ),
        ],
    );
    return fromPairs(allEvents);
};

export const groupEvents2 = (
    enrollment: number,
    events: Array<Partial<Event>>,
) => {
    const groupedEvents = groupBy("programStage", events);
    const finalEvents: Record<string, string> = {};
    Object.entries(groupedEvents).forEach(([programStage, events]) => {
        finalEvents[`${enrollment}-${programStage}-max`] = `${events.length}`;
        orderBy("eventDate", "asc", events).forEach(
            ({ dataValues, ...eventDetails }, index) => {
                Object.keys(eventDetails).forEach((key) => {
                    finalEvents[
                        `${enrollment}-${programStage}-${key}-${index}`
                    ] = eventDetails[key];
                });
                dataValues.forEach(({ dataElement, value }) => {
                    finalEvents[
                        `${enrollment}-${programStage}-${dataElement}-${index}`
                    ] = value;
                });
            },
        );
    });
    return finalEvents;
};

export const flattenEvents = (
    events: Array<Partial<Event>>,
    trackedEntityInstances?: Record<string, any>,
) => {
    return events
        .filter((a) => a !== undefined)
        .map(
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
                            ]),
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
            },
        );
};

export function flattenEntitiesByEnrollment(
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>,
) {
    return trackedEntityInstances.flatMap(
        ({ enrollments, attributes, ...entityDetails }) => {
            const currentAttributes = fromPairs(
                attributes.map(({ attribute, value }) => [attribute, value]),
            );
            return enrollments.map(
                ({ events, attributes, ...enrollmentDetails }) => {
                    const allEvents = groupEvents(events);
                    return {
                        ...allEvents,
                        ...enrollmentDetails,
                        ...entityDetails,
                        ...currentAttributes,
                        ...fromPairs(
                            attributes.map(({ attribute, value }) => [
                                attribute,
                                value,
                            ]),
                        ),
                    };
                },
            );
        },
    );
}

export function flattenEntitiesByInstances(
    entities: Array<Partial<TrackedEntityInstance>>,
) {
    return entities.map(({ enrollments, attributes, ...entityDetails }) => {
        let flattenedData: Record<string, any> = fromPairs(
            attributes.map(({ attribute, value }) => [attribute, value]),
        );
        orderBy("enrollmentDate", "asc", enrollments).map(
            ({ events, attributes, ...enrollmentDetails }, enrollmentIndex) => {
                const allEvents = groupEvents2(enrollmentIndex, events);
                Object.entries({
                    ...fromPairs(
                        attributes.map(({ attribute, value }) => [
                            attribute,
                            value,
                        ]),
                    ),
                    ...enrollmentDetails,
                }).forEach(([key, value]) => {
                    flattenedData = {
                        ...flattenedData,
                        [`${enrollmentIndex}-${key}`]: value,
                    };
                });
                flattenedData = {
                    ...flattenedData,
                    ...allEvents,
                    ...entityDetails,
                };
            },
        );
        return flattenedData;
    });
}

export const flattenEntitiesByEvents = (
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>,
) => {
    if (trackedEntityInstances)
        return trackedEntityInstances.flatMap(
            ({ attributes, enrollments, ...otherAttributes }) => {
                let current: Record<string, any> = {
                    ...otherAttributes,
                    ...fromPairs(
                        attributes.map(({ attribute, value }) => [
                            attribute,
                            value,
                        ]),
                    ),
                };
                if (enrollments.length > 0) {
                    return enrollments.flatMap(
                        ({
                            events,
                            program,
                            attributes,
                            ...enrollmentData
                        }) => {
                            current = {
                                ...current,
                                ...fromPairs(
                                    attributes.map(({ attribute, value }) => [
                                        attribute,
                                        value,
                                    ]),
                                ),
                                enrollment: enrollmentData,
                            };
                            if (events && events.length > 0) {
                                return Object.entries(
                                    groupBy("programStage", events),
                                ).flatMap(([_, availableEvents]) => {
                                    return flattenEvents(availableEvents, {
                                        [current.trackedEntityInstance]:
                                            current,
                                    });
                                });
                            }
                            return current;
                        },
                    );
                }
                return current;
            },
        );
    return [];
};

export const flattenTrackedEntityInstances = (
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>,
    flatteningOption: "ALL" | "LAST" | "FIRST",
) => {
    return trackedEntityInstances.flatMap(
        ({ attributes, enrollments, ...otherAttributes }) => {
            let current: Record<string, any> = {
                ...otherAttributes,
                ...fromPairs(
                    attributes.map(({ attribute, value }) => [
                        attribute,
                        value,
                    ]),
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
                                ]),
                            ),
                            enrollment: enrollmentData,
                        };
                        if (events && events.length > 0) {
                            return Object.entries(
                                groupBy("programStage", events),
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
                                        },
                                    );
                                } else {
                                    return flattenEvents(
                                        [maxBy(availableEvents, "eventDate")],
                                        {
                                            [current.trackedEntityInstance]:
                                                current,
                                        },
                                    );
                                }
                            });
                        }
                    },
                );
            }
            return current;
        },
    );
};
