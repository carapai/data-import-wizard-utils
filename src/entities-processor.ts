import dayjs from "dayjs";
import { fromPairs, uniqBy } from "lodash/fp";
import {
    Attribute,
    Event,
    EventStageMapping,
    IEnrollment,
    RealMapping,
    StageMapping,
    TrackedEntityInstance,
} from "./interfaces";

export const processPreviousEvents = ({
    eventStageMapping,
    programStageMapping,
    programStageUniqueElements,
    events,
}: {
    eventStageMapping: Map<string, Partial<EventStageMapping>>;
    programStageMapping: StageMapping;
    programStageUniqueElements: Map<string, Set<string>>;
    events: Partial<Event>[];
}) => {
    const currentEvents: Map<
        string,
        Map<string, Map<string, string>>
    > = new Map<string, Map<string, Map<string, string>>>();

    programStageMapping.forEach((_, stage) => {
        const availableEvents = events.filter(
            ({ programStage }) => programStage === stage,
        );
        const stageUniqueElements = programStageUniqueElements.get(stage);
        const currentMapping = programStageMapping.get(stage);

        const stageMapping = eventStageMapping.get(stage);

        if (currentMapping && stageMapping) {
            const { eventIdColumn, uniqueAttribution, uniqueEventDate } =
                stageMapping;

            if (uniqueEventDate) {
                stageUniqueElements.add("eventDate");
            }
            if (uniqueAttribution) {
                stageUniqueElements.add("attribution");
            }

            const elements: Map<string, Map<string, string>> = new Map();
            availableEvents.forEach((event) => {
                if (event.eventDate) {
                    const finalValues: Map<string, string> = new Map(
                        [
                            ...event.dataValues,
                            {
                                dataElement: "eventDate",
                                value: dayjs(event.eventDate).format(
                                    "YYYY-MM-DD",
                                ),
                            },
                            {
                                dataElement: "event",
                                value: event.event,
                            },
                            {
                                dataElement: "enrollment",
                                value: event.enrollment,
                            },
                        ].map(({ dataElement, value }) => [dataElement, value]),
                    );

                    const dataElementKey = Array.from(finalValues.keys())
                        .map((dataElement) => {
                            if (
                                dataElement &&
                                stageUniqueElements &&
                                stageUniqueElements.has(dataElement)
                            ) {
                                return finalValues.get(dataElement);
                            }
                            return [];
                        })
                        .sort()
                        .join("");

                    if (dataElementKey) {
                        elements.set(dataElementKey, finalValues);
                    } else {
                        elements.set(event.event, finalValues);
                    }
                }
            });
            currentEvents.set(stage, elements);
        }
    });

    return currentEvents;
};

export const processPreviousInstances = ({
    trackedEntityInstances,
    programUniqAttributes,
    programStageUniqueElements,
    currentProgram,
    trackedEntityIdIdentifiesInstance,
    programStageMapping,
    eventStageMapping,
    events,
    isTracker,
}: Partial<{
    trackedEntityInstances?: Array<Partial<TrackedEntityInstance>>;
    events?: Array<Partial<Event>>;
    programUniqAttributes?: Array<Partial<RealMapping>>;
    programStageUniqueElements: Map<string, Set<string>>;
    currentProgram: string;
    trackedEntityIdIdentifiesInstance?: boolean;
    programStageMapping: StageMapping;
    eventStageMapping: Map<string, Partial<EventStageMapping>>;
    isTracker: boolean;
}>) => {
    const mappedStages: Set<string> = new Set(programStageMapping.keys());
    const foundAttributes: Map<string, Partial<Attribute>[]> = new Map();
    const foundTrackerEvents: Map<
        string,
        Map<string, Map<string, Map<string, string>>>
    > = new Map();

    let foundEvents: Map<string, Map<string, Map<string, string>>> = new Map<
        string,
        Map<string, Map<string, string>>
    >();
    const foundEnrollments: Map<string, Array<IEnrollment>> = new Map<
        string,
        Array<IEnrollment>
    >();
    const foundTrackedEntities: Map<string, string> = new Map<string, string>();
    const foundOrgUnits: Map<string, string> = new Map<string, string>();
    if (isTracker && trackedEntityInstances) {
        trackedEntityInstances.forEach(
            ({ enrollments, attributes, trackedEntityInstance, orgUnit }) => {
                const allAttributes = attributes.concat(
                    enrollments
                        .filter(({ program }) => program === currentProgram)
                        .flatMap(({ attributes }) => attributes),
                );
                const uniqueAttributes = uniqBy("attribute", allAttributes);
                let attributeKey = uniqueAttributes
                    .flatMap(({ attribute, value }) => {
                        if (
                            attribute &&
                            programUniqAttributes &&
                            programUniqAttributes
                                .map(({ destination }) => destination)
                                .includes(attribute)
                        ) {
                            return value;
                        }
                        return [];
                    })
                    .sort()
                    .join("");

                if (trackedEntityIdIdentifiesInstance) {
                    attributeKey = trackedEntityInstance;
                }
                foundTrackedEntities.set(attributeKey, trackedEntityInstance);
                foundAttributes.set(attributeKey, uniqueAttributes);
                foundOrgUnits.set(attributeKey, String(orgUnit));
                if (enrollments.length > 0) {
                    const previousEnrollments = enrollments.filter(
                        ({ program }) => program === currentProgram,
                    );
                    if (previousEnrollments.length > 0) {
                        foundEnrollments.set(
                            attributeKey,
                            previousEnrollments.map(
                                ({
                                    enrollment,
                                    enrollmentDate,
                                    attributes,
                                    events,
                                    ...rest
                                }) => ({
                                    enrollment,
                                    enrollmentDate,
                                    ...rest,
                                    attributes: fromPairs(
                                        attributes.map(
                                            ({ attribute, value }) => [
                                                attribute,
                                                value,
                                            ],
                                        ),
                                    ),
                                }),
                            ),
                        );

                        const allEvents = previousEnrollments.flatMap(
                            ({ events }) =>
                                events.filter(({ programStage }) =>
                                    mappedStages.has(programStage),
                                ),
                        );

                        const currentEvents = processPreviousEvents({
                            events: allEvents,
                            eventStageMapping,
                            programStageMapping,
                            programStageUniqueElements,
                        });
                        foundTrackerEvents.set(attributeKey, currentEvents);
                    }
                }
            },
        );
    } else if (!isTracker && events) {
        foundEvents = processPreviousEvents({
            events: events,
            eventStageMapping,
            programStageMapping,
            programStageUniqueElements,
        });
    }
    return {
        attributes: foundAttributes,
        dataElements: foundTrackerEvents,
        enrollments: foundEnrollments,
        trackedEntities: foundTrackedEntities,
        orgUnits: foundOrgUnits,
        events: foundEvents,
    };
};
