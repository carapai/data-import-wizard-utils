import { Processed } from "./interfaces";

export const processor = {
    addDHIS2Data: (state: Processed, processedData: Processed) => {
        return {
            ...state,
            dhis2: {
                ...state.dhis2,
                trackedEntityInstances: [
                    ...state.dhis2.trackedEntityInstances,
                    ...processedData.dhis2.trackedEntityInstances,
                ],
                enrollments: [
                    ...state.dhis2.enrollments,
                    ...processedData.dhis2.enrollments,
                ],
                events: [...state.dhis2.events, ...processedData.dhis2.events],
                errors: [...state.dhis2.errors, ...processedData.dhis2.errors],
                conflicts: [
                    ...state.dhis2.conflicts,
                    ...processedData.dhis2.conflicts,
                ],
                eventUpdates: [
                    ...state.dhis2.eventUpdates,
                    ...processedData.dhis2.eventUpdates,
                ],
                enrollmentUpdates: [
                    ...state.dhis2.enrollmentUpdates,
                    ...processedData.dhis2.enrollmentUpdates,
                ],
                trackedEntityInstanceUpdates: [
                    ...state.dhis2.trackedEntityInstanceUpdates,
                    ...processedData.dhis2.trackedEntityInstanceUpdates,
                ],
            },
        };
    },

    addGoData: (state: Processed, processedData: Processed) => {
        return {
            ...state,
            goData: {
                conflicts: {
                    epidemiology: [
                        ...state.goData.conflicts.epidemiology,
                        ...processedData.goData.conflicts.epidemiology,
                    ],
                    events: [
                        ...state.goData.conflicts.events,
                        ...processedData.goData.conflicts.events,
                    ],
                    lab: [
                        ...state.goData.conflicts.lab,
                        ...processedData.goData.conflicts.lab,
                    ],
                    person: [
                        ...state.goData.conflicts.person,
                        ...processedData.goData.conflicts.person,
                    ],
                    questionnaire: [
                        ...state.goData.conflicts.questionnaire,
                        ...processedData.goData.conflicts.questionnaire,
                    ],
                    relationships: [
                        ...state.goData.conflicts.relationships,
                        ...processedData.goData.conflicts.relationships,
                    ],
                },
                errors: {
                    epidemiology: [
                        ...state.goData.errors.epidemiology,
                        ...processedData.goData.errors.epidemiology,
                    ],
                    events: [
                        ...state.goData.errors.events,
                        ...processedData.goData.errors.events,
                    ],
                    lab: [
                        ...state.goData.errors.lab,
                        ...processedData.goData.errors.lab,
                    ],
                    person: [
                        ...state.goData.errors.person,
                        ...processedData.goData.errors.person,
                    ],
                    questionnaire: [
                        ...state.goData.errors.questionnaire,
                        ...processedData.goData.errors.questionnaire,
                    ],
                    relationships: [
                        ...state.goData.errors.relationships,
                        ...processedData.goData.errors.relationships,
                    ],
                },
                inserts: {
                    epidemiology: [
                        ...state.goData.inserts.epidemiology,
                        ...processedData.goData.inserts.epidemiology,
                    ],
                    events: [
                        ...state.goData.inserts.events,
                        ...processedData.goData.inserts.events,
                    ],
                    lab: [
                        ...state.goData.inserts.lab,
                        ...processedData.goData.inserts.lab,
                    ],
                    person: [
                        ...state.goData.inserts.person,
                        ...processedData.goData.inserts.person,
                    ],
                    questionnaire: [
                        ...state.goData.inserts.questionnaire,
                        ...processedData.goData.inserts.questionnaire,
                    ],
                    relationships: [
                        ...state.goData.inserts.relationships,
                        ...processedData.goData.inserts.relationships,
                    ],
                },
                updates: {
                    epidemiology: [
                        ...state.goData.updates.epidemiology,
                        ...processedData.goData.updates.epidemiology,
                    ],
                    events: [
                        ...state.goData.updates.events,
                        ...processedData.goData.updates.events,
                    ],
                    lab: [
                        ...state.goData.updates.lab,
                        ...processedData.goData.updates.lab,
                    ],
                    person: [
                        ...state.goData.updates.person,
                        ...processedData.goData.updates.person,
                    ],
                    questionnaire: [
                        ...state.goData.updates.questionnaire,
                        ...processedData.goData.updates.questionnaire,
                    ],
                    relationships: [
                        ...state.goData.updates.relationships,
                        ...processedData.goData.updates.relationships,
                    ],
                },
            },
        };
    },

    addProcessedData: (state: Processed, processedData: Processed) => {
        return {
            ...state,
            processedData: [
                ...state.processedData,
                ...processedData.processedData,
            ],
        };
    },

    reset: () => {
        return {
            goData: {
                conflicts: {
                    epidemiology: [],
                    events: [],
                    lab: [],
                    person: [],
                    questionnaire: [],
                    relationships: [],
                },
                errors: {
                    epidemiology: [],
                    events: [],
                    lab: [],
                    person: [],
                    questionnaire: [],
                    relationships: [],
                },
                inserts: {
                    epidemiology: [],
                    events: [],
                    lab: [],
                    person: [],
                    questionnaire: [],
                    relationships: [],
                },
                updates: {
                    epidemiology: [],
                    events: [],
                    lab: [],
                    person: [],
                    questionnaire: [],
                    relationships: [],
                },
            },
            dhis2: {
                trackedEntityInstances: [],
                trackedEntityInstanceUpdates: [],
                enrollments: [],
                events: [],
                enrollmentUpdates: [],
                eventUpdates: [],
                errors: [],
                conflicts: [],
            },
            processedData: [],
        };
    },
};
