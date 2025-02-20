import dayjs from "dayjs";
import { Dictionary } from "lodash";
import { fromPairs, groupBy, uniqBy } from "lodash/fp";
import {
    EventStageMapping,
    IEnrollment,
    Mapping,
    RealMapping,
    TrackedEntityInstance,
} from "./interfaces";

export const processPreviousInstances = ({
    trackedEntityInstances,
    programUniqAttributes,
    programStageUniqueElements,
    currentProgram,
    trackedEntityIdIdentifiesInstance,
    programStageMapping,
    eventStageMapping,
}: Partial<{
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
    programUniqAttributes: Array<Partial<RealMapping>>;
    programStageUniqueElements: Dictionary<string[]>;
    currentProgram: string;
    trackedEntityIdIdentifiesInstance: boolean;
    programStageMapping: Record<string, Mapping>;
    eventStageMapping: Record<string, Partial<EventStageMapping>>;
}>) => {
    const currentAttributes: Array<[string, any]> = [];
    const currentElements: Array<[string, any]> = [];
    const currentEnrollments: Array<[string, Array<IEnrollment>]> = [];
    const currentTrackedEntities: Array<[string, string]> = [];
    const currentOrgUnits: Array<[string, string]> = [];

    if (trackedEntityInstances) {
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
                currentTrackedEntities.push([
                    attributeKey,
                    trackedEntityInstance,
                ]);
                currentAttributes.push([attributeKey, uniqueAttributes]);
                currentOrgUnits.push([attributeKey, String(orgUnit)]);
                if (enrollments.length > 0) {
                    const previousEnrollments = enrollments.filter(
                        ({ program }) => program === currentProgram,
                    );
                    if (previousEnrollments.length > 0) {
                        currentEnrollments.push([
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
                        ]);

                        const allEvents = enrollments.flatMap(({ events }) =>
                            events.filter(({ programStage }) =>
                                Object.keys(programStageMapping).includes(
                                    programStage,
                                ),
                            ),
                        );

                        console.log(allEvents, previousEnrollments);

                        const uniqueEvents = Object.entries(
                            groupBy("programStage", allEvents),
                        ).flatMap(([stage, availableEvents]) => {
                            let stageElements =
                                programStageUniqueElements[stage];
                            const currentMapping = programStageMapping[stage];
                            const { uniqueEventDate = false } =
                                eventStageMapping?.[stage] ?? {};

                            if (uniqueEventDate) {
                                stageElements =
                                    stageElements.concat("eventDate");
                            }

                            const { eventIdColumn } =
                                eventStageMapping?.[stage] ?? {};
                            if (currentMapping) {
                                const elements = availableEvents.map(
                                    (event) => {
                                        if (event.eventDate) {
                                            const finalValues = [
                                                ...event.dataValues,
                                                {
                                                    dataElement: "eventDate",
                                                    value: dayjs(
                                                        event.eventDate,
                                                    ).format("YYYY-MM-DD"),
                                                },
                                                {
                                                    dataElement: "event",
                                                    value: event.event,
                                                },
                                                {
                                                    dataElement: "enrollment",
                                                    value: event.enrollment,
                                                },
                                            ].map(({ dataElement, value }) => [
                                                dataElement,
                                                value,
                                            ]);

                                            let dataElementKey = finalValues
                                                .flatMap(
                                                    ([dataElement, value]) => {
                                                        if (
                                                            dataElement &&
                                                            stageElements &&
                                                            stageElements.includes(
                                                                dataElement,
                                                            )
                                                        ) {
                                                            return value;
                                                        }
                                                        return [];
                                                    },
                                                )
                                                .sort()
                                                .join("");
                                            if (eventIdColumn) {
                                                dataElementKey = event.event;
                                            }

                                            return [
                                                dataElementKey,
                                                fromPairs(finalValues),
                                            ];
                                        }
                                        return [];
                                    },
                                );
                                return [[stage, fromPairs(elements)]];
                            }
                            return [];
                        });
                        currentElements.push([
                            attributeKey,
                            fromPairs(uniqueEvents),
                        ]);
                    }
                }
            },
        );
    }
    return {
        attributes: fromPairs(currentAttributes),
        dataElements: fromPairs(currentElements),
        enrollments: fromPairs(currentEnrollments),
        trackedEntities: fromPairs(currentTrackedEntities),
        orgUnits: fromPairs(currentOrgUnits),
    };
};
