import { groupBy, orderBy } from "lodash/fp";
import { TrackedEntityInstance, Event } from "./interfaces";
import { fromPairs } from "lodash";

export const groupEvents = (events: Array<Partial<Event>>) => {
    const groupedEvents = groupBy("programStage", events);
    return Object.entries(groupedEvents).map(([programStage, events]) => [
        programStage,
        orderBy("eventDate", "asc", events).map(
            ({ dataValues, ...eventDetails }, eventIndex) => ({
                [eventIndex]: {
                    ...eventDetails,
                    ...fromPairs(
                        dataValues.map(({ dataElement, value }) => [
                            dataElement,
                            value,
                        ]),
                    ),
                },
            }),
        ),
    ]);
};

export const flattenEvents = (
    events: Array<Partial<Event>>,
    trackedEntityInstances?: Record<string, any>,
) => {
    return events.map(
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
                        ...fromPairs(allEvents),
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
        const currentAttributes = fromPairs(
            attributes.map(({ attribute, value }) => [attribute, value]),
        );
        const currentEnrollments = orderBy(
            "enrollmentDate",
            "asc",
            enrollments,
        ).map(
            ({ events, attributes, ...enrollmentDetails }, enrollmentIndex) => {
                const allEvents = groupEvents(events);
                return [
                    enrollmentIndex,
                    {
                        ...allEvents,
                        ...enrollmentDetails,
                        ...fromPairs(
                            attributes.map(({ attribute, value }) => [
                                attribute,
                                value,
                            ]),
                        ),
                    },
                ];
            },
        );

        return {
            ...entityDetails,
            ...currentAttributes,
            ...fromPairs(currentEnrollments),
        };
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
