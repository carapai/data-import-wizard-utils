import { Dictionary, isArray } from "lodash";
import { fromPairs, isEmpty } from "lodash/fp";
import {
    GO_DATA_EPIDEMIOLOGY_FIELDS,
    GO_DATA_EVENTS_FIELDS,
    GO_DATA_LAB_FIELDS,
    GO_DATA_PERSON_FIELDS,
    GO_DATA_RELATIONSHIP_FIELDS,
} from "./constants";
import { flattenGoData } from "./flatten-go-data";
import { FlattenedInstance, GoResponse, IGoData, Mapping } from "./interfaces";
import { getProgramUniqAttributes, getProgramUniqColumns } from "./program";
import { evaluateMapping, findUpdates } from "./utils";
export const convertToGoData = (
    data: Array<Partial<FlattenedInstance>>,
    organisationUnitMapping: Mapping,
    attributeMapping: Mapping,
    goData: Partial<IGoData>,
    optionMapping: Record<string, string>,
    tokens: Dictionary<string>,
    previousData: GoResponse,
) => {
    const uniqAttributes = getProgramUniqAttributes(attributeMapping);
    const uniqColumns = getProgramUniqColumns(attributeMapping);
    const flippedUnits = fromPairs(
        Object.entries(organisationUnitMapping).map(([unit, value]) => {
            return [value.value, unit];
        }),
    );
    const flippedOptions = fromPairs(
        Object.entries(optionMapping).map(([option, value]) => {
            return [value, option];
        }),
    );

    let errors: GoResponse = {
        person: [],
        epidemiology: [],
        events: [],
        relationships: [],
        lab: [],
        questionnaire: [],
    };

    let conflicts: GoResponse = {
        person: [],
        epidemiology: [],
        events: [],
        relationships: [],
        lab: [],
        questionnaire: [],
    };

    let processed: { updates: GoResponse; inserts: GoResponse } = {
        updates: {
            person: [],
            epidemiology: [],
            events: [],
            relationships: [],
            lab: [],
            questionnaire: [],
        },
        inserts: {
            person: [],
            epidemiology: [],
            events: [],
            relationships: [],
            lab: [],
            questionnaire: [],
        },
    };
    data.forEach((instanceData) => {
        const all = [
            GO_DATA_PERSON_FIELDS,
            GO_DATA_EPIDEMIOLOGY_FIELDS,
            GO_DATA_EVENTS_FIELDS,
            GO_DATA_RELATIONSHIP_FIELDS,
            GO_DATA_LAB_FIELDS,
            flattenGoData(goData.caseInvestigationTemplate, tokens),
        ].map((fields) =>
            evaluateMapping(
                attributeMapping,
                fields,
                instanceData,
                flippedOptions,
                flippedUnits,
                uniqAttributes,
                uniqColumns,
            ),
        );
        const [
            person,
            epidemiology,
            events,
            relationships,
            lab,
            questionnaire,
        ] = all;

        const {
            person: prevPeople,
            epidemiology: prevEpidemiology,
            events: prevEvents,
            relationships: prevRelationships,
            lab: prevLab,
            questionnaire: prevQuestionnaire,
        } = previousData;

        if (!isEmpty(person.results)) {
            const processedPerson = findUpdates(
                prevPeople,
                person.results,
                uniqAttributes.join(""),
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,
                    person: [
                        ...processed.updates.person,
                        ...processedPerson.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,
                    person: [
                        ...processed.inserts.person,
                        ...processedPerson.insert,
                    ],
                },
            };
        }
        if (!isEmpty(epidemiology.results)) {
            const processedEpidemiology = findUpdates(
                prevEpidemiology,
                epidemiology.results,
                uniqAttributes.join(""),
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,

                    epidemiology: [
                        ...processed.updates.epidemiology,
                        ...processedEpidemiology.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,

                    epidemiology: [
                        ...processed.inserts.epidemiology,
                        ...processedEpidemiology.insert,
                    ],
                },
            };
        }
        if (!isEmpty(events.results)) {
            const processedEvents = findUpdates(
                prevEvents,
                events.results,
                uniqAttributes.join(""),
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,

                    events: [
                        ...processed.updates.events,
                        ...processedEvents.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,

                    events: [
                        ...processed.inserts.events,
                        ...processedEvents.insert,
                    ],
                },
            };
        }
        if (!isEmpty(relationships.results)) {
            const processedRelationships = findUpdates(
                prevRelationships,
                relationships.results,
                uniqAttributes.join(""),
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,

                    relationships: [
                        ...processed.updates.relationships,
                        ...processedRelationships.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,

                    relationships: [
                        ...processed.inserts.relationships,
                        ...processedRelationships.insert,
                    ],
                },
            };
        }
        if (!isEmpty(lab.results)) {
            const processedLab = findUpdates(
                prevLab,
                lab.results,
                uniqAttributes.join(""),
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,
                    lab: [...processed.updates.lab, ...processedLab.update],
                },

                inserts: {
                    ...processed.inserts,

                    lab: [...processed.inserts.lab, ...processedLab.insert],
                },
            };
        }

        if (!isEmpty(questionnaire.results)) {
            const processedPrevious = prevQuestionnaire.map(
                ({ id, visualId, ...rest }: any) => {
                    return {
                        id,
                        visualId,
                        ...fromPairs(
                            Object.entries(rest).map(([key, value]) => {
                                if (
                                    value &&
                                    isArray(value) &&
                                    !isEmpty(value[0])
                                ) {
                                    return [key, value[0].value];
                                }
                                return [];
                            }),
                        ),
                    };
                },
            );
            const processedQuestionnaire = findUpdates(
                processedPrevious,
                questionnaire.results,
                uniqAttributes.join(""),
            );
            processed = {
                ...processed,
                updates: {
                    ...processed.updates,
                    questionnaire: [
                        ...processed.updates.questionnaire,
                        ...processedQuestionnaire.update,
                    ],
                },

                inserts: {
                    ...processed.inserts,
                    questionnaire: [
                        ...processed.inserts.questionnaire,
                        ...processedQuestionnaire.insert,
                    ],
                },
            };
        }

        errors = {
            ...errors,
            events: [...errors.events, ...events.errors],
            person: [...errors.person, ...person.errors],
            epidemiology: [...errors.epidemiology, ...epidemiology.errors],
            lab: [...errors.lab, ...lab.errors],
            relationships: [...errors.relationships, ...relationships.errors],
            questionnaire: [...errors.questionnaire, ...questionnaire.errors],
        };

        conflicts = {
            ...conflicts,
            events: [...conflicts.events, ...events.conflicts],
            person: [...conflicts.person, ...person.conflicts],
            epidemiology: [
                ...conflicts.epidemiology,
                ...epidemiology.conflicts,
            ],
            lab: [...conflicts.lab, ...lab.conflicts],
            relationships: [
                ...conflicts.relationships,
                ...relationships.conflicts,
            ],
            questionnaire: [
                ...conflicts.questionnaire,
                ...questionnaire.conflicts,
            ],
        };
    });
    return { processed, errors, conflicts };
};
