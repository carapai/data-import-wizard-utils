import { AxiosInstance } from "axios";
import { fromPairs, isArray, isEmpty, unionBy, uniq } from "lodash";
import { chunk, uniqBy } from "lodash/fp";
import { fetchTrackedEntityInstancesByIds } from "./fetch-tracked-entities-by-ids";
import { CallbackArgs, Filter, OU, TrackedEntityInstance } from "./interfaces";
import { joinAttributes } from "./program";

const queryOrganisationUnits = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    units: string[],
) => {
    if (api.engine) {
        const {
            units: { organisationUnits },
        }: { units: { organisationUnits: OU[] } } = await api.engine.query({
            units: {
                resource: `organisationUnits`,
                params: {
                    filter: `id:in:[${units.join(",")}]`,
                    paging: "false",
                    fields: "id,name,level,ancestors[id,name,level]",
                },
            },
        });
        return organisationUnits.reduce((agg, ou) => {
            agg[ou.id] = {
                [`level${ou.level}id`]: ou.id,
                [`level${ou.level}name`]: ou.name,
                ...ou.ancestors.reduce((agg, ancestor) => {
                    agg[`level${ancestor.level}id`] = ancestor.id;
                    agg[`level${ancestor.level}name`] = ancestor.name;
                    return agg;
                }, {}),
            };
            return agg;
        }, {});
    } else if (api.axios) {
        const {
            data: { organisationUnits },
        } = await api.axios.get<{
            organisationUnits: OU[];
        }>(`api/organisationUnits.json`, {
            params: {
                filter: `id:in:[${units.join(",")}]`,
                paging: "false",
                fields: "id,name,level,ancestors[id,name,level]",
            },
        });
        return organisationUnits.reduce((agg, ou) => {
            agg[ou.id] = {
                [`${ou.level}id`]: ou.id,
                [`${ou.level}name`]: ou.name,
                ...ou.ancestors.reduce((agg, ancestor) => {
                    agg[`${ancestor.level}id`] = ancestor.id;
                    agg[`${ancestor.level}name`] = ancestor.name;
                    return agg;
                }, {}),
            };
            return agg;
        }, {});
    }
};

export const queryTrackedEntityInstances = async (
    api: Partial<{ engine: any; axios: AxiosInstance }>,
    params: URLSearchParams | URLSearchParams[],
): Promise<
    Partial<{
        pager: {
            page: number;
            pageCount: number;
            total: number;
            pageSize: number;
        };
    }> &
        Required<{
            trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
        }>
> => {
    if (isArray(params) && api.engine) {
        const response: {
            [key: string]: {
                trackedEntityInstances: TrackedEntityInstance[];
            };
        } = await api.engine.query(
            fromPairs(
                params.map((currentParam, index) => [
                    `x${index}`,
                    {
                        resource: `trackedEntityInstances.json?${currentParam.toString()}`,
                    },
                ]),
            ),
        );

        let currentInstances: TrackedEntityInstance[] = [];

        for (const { trackedEntityInstances } of Object.values(response)) {
            let ouTree: Record<
                string,
                Record<string, string>
            > = await queryOrganisationUnits(
                api,
                uniq(
                    trackedEntityInstances.map((instance) => instance.orgUnit),
                ),
            );

            currentInstances = unionBy(
                currentInstances,
                trackedEntityInstances.map((currentInstance) => ({
                    ...currentInstance,
                    ...ouTree[currentInstance.orgUnit],
                })),
                "trackedEntityInstance",
            );
        }
        return { trackedEntityInstances: currentInstances };
    } else if (isArray(params) && api.axios) {
        const allQueries = await Promise.all(
            params.map((currentParam) =>
                api.axios.get<
                    Partial<{
                        pager: {
                            page: number;
                            pageCount: number;
                            total: number;
                            pageSize: number;
                        };
                    }> &
                        Required<{
                            trackedEntityInstances: Array<
                                Partial<TrackedEntityInstance>
                            >;
                        }>
                >(`api/trackedEntityInstances.json?${currentParam.toString()}`),
            ),
        );

        let currentInstances: Array<Partial<TrackedEntityInstance>> = [];

        for (const {
            data: { trackedEntityInstances },
        } of allQueries) {
            let ouTree: Record<
                string,
                Record<string, string>
            > = await queryOrganisationUnits(
                api,
                uniq(
                    trackedEntityInstances.map((instance) => instance.orgUnit),
                ),
            );

            currentInstances = unionBy(
                currentInstances,
                trackedEntityInstances.map((currentInstance) => ({
                    ...currentInstance,
                    ...ouTree[currentInstance.orgUnit],
                })),
                "trackedEntityInstance",
            );
        }
        return { trackedEntityInstances: currentInstances };
    } else if (api.engine) {
        const {
            data: { trackedEntityInstances, pager },
        }: {
            data: {
                trackedEntityInstances: TrackedEntityInstance[];
                pager: {
                    page: number;
                    pageCount: number;
                    total: number;
                    pageSize: number;
                };
            };
        } = await api.engine.query({
            data: {
                resource: `trackedEntityInstances.json?${params.toString()}`,
            },
        });
        let ouTree: Record<
            string,
            Record<string, string>
        > = await queryOrganisationUnits(
            api,
            uniq(trackedEntityInstances.map((instance) => instance.orgUnit)),
        );
        return {
            trackedEntityInstances: trackedEntityInstances.map(
                (currentInstance) => ({
                    ...currentInstance,
                    ...ouTree[currentInstance.orgUnit],
                }),
            ),
            pager,
        };
    } else if (api.axios) {
        const {
            data: { trackedEntityInstances, pager },
        } = await api.axios.get<
            Partial<{
                pager: {
                    page: number;
                    pageCount: number;
                    total: number;
                    pageSize: number;
                };
            }> &
                Required<{
                    trackedEntityInstances: Array<
                        Partial<TrackedEntityInstance>
                    >;
                }>
        >(`api/trackedEntityInstances.json?${params.toString()}`);

        let ouTree: Record<
            string,
            Record<string, string>
        > = await queryOrganisationUnits(
            api,
            uniq(trackedEntityInstances.map((instance) => instance.orgUnit)),
        );
        return {
            trackedEntityInstances: trackedEntityInstances.map(
                (currentInstance) => ({
                    ...currentInstance,
                    ...ouTree[currentInstance.orgUnit],
                }),
            ),
            pager,
        };
    }

    return { trackedEntityInstances: [] };
};

export const fetchTrackedEntityInstances = async (
    {
        api,
        program,
        trackedEntityType,
        additionalParams = { includeDeleted: "false" },
        uniqueAttributeValues = [],
        withAttributes = false,
        trackedEntityInstances = [],
        fields = "*",
        pageSize = "50",
        numberOfUniqAttribute = 1,
        setMessage,
        filters = [],
    }: Partial<{
        additionalParams: { [key: string]: string };
        uniqueAttributeValues: Array<{ [key: string]: string }>;
        withAttributes: boolean;
        trackedEntityInstances: string[];
        program: string;
        trackedEntityType: string;
        fields: string;
        pageSize: string;
        numberOfUniqAttribute: number;
        filters: Filter[];
    }> &
        Required<{
            api: Partial<{ engine: any; axios: AxiosInstance }>;
            setMessage: (message: string) => void;
        }>,
    afterFetch: (args: Partial<CallbackArgs>) => void = undefined,
): Promise<{
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
}> => {
    let foundInstances: Array<Partial<TrackedEntityInstance>> = [];
    if (trackedEntityInstances.filter((a) => a !== undefined).length > 0) {
        const data = await fetchTrackedEntityInstancesByIds({
            api,
            program,
            ids: trackedEntityInstances,
        });

        if (afterFetch) {
            afterFetch({ trackedEntityInstances: data });
        } else {
            foundInstances = [...foundInstances, ...data];
        }
    } else if (
        withAttributes &&
        uniqueAttributeValues.length > 0 &&
        numberOfUniqAttribute === 1
    ) {
        let page = 1;
        const attribute = Object.keys(uniqueAttributeValues[0])[0];
        const allValues = uniq(
            uniqueAttributeValues.map((o) => Object.values(o)[0]),
        );
        const chunkedData = chunk(Number(pageSize), allValues);
        for (const attributeValues of chunkedData) {
            let params = new URLSearchParams(additionalParams);
            params.append(
                "filter",
                `${attribute}:in:${attributeValues.join(";")}`,
            );
            params.append("fields", fields);
            if (trackedEntityType) {
                params.append("trackedEntityType", trackedEntityType);
            } else if (program) {
                params.append("program", program);
            }
            params.append("skipPaging", "true");
            if (!additionalParams["ou"]) {
                params.append("ouMode", "ALL");
            }
            if (additionalParams["ou"]) {
                params.append("ouMode", "DESCENDANTS");
            }
            const { trackedEntityInstances } =
                await queryTrackedEntityInstances(api, params);

            const joinedInstances = joinAttributes(
                trackedEntityInstances,
                program,
            );
            setMessage(`Fetching ${page} of ${chunkedData.length} pages`);
            const pager = {
                pageSize: Number(pageSize),
                total: allValues.length,
                page,
                pageCount: chunkedData.length,
            };
            if (afterFetch) {
                afterFetch({
                    trackedEntityInstances: joinedInstances,
                    pager,
                });
            } else {
                foundInstances = foundInstances.concat(joinedInstances);
            }
            page = page + 1;
        }
    } else if (
        withAttributes &&
        uniqueAttributeValues.length > 0 &&
        numberOfUniqAttribute > 1
    ) {
        let page = 1;
        const chunkedData = chunk(Number(pageSize), uniqueAttributeValues);
        for (const attributeValues of chunkedData) {
            const all = attributeValues.map((a) => {
                let params = new URLSearchParams(additionalParams);
                Object.entries(a).forEach(([attribute, value]) =>
                    params.append("filter", `${attribute}:eq:${value}`),
                );
                params.append("fields", fields);
                if (program) {
                    params.append("program", program);
                } else if (trackedEntityType) {
                    params.append("trackedEntityType", trackedEntityType);
                }
                params.append("skipPaging", "true");
                if (!additionalParams["ou"]) {
                    params.append("ouMode", "ALL");
                }

                if (additionalParams["ou"]) {
                    params.append("ouMode", "DESCENDANTS");
                }
                return queryTrackedEntityInstances(api, params);
            });
            setMessage(`Fetching ${page} of ${chunkedData.length} pages`);
            const result = await Promise.all(all);
            const trackedEntityInstances = result.flatMap(
                ({ trackedEntityInstances }) => trackedEntityInstances,
            );

            const joinedInstances = joinAttributes(
                uniqBy("trackedEntityInstance", trackedEntityInstances),
                program,
            );

            if (afterFetch) {
                afterFetch({
                    trackedEntityInstances: joinedInstances,
                    pager: {
                        total: uniqueAttributeValues.length,
                        page,
                        pageCount: chunkedData.length,
                        pageSize: Number(pageSize),
                    },
                });
            } else {
                foundInstances = foundInstances.concat(joinedInstances);
            }
            page = page + 1;
        }
    } else if (!withAttributes) {
        let page = 1;
        const params = new URLSearchParams({
            ...additionalParams,
            fields,
            page: String(page),
            pageSize,
        });

        if (program) {
            params.append("program", program);
        } else if (trackedEntityType) {
            params.append("trackedEntityType", trackedEntityType);
        }
        if (!additionalParams["ou"] && !additionalParams["ouMode"]) {
            params.append("ouMode", "ALL");
        }
        if (additionalParams["ou"]) {
            params.append("ouMode", "DESCENDANTS");
        }

        if (filters.length > 0) {
            for (const filter of filters) {
                params.append(
                    "filter",
                    `${filter.attribute}:${filter.operator}:${filter.value}`,
                );
            }
        }

        setMessage(`Fetching data for the first page`);
        const first = new URLSearchParams(params);
        first.append("totalPages", "true");
        const { pager, trackedEntityInstances, ...rest } =
            await queryTrackedEntityInstances(api, first);
        const joinedInstances = joinAttributes(trackedEntityInstances, program);
        if (afterFetch) {
            afterFetch({
                trackedEntityInstances: joinedInstances,
                pager,
            });
        } else {
            foundInstances = foundInstances.concat(joinedInstances);
        }
        if (!isEmpty(pager) && pager.pageCount > 1) {
            for (let p = 2; p <= pager.pageCount; p++) {
                const second = new URLSearchParams(params);
                second.delete("page");
                second.append("page", String(p));
                try {
                    setMessage(`Fetching data for ${p} of ${pager.pageCount}`);
                    const { trackedEntityInstances } =
                        await queryTrackedEntityInstances(api, second);
                    const joinedInstances = joinAttributes(
                        trackedEntityInstances,
                        program,
                    );

                    if (afterFetch) {
                        afterFetch({
                            trackedEntityInstances: joinedInstances,
                            pager: { ...pager, page: p },
                        });
                    } else {
                        foundInstances = foundInstances.concat(joinedInstances);
                    }
                } catch (error) {
                    console.log(error);
                }
            }
        }
    } else if (afterFetch) {
        afterFetch({});
    }
    return { trackedEntityInstances: foundInstances };
};
