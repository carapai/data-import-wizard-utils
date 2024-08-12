import dayjs from "dayjs";
import { Dictionary } from "lodash";
import { fromPairs, groupBy, uniqBy } from "lodash/fp";
import { IEnrollment, Mapping, TrackedEntityInstance } from "./interfaces";

export const processPreviousInstances = ({
    trackedEntityInstances,
    programUniqAttributes,
    programStageUniqueElements,
    currentProgram,
    trackedEntityIdIdentifiesInstance,
    programStageMapping,
}: Partial<{
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
    programUniqAttributes: string[];
    programStageUniqueElements: Dictionary<string[]>;
    currentProgram: string;
    trackedEntityIdIdentifiesInstance: boolean;
    programStageMapping: Record<string, Mapping>;
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
                            programUniqAttributes.includes(attribute)
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
                currentAttributes.push([
                    attributeKey,
                    allAttributes.map(({ attribute, value }) => ({
                        attribute,
                        value,
                    })),
                ]);

                currentOrgUnits.push([attributeKey, String(orgUnit)]);
                if (enrollments.length > 0) {
                    const previousEnrollment = enrollments.filter(
                        ({ program }) => program === currentProgram,
                    );
                    if (previousEnrollment.length > 0) {
                        currentEnrollments.push([
                            attributeKey,
                            previousEnrollment.map(
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
                        const allEvents = previousEnrollment.flatMap(
                            ({ events }) =>
                                events.filter((a) =>
                                    Object.keys(programStageMapping).includes(
                                        a.programStage,
                                    ),
                                ),
                        );
                        const uniqueEvents = Object.entries(
                            groupBy("programStage", allEvents),
                        ).flatMap(([stage, availableEvents]) => {
                            const stageElements =
                                programStageUniqueElements[stage];
                            const mapping = programStageMapping[stage];
                            if (mapping) {
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
                                            if (mapping.info.eventIdColumn) {
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
