import { AxiosInstance } from "axios";
import { chunk, groupBy } from "lodash/fp";
import { fetchTrackedEntityInstancesByIds } from "./fetch-tracked-entities-by-ids";
import { CallbackArgs, Event } from "./interfaces";
import { queryOrganisationUnits } from "./utils";
import { uniq } from "lodash";

export const fetchPage = async ({
    afterFetch,
    api,
    params,
    page,
    fetchInstances,
    program,
}: {
    afterFetch: (args: Partial<CallbackArgs>) => void;
    api: Partial<{ engine: any; axios: AxiosInstance }>;
    params: Record<string, string>;
    page: number;
    fetchInstances: boolean;
    program: string;
}) => {
    let workingEvents: Array<Partial<Event>> = [];
    let currentPager: Partial<{
        page: number;
        pageSize: number;
        pageCount: number;
        total: number;
    }> = {};
    if (page === 1) {
        params = { ...params, totalPages: "true" };
    }
    params = { ...params, page: String(page) };

    let ouTree: Record<string, Record<string, string>> = {};

    if (api.engine) {
        const {
            data: { events, pager },
        }: any = await api.engine.query({
            data: {
                resource: `events.json?${new URLSearchParams(
                    params,
                ).toString()}`,
            },
        });
        workingEvents = events;
        currentPager = pager;

        ouTree = await queryOrganisationUnits(
            api,
            uniq(events.map((instance: Partial<Event>) => instance.orgUnit)),
        );
    } else if (api.axios) {
        const {
            data: { events, pager },
        } = await api.axios.get<{
            events: Event[];
            pager: {
                page: number;
                pageSize: number;
                pageCount: number;
                total: number;
            };
        }>(`events.json?${new URLSearchParams(params).toString()}`);
        workingEvents = events;
        currentPager = pager;
        ouTree = await queryOrganisationUnits(
            api,
            uniq(events.map((instance) => instance.orgUnit)),
        );
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
                ...ouTree[e.orgUnit],
                enrollments: [
                    ...e.enrollments.map((enrollment) => ({
                        ...enrollment,
                        events: events[
                            `${e.trackedEntityInstance}${enrollment.enrollment}`
                        ],
                    })),
                ],
            })),
            pager: currentPager,
        });
    } else {
        afterFetch({
            events: workingEvents,
            pager: currentPager,
        });
    }
    return currentPager;
};

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
    programStage?: string;
    pageSize?: string;
    others?: { [key: string]: string };
    afterFetch: (args: Partial<CallbackArgs>) => Promise<void> | void;
    fetchInstances?: boolean;
    program: string;
    events?: string[];
}) => {
    let page = 1;
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
                    events,
                    pager: { page },
                });
            } else if (api.axios) {
                const {
                    data: { events },
                } = await api.axios.get<{
                    events: Partial<Event>[];
                }>(`events.json?${new URLSearchParams(params).toString()}`);

                afterFetch({
                    events,
                    pager: { page },
                });
            }
        }
    } else {
        let params: { [key: string]: string } = {
            pageSize: String(pageSize),
            ...others,
        };

        if (programStage) {
            params = { ...params, programStage };
        } else {
            params = { ...params, program };
        }

        if (params.orgUnit) {
            params = { ...params, ouMode: "DESCENDANTS" };
        } else {
            params = { ...params, ouMode: "ALL" };
        }

        if (events && events.length > 0) {
            params = { ...params, event: events.join(",") };
        }

        const { pageCount } = await fetchPage({
            afterFetch,
            api,
            page,
            params,
            fetchInstances,
            program,
        });
        if (pageCount && pageCount > 1) {
            for (let p = 2; p <= pageCount; p++) {
                await fetchPage({
                    afterFetch,
                    api,
                    page: p,
                    params,
                    fetchInstances,
                    program,
                });
            }
        }
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
    if (programStages.length > 0) {
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
    } else {
        await fetchStageEvents({
            api,
            pageSize,
            others,
            afterFetch,
            program,
            fetchInstances,
            events,
        });
    }
};
