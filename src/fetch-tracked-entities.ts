import { AxiosInstance } from "axios";
import { CallbackArgs, TrackedEntityInstance } from "./interfaces";
import { fetchTrackedEntityInstancesByIds } from "./fetch-tracked-entities-by-ids";
import { fromPairs, isArray, isEmpty, unionBy, uniq } from "lodash";
import { chunk, uniqBy } from "lodash/fp";
import { joinAttributes } from "./program";

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
            currentInstances = unionBy(
                currentInstances,
                trackedEntityInstances,
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
            currentInstances = unionBy(
                currentInstances,
                trackedEntityInstances,
                "trackedEntityInstance",
            );
        }
        return { trackedEntityInstances: currentInstances };
    } else if (api.engine) {
        const { data }: any = await api.engine.query({
            data: {
                resource: `trackedEntityInstances.json?${params.toString()}`,
            },
        });
        return data;
    } else if (api.axios) {
        const { data } = await api.axios.get<
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

        return data;
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
    }> &
        Required<{
            api: Partial<{ engine: any; axios: AxiosInstance }>;
            setMessage: React.Dispatch<React.SetStateAction<string>>;
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
        let params: { [key: string]: string } = {
            fields,
            page: String(page),
            pageSize,
            ...additionalParams,
        };
        if (program) {
            params = { ...params, program };
        } else if (trackedEntityType) {
            params = { ...params, trackedEntityType };
        }
        if (!additionalParams["ou"] && !additionalParams["ouMode"]) {
            params = { ...params, ouMode: "ALL" };
        }
        if (additionalParams["ou"]) {
            params = { ...params, ouMode: "DESCENDANTS" };
        }
        setMessage(() => `Fetching data for the first page`);
        const { pager, trackedEntityInstances } =
            await queryTrackedEntityInstances(
                api,
                new URLSearchParams({ ...params, totalPages: "true" }),
            );

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
                try {
                    setMessage(
                        () => `Fetching data for ${p} of ${pager.pageCount}`,
                    );
                    const { trackedEntityInstances } =
                        await queryTrackedEntityInstances(
                            api,
                            new URLSearchParams({ ...params, page: String(p) }),
                        );
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
