import { AxiosInstance } from "axios";
import { chunk, groupBy } from "lodash/fp";
import { fetchTrackedEntityInstancesByIds } from "./fetch-tracked-entities-by-ids";
import { CallbackArgs, Event } from "./interfaces";

export const fetchStageEvents = async ({
    api,
    programStage,
    others = {},
    pageSize = "50",
    afterFetch,
    fetchInstances,
    program,
    events,
}: {
    api: Partial<{ engine: any; axios: AxiosInstance }>;
    programStage: string;
    pageSize?: string;
    others?: { [key: string]: string };
    afterFetch: (args: Partial<CallbackArgs>) => Promise<void> | void;
    fetchInstances?: boolean;
    program: string;
    events?: string[];
}) => {
    let page = 1;
    let currentEvents = 0;
    if (events && events.length > 0) {
        const allChunks = chunk(25, events);
        for (const currentChunk of allChunks) {
            let params: { [key: string]: string } = {
                event: currentChunk.join(","),
            };
            if (api.engine) {
                const {
                    data: { events },
                }: any = await api.engine.query({
                    data: {
                        resource: `events.json?${new URLSearchParams(
                            params,
                        ).toString()}`,
                    },
                });
                afterFetch({
                    trackedEntityInstances: [
                        {
                            enrollments: [{ events, attributes: [] }],
                            attributes: [],
                        },
                    ],
                    pager: { page },
                });
            } else if (api.axios) {
                const {
                    data: { events },
                } = await api.axios.get<{
                    events: Event[];
                }>(`events.json?${new URLSearchParams(params).toString()}`);

                afterFetch({
                    trackedEntityInstances: [
                        {
                            enrollments: [{ events, attributes: [] }],
                            attributes: [],
                        },
                    ],
                    pager: { page },
                });
            }
        }
    } else {
        do {
            let params: { [key: string]: string } = {
                programStage,
                pageSize: String(pageSize),
                page: String(page),
                ...others,
            };

            if (params.orgUnit) {
                params = { ...params, ouMode: "DESCENDANTS" };
            } else {
                params = { ...params, ouMode: "ALL" };
            }

            if (events && events.length > 0) {
                params = { ...params, event: events.join(",") };
            }

            console.log(`Querying page ${page}`);
            let workingEvents: Array<Partial<Event>> = [];

            if (api.engine) {
                const {
                    data: { events },
                }: any = await api.engine.query({
                    data: {
                        resource: `events.json?${new URLSearchParams(
                            params,
                        ).toString()}`,
                    },
                });
                workingEvents = events;
                currentEvents = events.length;
            } else if (api.axios) {
                const {
                    data: { events },
                } = await api.axios.get<{
                    events: Event[];
                }>(`events.json?${new URLSearchParams(params).toString()}`);
                workingEvents = events;
                currentEvents = events.length;
            }
            if (fetchInstances) {
                const ids = workingEvents.map(
                    ({ trackedEntityInstance }) => trackedEntityInstance,
                );
                const instances = await fetchTrackedEntityInstancesByIds({
                    api,
                    ids,
                    program,
                    fields: "created,orgUnit,createdAtClient,trackedEntityInstance,lastUpdated,trackedEntityType,lastUpdatedAtClient,potentialDuplicate,inactive,deleted,featureType,programOwners,relationships[*],attributes[*],enrollments[storedBy,createdAtClient,program,lastUpdated,created,orgUnit,enrollment,trackedEntityInstance,trackedEntityType,lastUpdatedAtClient,orgUnitName,enrollmentDate,deleted,incidentDate,status,attributes[*]]",
                });

                const events = groupBy((a) => {
                    return `${a.trackedEntityInstance}${a.enrollment}`;
                }, workingEvents);

                afterFetch({
                    trackedEntityInstances: instances.map((e) => ({
                        ...e,
                        enrollments: [
                            ...e.enrollments.map((enrollment) => ({
                                ...enrollment,
                                events: events[
                                    `${e.trackedEntityInstance}${enrollment.enrollment}`
                                ],
                            })),
                        ],
                    })),
                });
            } else {
                afterFetch({
                    trackedEntityInstances: [
                        { enrollments: [{ events: workingEvents }] },
                    ],
                    pager: { page },
                });
            }
            page = page + 1;
        } while (currentEvents > 0);
    }
};

export const fetchEvents = async ({
    api,
    programStages,
    pageSize,
    others = {},
    program,
    afterFetch,
    fetchInstances,
    events,
}: {
    api: Partial<{ engine: any; axios: AxiosInstance }>;
    programStages: string[];
    pageSize: string;
    program: string;
    others: { [key: string]: string };
    afterFetch: (args: Partial<CallbackArgs>) => void;
    fetchInstances: boolean;
    events?: string[];
}) => {
    for (const programStage of programStages) {
        await fetchStageEvents({
            api,
            programStage,
            pageSize,
            others,
            afterFetch,
            program,
            fetchInstances,
            events,
        });
    }
};
