import axios, { AxiosInstance } from "axios";
import dayjs, { Dayjs } from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import isoWeek from "dayjs/plugin/isoWeek";
import localeData from "dayjs/plugin/localeData";
import updateLocale from "dayjs/plugin/updateLocale";
import weekday from "dayjs/plugin/weekday";
import weekOfYear from "dayjs/plugin/weekOfYear";
import { diff } from "jiff";
import {
    Dictionary,
    difference,
    intersection,
    isEmpty,
    isEqual,
    isObject,
    orderBy,
    transform,
} from "lodash";
import {
    fromPairs,
    get,
    getOr,
    groupBy,
    isArray,
    isString,
    max,
    set,
} from "lodash/fp";
import { convertToDHIS2 } from "./dhis2-converter";
import { processPreviousInstances } from "./entities-processor";
import {
    AggDataValue,
    Authentication,
    DHIS2Response,
    GODataOption,
    GoDataOuTree,
    GODataTokenGenerationResponse,
    GoResponse,
    IEnrollment,
    IGoData,
    IGoDataOrgUnit,
    IMapping,
    IProgram,
    Mapping,
    Option,
    Param,
    PartialEvent,
    Period,
    Processed,
    RealMapping,
    StageMapping,
    TrackedEntityInstance,
    Update,
    ValueType,
    OU,
} from "./interfaces";
import {
    findUniqAttributes,
    getProgramStageUniqColumns,
    getProgramUniqAttributes,
} from "./program";

import { fetchTrackedEntityInstances } from "./fetch-tracked-entities";
import { flattenEntitiesByEvents } from "./flatten-dhis2";
import { generateUid } from "./uid";
import { emptyProcessedData } from "./constants";
import { mapUnion } from "./maps";

dayjs.extend(localeData);
dayjs.extend(updateLocale);
dayjs.extend(weekday);
dayjs.extend(advancedFormat);
dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

type NestedMap<K1, K2, V> = Map<K1, Map<K2, V>>;

function updateLocaleAndWeekStart(
    date: Dayjs,
    locale: string,
    weekStart: number,
): Dayjs {
    dayjs.locale(locale);
    dayjs.updateLocale(locale, {
        weekStart: weekStart,
    });
    return dayjs(date);
}

export function modifyGoDataOu(
    node: GoDataOuTree,
    parent: { id: string; name: string },
) {
    if (!node.children || node.children.length === 0) {
        const { location } = node;
        return { title: location.name, value: location.id };
    }
    const modifiedChildren = node.children.map((chidNode) =>
        modifyGoDataOu(chidNode, node.location),
    );
    const { location } = node;
    return {
        children: modifiedChildren,
        value: location.id,
        title: location.name,
    };
}

export function getLeavesWithParentInfo(
    node: GoDataOuTree,
    parentInfo: Array<{ id: string; name: string; code?: string }> = [],
): Array<{
    id: string;
    name: string;
    code?: string;
    parentInfo: Array<{ id: string; name: string }>;
}> {
    if (!node.children || node.children.length === 0) {
        return [
            {
                id: node.location.id,
                name: node.location.name,
                code: node.location.identifiers?.[0]?.code,
                parentInfo,
            },
        ];
    }
    return node.children.flatMap((child) =>
        getLeavesWithParentInfo(child, [
            ...parentInfo,
            {
                name: node.location.name,
                id: node.location.id,
                code: node.location.identifiers?.[0]?.code,
            },
        ]),
    );
}

export const makeFlipped = (dataMapping: Mapping) => {
    return fromPairs(
        Object.entries(dataMapping).map(([option, { source }]) => {
            return [source, option];
        }),
    );
};

export const makeRemoteApi = (authentication?: Partial<Authentication>) => {
    let params = new URLSearchParams();
    Object.values(authentication?.params || {}).forEach(({ param, value }) => {
        if (param && value) {
            params.append(param, value);
        }
    });
    if (
        !isEmpty(authentication) &&
        authentication.url &&
        authentication.basicAuth &&
        authentication.username &&
        authentication.password
    ) {
        return axios.create({
            baseURL: authentication.url,
            auth: {
                username: authentication.username,
                password: authentication.password,
            },
            params,
            headers: fromPairs(
                Object.values(authentication?.headers ?? {}).map(
                    ({ param, value }) => [param, value],
                ),
            ),
        });
    }

    if (!isEmpty(authentication) && authentication.url) {
        return axios.create({
            baseURL: authentication.url,
            params,
            headers: fromPairs(
                Object.values(authentication?.headers ?? {}).map(
                    ({ param, value }) => [param, value],
                ),
            ),
        });
    }
};

export const createOptions = (options: string[]): Option[] => {
    return options.map((label) => {
        return { label, value: label };
    });
};

const getParent = (data: IGoDataOrgUnit[], child: IGoDataOrgUnit) => {
    let all: IGoDataOrgUnit[] = [];
    let initialParent = child.parentLocationId;
    while (initialParent) {
        const search = data.find((record) => record.id === initialParent);
        if (search) {
            initialParent = search.parentLocationId;
            all = [...all, search];
        } else {
            initialParent = null;
        }
    }

    return all;
};

export function getLowestLevelParents(data: IGoDataOrgUnit[]) {
    const grouped = groupBy("geographicalLevelId", data);
    const maxGroup = max(Object.keys(grouped));
    return grouped[maxGroup].map((child) => {
        const parents = getParent(data, child);
        const name = [...parents.map((x) => x.name).reverse(), child.name].join(
            "/",
        );
        return { ...child, name };
    });
}

export const fetchRemote = async <IData>(
    authentication: Partial<Authentication> | undefined,
    url: string = "",
    params: Map<string, Partial<Param>> = new Map(),
    headers: Map<string, string> = new Map(),
) => {
    const api = makeRemoteApi({
        ...authentication,
        params: mapUnion(authentication?.params || new Map(), params),
    });
    const { data } = await api.get<IData>(url);
    return data;
};

export const postRemote = async <IData>(
    authentication: Partial<Authentication> | undefined,
    url: string = "",
    payload: Object,
    params: Map<string, Partial<Param>> = new Map(),
) => {
    const api = makeRemoteApi({
        ...authentication,
        params: mapUnion(authentication?.params || new Map(), params),
    });
    const { data } = await api.post<IData>(url, payload);
    return data;
};

export const putRemote = async <IData>(
    authentication: Partial<Authentication> | undefined,
    url: string = "",
    payload: Object,
    params: Map<string, Partial<Param>> = new Map(),
) => {
    const api = makeRemoteApi({
        ...authentication,
        params: mapUnion(authentication?.params || new Map(), params),
    });
    const { data } = await api.put<IData>(url, payload);
    return data;
};

export const compareArrays = <TData>(
    source: TData[],
    destination: TData[],
    key: keyof TData,
) => {
    const sourceKeys = source
        .map((val) => get(key, val))
        .sort()
        .join();
    const sourceValues = source
        .map((val) => get("value", val))
        .sort()
        .join();
    const destinationKeys = destination
        .map((val) => get(key, val))
        .sort()
        .join();
    const destinationValues = destination
        .map((val) => get("value", val))
        .sort()
        .join();
    return sourceKeys === destinationKeys && sourceValues === destinationValues;
};

export const mergeArrays = <TData>(
    source: TData[],
    destination: TData[],
    key: string,
) => {
    const sources = source.map((val: TData) => [get(key, val), val]);
    let destinations = fromPairs<TData>(
        destination.map((val) => [get(key, val), val]),
    );

    sources.forEach(([key, value]) => {
        destinations = { ...destinations, [key]: value };
    });
    return Object.values(destinations);
};

export const updateObject = (
    state: Mapping,
    { attribute, value, key }: Update,
) => {
    return {
        ...state,
        ...{ [attribute]: { ...state[attribute], [key]: value } },
    };
};

export const getToken = async <V>(
    authentication: Partial<Authentication> | undefined,
    tokenGenerationUsernameField: string,
    tokenGenerationPasswordField: string,
    tokenGenerationURL: string,
) => {
    const {
        params,
        basicAuth,
        hasNextLink,
        headers,
        password,
        username,
        ...rest
    } = authentication;

    const data = await postRemote<V>(rest, tokenGenerationURL, {
        [tokenGenerationUsernameField]: username,
        [tokenGenerationPasswordField]: password,
    });

    return data;
};

export const pullRemoteData = async (
    mapping: Partial<IMapping>,
    goData: Partial<IGoData>,
    tokens: Map<string, string>,
    token: string,
    remoteAPI: AxiosInstance,
) => {
    if (mapping.dataSource === "go-data" && goData.id) {
        const data = await fetchRemote<any[]>(
            {
                ...mapping.authentication,
                params: new Map([
                    ["auth", { param: "access_token", value: token }],
                ]),
            },
            `api/outbreaks/${goData.id}/cases`,
        );
        return data.map((d) => {
            const processed = Object.entries(d).map(([key, value]) => {
                if (isArray(value)) {
                    return [key, value.map((v) => tokens.get(v) || v)];
                }

                if (isString(value)) {
                    return [key, tokens.get(value) || value];
                }
                return [key, value];
            });
            return fromPairs(processed);
        });
    } else {
        const { data } = await remoteAPI.get("");
        return data;
    }
};

/**
 * This code is licensed under the terms of the MIT license
 *
 * Deep diff between two object, using lodash
 */
export function findDiff(
    object: { [key: string]: any },
    base: { [key: string]: any },
) {
    function changes(
        object: { [key: string]: any },
        base: { [key: string]: any },
    ) {
        return transform(object, function (result, value, key) {
            if (!isEqual(value, base[key])) {
                result[key] =
                    isObject(value) && isObject(base[key])
                        ? changes(value, base[key])
                        : value;
            }
        });
    }
    return changes(object, base);
}

export function findDifference(
    destination: { [key: string]: any },
    source: { [key: string]: any },
    attributes: Dictionary<Option>,
) {
    const sourceKeys = Object.keys(source);
    const destinationKeys = Object.keys(destination);
    const differenceKeys = difference(sourceKeys, destinationKeys);
    let current = fromPairs(differenceKeys.map((key) => [key, source[key]]));
    const intersectingKeys = intersection(destinationKeys, sourceKeys);
    for (const key of intersectingKeys) {
        const destinationValue = destination[key];
        const sourceValue = source[key];
        const attribute = attributes[key];
        if (attribute) {
        } else {
        }

        if (isArray(destinationValue) && isArray(sourceValue)) {
            const firstDest = destinationValue[0];
            const firstSource = sourceValue[0];
        } else if (isObject(destinationValue) && isObject(sourceValue)) {
        } else if (
            JSON.stringify(destinationValue) !== JSON.stringify(sourceValue)
        ) {
            current = { ...current, [key]: source[key] };
        }
    }

    return current;
}

export const getGoDataToken = async (mapping: Partial<IMapping>) => {
    const {
        params,
        basicAuth,
        hasNextLink,
        headers,
        password,
        username,
        ...rest
    } = mapping.authentication || {};

    const response = await postRemote<GODataTokenGenerationResponse>(
        rest,
        "api/users/login",
        {
            email: username,
            password,
        },
    );

    if (response) {
        return response.id;
    }
};

export const fetchGoDataHierarchy = async (
    authentication: Partial<Authentication>,
    locationIds: string[],
) => {
    const hierarchy = await fetchRemote<GoDataOuTree[]>(
        authentication,
        "api/locations/hierarchical",
    );

    return hierarchy.flatMap((ou) => {
        if (locationIds.indexOf(ou.location.id) !== -1) {
            return getLeavesWithParentInfo(ou);
        }
        return [];
    });
};

export const loadPreviousGoData = async (
    token: string,
    mapping: Partial<IMapping>,
    outbreak?: Partial<IGoData>,
) => {
    const {
        params,
        basicAuth,
        hasNextLink,
        headers,
        password,
        username,
        ...rest
    } = mapping.authentication || {};

    if (!outbreak && mapping.program.remoteProgram) {
        outbreak = await fetchRemote<Partial<IGoData>>(
            {
                ...rest,
                params: new Map([
                    ["auth", { param: "access_token", value: token }],
                ]),
            },
            `api/outbreaks/${mapping.program.remoteProgram}`,
        );
    }

    const reference = await fetchRemote<any>(
        {
            ...rest,
            params: new Map([
                ["auth", { param: "access_token", value: token }],
            ]),
        },
        "api/filter-mappings",
    );

    const tokens = await fetchRemote<{
        languageId: string;
        lastUpdateDate: string;
        tokens: Array<{ token: string; translation: string }>;
    }>(
        {
            ...rest,
            params: new Map([
                ["auth", { param: "access_token", value: token }],
            ]),
        },
        "api/languages/english_us/language-tokens",
    );
    const actualTokens = fromPairs(
        tokens.tokens.map(({ token, translation }) => [token, translation]),
    );

    const organisations = await fetchRemote<IGoDataOrgUnit[]>(
        {
            ...rest,
            params: new Map([
                ["auth", { param: "access_token", value: token }],
            ]),
        },
        "api/locations",
    );
    const goDataOptions = await fetchRemote<GODataOption[]>(
        {
            ...rest,
            params: new Map([
                ["auth", { param: "access_token", value: token }],
            ]),
        },
        "api/reference-data",
    );

    const realGoDataOptions = goDataOptions.map(({ id }) => {
        return { label: actualTokens[id] || id, value: id };
    });

    const hierarchy = await fetchGoDataHierarchy(
        {
            ...rest,
            params: new Map([
                ["auth", { param: "access_token", value: token }],
            ]),
        },
        outbreak.locationIds,
    );

    return {
        tokens: actualTokens,
        organisations,
        outbreak,
        options: realGoDataOptions,
        goDataOptions,
        hierarchy: hierarchy,
    };
};

export const findChanges = ({
    source,
    destination,
}: {
    source: { [key: string]: any };
    destination: { [key: string]: any };
}) => {
    let changes: { [key: string]: any } = {};
    Object.entries(source).forEach(([key, value]) => {
        const destinationValue = destination[key];
        if (!destinationValue && value) {
            changes = { ...changes, [key]: value };
        } else if (
            isObject(destinationValue) &&
            isObject(value) &&
            !isArray(destinationValue) &&
            !isArray(value)
        ) {
            const currentChanges = findChanges({
                source: value,
                destination: destinationValue,
            });
            if (!isEmpty(currentChanges)) {
                changes = { ...changes, [key]: value };
            }
        } else if (isArray(destinationValue) && isArray(value)) {
            const search = value.flatMap((v) => {
                const keys = Object.keys(v);
                const sourceValue = keys.map((k) => v[k]).join("");
                const destValue = destinationValue.find(
                    (d: any) => keys.map((k) => d[k]).join("") === sourceValue,
                );
                if (!destValue) {
                    return v;
                }
                return [];
            });

            if (search.length > 0) {
                changes = { ...changes, [key]: value };
            }
        } else if (
            destinationValue &&
            value &&
            String(destinationValue) !== String(value)
        ) {
            changes = { ...changes, [key]: value };
        }
    });

    return changes;
};

export const evaluateMapping = (
    attributeMapping: Mapping,
    fields: Option[],
    instanceData: any,
    flippedOptions: Dictionary<string>,
    flippedUnits: Dictionary<string>,
    uniqAttributes: Array<Partial<RealMapping>>,
) => {
    let errors: any[] = [];
    let conflicts: any[] = [];

    const uniqValues = uniqAttributes
        .map(({ source }) => getOr("", source, instanceData))
        .join("");

    const availableUniqueAttributes = uniqAttributes
        .map(({ destination }) => destination)
        .join("");

    let results: { [key: string]: any } = {};
    fields.forEach(
        ({
            value: val,
            optionSetValue,
            availableOptions,
            valueType,
            isOrgUnit,
        }) => {
            const mapping = attributeMapping[val];
            if (mapping) {
                const validation = ValueType[mapping.valueType];
                let value = getOr("", mapping.source, instanceData);
                if (mapping.isSpecific) {
                    value = mapping.source;
                } else if (value && valueType === "INTEGER") {
                    value = parseInt(value, 10);
                } else if (valueType === "DATE" && value) {
                    value = value.slice(0, 10);
                }
                let result: any = { success: true };
                if (optionSetValue && value) {
                    value = flippedOptions[value] || value;
                    if (
                        availableOptions.findIndex(
                            (v: Option) =>
                                v.value === value ||
                                v.code === value ||
                                v.id === value,
                        ) !== -1
                    ) {
                        result = { ...result, success: true };
                    } else {
                        if (mapping.mandatory) {
                            errors = [
                                ...errors,
                                {
                                    id: generateUid(),
                                    value,
                                    attribute: val,
                                    valueType,
                                    message: `Expected values (${availableOptions
                                        .map(({ value }) => value)
                                        .join(",")})`,
                                },
                            ];
                        } else if (value) {
                            conflicts = [
                                ...conflicts,
                                {
                                    id: generateUid(),
                                    value,
                                    attribute: val,
                                    valueType: valueType,
                                    message: `Expected values (${availableOptions
                                        .map(({ value }) => value)
                                        .join(",")})`,
                                },
                            ];
                        }
                        result = { ...result, success: false };
                    }
                } else if (value && validation) {
                    try {
                        result = validation.parse(value);
                        result = { ...result, success: true };
                    } catch (error) {
                        const { issues } = error;
                        result = {
                            ...issues[0],
                            success: false,
                        };
                        if (mapping.mandatory) {
                            errors = [
                                ...errors,
                                ...issues.map((i: any) => ({
                                    ...i,
                                    value,
                                    attribute: val,
                                    valueType: mapping.valueType,
                                    [availableUniqueAttributes]: uniqValues,
                                    id: generateUid(),
                                })),
                            ];
                        } else {
                            conflicts = [
                                ...conflicts,
                                ...issues.map((i: any) => ({
                                    ...i,
                                    value,
                                    attribute: val,
                                    valueType: mapping.valueType,
                                    [availableUniqueAttributes]: uniqValues,
                                    id: generateUid(),
                                })),
                            ];
                        }
                    }
                }
                if (value && result.success) {
                    if (isOrgUnit && flippedUnits[value]) {
                        results = set(val, flippedUnits[value], results);
                    } else {
                        results = set(val, value, results);
                    }
                }
            }
        },
    );

    if (isEmpty(results)) {
        return { results, errors, conflicts };
    }

    return {
        results: { ...results, [uniqAttributes.join("")]: uniqValues },
        errors,
        conflicts,
    };
};

export const findUpdates = (
    previousData: any[],
    currentData: any,
    attribute: string,
) => {
    let result: { update: any[]; insert: any[] } = {
        insert: [],
        update: [],
    };
    const prev = previousData.find((i: any) => {
        return i[attribute] === currentData[attribute];
    });
    if (prev && !isEmpty(currentData)) {
        const difference = diff(prev, currentData);
        const filteredDifferences = difference.filter(
            ({ op, path }) =>
                ["add", "replace", "copy"].indexOf(op) !== -1 &&
                path !== `/${attribute}` &&
                path !== `/addresses/0`,
        );
        if (filteredDifferences.length > 0) {
            return {
                update: [
                    {
                        ...prev,
                        ...currentData,
                    },
                ],
                insert: [],
            };
        }
    } else if (!isEmpty(currentData)) {
        return {
            update: [],
            insert: [currentData],
        };
    }

    return result;
};

export const groupGoData4Insert = async (
    goData: Partial<IGoData>,
    inserts: GoResponse,
    updates: GoResponse,
    prev: Map<string, string>,
    authentication: Partial<Authentication>,
    setMessage: (message: string) => void,
    onFinish: (
        feedback: Partial<{
            errors: any[];
            updates: any[];
            inserts: any[];
        }>,
    ) => void,
) => {
    const {
        params,
        basicAuth,
        hasNextLink,
        headers,
        password,
        username,
        ...rest
    } = authentication;

    const response: GODataTokenGenerationResponse | undefined =
        await postRemote<GODataTokenGenerationResponse>(
            rest,
            "api/users/login",
            {
                email: username,
                password,
            },
        );

    if (response) {
        const token = response.id;
        for (const p of inserts.person) {
            const epidemiology = inserts.epidemiology.find(
                (x) => x.visualId === p.visualId,
            );
            let questionnaireAnswers = inserts.questionnaire.find(
                (x) => x.visualId === p.visualId,
            );

            if (questionnaireAnswers) {
                const { visualId, ...rest } = questionnaireAnswers;
                questionnaireAnswers = fromPairs(
                    Object.entries(rest).map(([key, value]) => [
                        key,
                        [{ value }],
                    ]),
                );
            } else {
                questionnaireAnswers = {};
            }

            new Map([["auth", { param: "access_token", value: token }]]);

            if (epidemiology) {
                setMessage(`Creating person with id ${p.visualId}`);
                try {
                    const response = await postRemote<any>(
                        {
                            ...rest,
                        },
                        `api/outbreaks/${goData.id}/cases`,
                        {
                            ...p,
                            ...epidemiology,
                            questionnaireAnswers: questionnaireAnswers,
                        },
                        new Map([
                            ["auth", { param: "access_token", value: token }],
                        ]),
                    );
                    onFinish({ inserts: response });
                    const { id } = response;
                    prev = prev.set(p.visualId, id);
                } catch (error) {
                    if (error?.response?.data?.error) {
                        onFinish({
                            errors: [
                                {
                                    ...error?.response?.data?.error,
                                    id: p.visualId,
                                },
                            ],
                        });
                    }
                }
            }
        }

        for (const p of updates.person) {
            const epidemiology1 = inserts.epidemiology.find(
                (x) => x.visualId === p.visualId,
            );
            const epidemiology2 = updates.epidemiology.find(
                (x) => x.visualId === p.visualId,
            );

            const q1 = inserts.questionnaire.find(
                (x) => x.visualId === p.visualId,
            );
            const q2 = updates.questionnaire.find(
                (x) => x.visualId === p.visualId,
            );
            let epidemiology = {};
            let questionnaireAnswers = {};

            if (epidemiology1) {
                epidemiology = epidemiology1;
            } else if (epidemiology2) {
                epidemiology = epidemiology2;
            }
            if (q1) {
                const { visualId: v1, ...rest } = q1;
                questionnaireAnswers = fromPairs(
                    Object.entries(rest).map(([key, value]) => [
                        key,
                        [{ value }],
                    ]),
                );
            } else if (q2) {
                const { visualId: v1, ...rest } = q2;
                questionnaireAnswers = fromPairs(
                    Object.entries(rest).map(([key, value]) => [
                        key,
                        [{ value }],
                    ]),
                );
            }
            setMessage(`Updating person with id ${p.visualId}`);
            try {
                const response3 = await putRemote<any>(
                    {
                        ...rest,
                    },
                    `api/outbreaks/${goData.id}/cases/${p.id}`,
                    { ...p, ...epidemiology, questionnaireAnswers },
                    new Map([
                        [
                            "auth",
                            {
                                param: "access_token",
                                value: token,
                            },
                        ],
                    ]),
                );
                onFinish({ updates: response3 });
            } catch (error) {
                if (error?.response?.data?.error) {
                    onFinish({
                        errors: [
                            {
                                ...error?.response?.data?.error,
                                id: p.visualId,
                            },
                        ],
                    });
                }
            }
        }

        for (const l of inserts.lab) {
            const id = prev[l.visualId];
            if (id) {
                setMessage(
                    `Creating lab result for peron with id ${l.visualId}`,
                );
                try {
                    const response2 = await postRemote(
                        { ...rest },
                        `api/outbreaks/${goData.id}/cases/${id}/lab-results`,
                        l,
                        new Map([
                            ["auth", { param: "access_token", value: token }],
                        ]),
                    );
                    onFinish({ inserts: [response2] });
                } catch (error) {
                    if (error?.response?.data?.error) {
                        onFinish({
                            errors: [
                                {
                                    ...error?.response?.data?.error,
                                    id: l.visualId,
                                },
                            ],
                        });
                    }
                }
            }
        }

        if (inserts.questionnaire.length > 0 && inserts.person.length === 0) {
            for (const q of inserts.questionnaire) {
                const id = prev.get(q.visualId);
                const { visualId, ...others } = q;
                const actual = Object.entries(others).map(([key, value]) => [
                    key,
                    [{ value }],
                ]);
                if (id) {
                    setMessage(
                        `Updating questionnaire  for person with id ${q.visualId}`,
                    );
                    try {
                        const response2 = await putRemote(
                            { ...rest },
                            `api/outbreaks/${goData.id}/cases/${id}`,
                            { questionnaireAnswers: fromPairs(actual) },
                            new Map([
                                [
                                    "auth",
                                    {
                                        param: "access_token",
                                        value: token,
                                    },
                                ],
                            ]),
                        );
                        onFinish({
                            updates: [response2],
                        });
                    } catch (error) {
                        if (error?.response?.data?.error) {
                            onFinish({
                                errors: [
                                    {
                                        ...error?.response?.data?.error,
                                        id: q.visualId,
                                    },
                                ],
                            });
                        }
                    }
                }
            }
        }

        if (updates.questionnaire.length > 0 && updates.person.length === 0) {
            for (const q of updates.questionnaire) {
                const id = prev.get(q.visualId);
                const { visualId, ...others } = q;
                const actual = Object.entries(others).map(([key, value]) => [
                    key,
                    [{ value }],
                ]);
                if (id) {
                    setMessage(
                        `Updating questionnaire  for person with id ${q.visualId}`,
                    );
                    try {
                        const response2 = await putRemote(
                            { ...rest },
                            `api/outbreaks/${goData.id}/cases/${id}`,
                            { questionnaireAnswers: fromPairs(actual) },
                            new Map([
                                [
                                    "auth",
                                    {
                                        param: "access_token",
                                        value: token,
                                    },
                                ],
                            ]),
                        );
                        onFinish({
                            updates: [response2],
                        });
                    } catch (error) {
                        if (error?.response?.data?.error) {
                            onFinish({
                                errors: [
                                    {
                                        ...error?.response?.data?.error,
                                        id: q.visualId,
                                    },
                                ],
                            });
                        }
                    }
                }
            }
        }

        for (const l of updates.lab) {
            const id = prev.get(l.visualId);
            if (id) {
                setMessage(`Updating lab result for peron with id ${l.id}`);
                try {
                    const response2 = await putRemote(
                        { ...rest },
                        `api/outbreaks/${goData.id}/cases/${id}/lab-results/${l.id}`,
                        l,
                        new Map([
                            [
                                "auth",
                                {
                                    param: "access_token",
                                    value: token,
                                },
                            ],
                        ]),
                    );
                    onFinish({
                        updates: [response2],
                    });
                } catch (error) {
                    if (error?.response?.data?.error) {
                        onFinish({
                            errors: [
                                {
                                    ...error?.response?.data?.error,
                                    id: l.visualId,
                                },
                            ],
                        });
                    }
                }
            }
        }
    }
};

export const processLineList = ({
    data,
    mapping,
    flippedOrgUnits,
    flippedAttribution,
}: {
    data: any[];
    mapping: Partial<IMapping>;
    flippedOrgUnits: Map<string, string>;
    flippedAttribution: Map<string, string>;
}): { validData: Array<AggDataValue>; invalidData: any[] } => {
    const periodType = mapping.aggregate.periodType;
    const { orgUnitColumn } = mapping.orgUnitMapping;
    const {
        attributeOptionComboColumn,
        hasAttribution,
        attributionMerged,
        aggregate: {
            dataElementColumn,
            periodColumn,
            categoryOptionComboColumn,
            valueColumn,
        },
    } = mapping;

    let validData: AggDataValue[] = [];
    let invalidData: any[] = [];

    for (const a of data) {
        let aggValues: AggDataValue = {
            dataElement: a[dataElementColumn],
            period: a[periodColumn],
            orgUnit: flippedOrgUnits.get(a[orgUnitColumn]),
            categoryOptionCombo: a[categoryOptionComboColumn],
            value: a[valueColumn],
        };

        if (hasAttribution) {
            if (attributionMerged) {
                aggValues = {
                    ...aggValues,
                    attributeOptionCombo: flippedAttribution.get(
                        a[attributeOptionComboColumn],
                    ),
                };
            }
        }
        const { validData: val, invalidData: inv } = validateAggValue(
            aggValues,
            periodType,
        );

        if (val) {
            validData = [...validData, ...val];
        }
        if (inv) {
            invalidData = [...invalidData, ...inv];
        }
    }
    return { validData, invalidData };
};

export const processElements = ({
    mapping,
    dataMapping,
    data,
    flippedOrgUnits,
    flippedAttribution,
}: {
    data: any[];
    mapping: Partial<IMapping>;
    dataMapping: Mapping;
    flippedOrgUnits: Map<string, string>;
    flippedAttribution: Map<string, string>;
}): { validData: Array<AggDataValue>; invalidData: any[] } => {
    const { orgUnitColumn } = mapping.orgUnitMapping;
    const periodType = mapping.aggregate.periodType;
    const {
        attributeOptionComboColumn,
        attributionMerged,
        hasAttribution,
        aggregate: { periodColumn },
    } = mapping;

    let validData: AggDataValue[] = [];
    let invalidData: any[] = [];
    data.forEach((d) => {
        return Object.entries(dataMapping).forEach(([key, { source }]) => {
            const [dataElement, categoryOptionCombo] = key.split(",");
            let result: AggDataValue = {
                dataElement,
                categoryOptionCombo,
                value: d[source],
                orgUnit: flippedOrgUnits.get(d[orgUnitColumn]),
                period: d[periodColumn],
            };
            if (hasAttribution) {
                if (attributionMerged) {
                    result = {
                        ...result,
                        attributeOptionCombo: flippedAttribution.get(
                            d[attributeOptionComboColumn],
                        ),
                    };
                }
            }

            const { validData: val, invalidData: inv } = validateAggValue(
                result,
                periodType,
            );

            if (val) {
                validData = [...validData, ...val];
            }
            if (inv) {
                invalidData = [...invalidData, ...inv];
            }
        });
    });
    return { validData, invalidData };
};

export const processOther = () => {};

export const relativePeriods: { [key: string]: Option[] } = {
    DAILY: [
        { value: "TODAY", label: "Today" },
        { value: "YESTERDAY", label: "Yesterday" },
        { value: "LAST_3_DAYS", label: "Last 3 days" },
        { value: "LAST_7_DAYS", label: "Last 7 days" },
        { value: "LAST_14_DAYS", label: "Last 14 days" },
        { value: "LAST_30_DAYS", label: "Last 30 days" },
        { value: "LAST_60_DAYS", label: "Last 60 days" },
        { value: "LAST_90_DAYS", label: "Last 90 days" },
        { value: "LAST_180_DAYS", label: "Last 180 days" },
    ],
    WEEKLY: [
        { value: "THIS_WEEK", label: "This week" },
        { value: "LAST_WEEK", label: "Last week" },
        { value: "LAST_4_WEEKS", label: "Last 4 weeks" },
        { value: "LAST_12_WEEKS", label: "Last 12 weeks" },
        { value: "LAST_52_WEEKS", label: "Last 52 weeks" },
        { value: "WEEKS_THIS_YEAR", label: "Weeks this year" },
    ],
    BIWEEKLY: [
        { value: "THIS_BIWEEK", label: "This bi-week" },
        { value: "LAST_BIWEEK", label: "Last bi-week" },
        { value: "LAST_4_BIWEEKS", label: "Last 4 bi-weeks" },
    ],
    MONTHLY: [
        { value: "THIS_MONTH", label: "This month" },
        { value: "LAST_MONTH", label: "Last month" },
        { value: "LAST_3_MONTHS", label: "Last 3 months" },
        { value: "LAST_6_MONTHS", label: "Last 6 months" },
        { value: "LAST_12_MONTHS", label: "Last 12 months" },
        {
            value: "MONTHS_THIS_YEAR",
            label: "Months this year",
        },
    ],
    BIMONTHLY: [
        { value: "THIS_BIMONTH", label: "This bi-month" },
        { value: "LAST_BIMONTH", label: "Last bi-month" },
        {
            value: "LAST_6_BIMONTHS",
            label: "Last 6 bi-months",
        },
        {
            value: "BIMONTHS_THIS_YEAR",
            label: "Bi-months this year",
        },
    ],
    QUARTERLY: [
        { value: "THIS_QUARTER", label: "This quarter" },
        { value: "LAST_QUARTER", label: "Last quarter" },
        { value: "LAST_4_QUARTERS", label: "Last 4 quarters" },
        {
            value: "QUARTERS_THIS_YEAR",
            label: "Quarters this year",
        },
    ],
    SIXMONTHLY: [
        { value: "THIS_SIX_MONTH", label: "This six-month" },
        { value: "LAST_SIX_MONTH", label: "Last six-month" },
        {
            value: "LAST_2_SIXMONTHS",
            label: "Last 2 six-month",
        },
    ],
    FINANCIAL: [
        {
            value: "THIS_FINANCIAL_YEAR",
            label: "This financial year",
        },
        {
            value: "LAST_FINANCIAL_YEAR",
            label: "Last financial year",
        },
        {
            value: "LAST_5_FINANCIAL_YEARS",
            label: "Last 5 financial years",
        },
    ],
    YEARLY: [
        { value: "THIS_YEAR", label: "This year" },
        { value: "LAST_YEAR", label: "Last year" },
        { value: "LAST_5_YEARS", label: "Last 5 years" },
        { value: "LAST_10_YEARS", label: "Last 10 years" },
    ],
};
export const fixedPeriods = [
    "DAILY",
    "WEEKLY",
    "WEEKLYWED",
    "WEEKLYTHU",
    "WEEKLYSAT",
    "WEEKLYSUN",
    "BIWEEKLY",
    "MONTHLY",
    "BIMONTHLY",
    "QUARTERLY",
    "QUARTERLYNOV",
    "SIXMONTHLY",
    "SIXMONTHLYAPR",
    "SIXMONTHLYNOV",
    "YEARLY",
    "FYNOV",
    "FYOCT",
    "FYJUL",
    "FYAPR",
];

export const createOptions2 = (
    array: Array<string>,
    array2: Array<string>,
): Array<Option> => {
    return array.map((value, index) => {
        return { label: value, value: array2[index] };
    });
};

export type DisabledPeriod = 0 | 1 | 2;

export type PickerProps = {
    selectedPeriods: Period[];
    onChange: (periods: Period[], remove: boolean) => void;
    disabled?: DisabledPeriod[];
    active?: DisabledPeriod;
};

export const processDataSet = ({
    data,
    mapping,
    dataMapping,
    flippedOrgUnits,
    flippedAttribution,
}: {
    data: any[];
    mapping: Partial<IMapping>;
    dataMapping: Mapping;
    flippedOrgUnits: Map<string, string>;
    flippedAttribution: Map<string, string>;
}): { validData: Array<AggDataValue>; invalidData: any[] } => {
    const periodType = mapping.aggregate.periodType;
    const flippedMapping = makeFlipped(dataMapping);
    let validData: AggDataValue[] = [];
    let invalidData: any[] = [];

    data.forEach((d) => {
        const key = `${d["dataElement"]},${d["categoryOptionCombo"]}`;
        const mapping = flippedMapping[key];
        const orgUnit = flippedOrgUnits.get(d["orgUnit"]);
        const attributeOptionCombo = flippedAttribution.get(
            d["attributeOptionCombo"],
        );

        if (mapping && orgUnit) {
            const [dataElement, categoryOptionCombo] = mapping.split(",");
            const aggValues: AggDataValue = {
                dataElement,
                categoryOptionCombo,
                value: d["value"],
                orgUnit,
                period: d["period"],
                attributeOptionCombo,
            };
            const { validData: val, invalidData: inv } = validateAggValue(
                aggValues,
                periodType,
            );

            if (val) {
                validData = [...validData, ...val];
            }
            if (inv) {
                invalidData = [...invalidData, ...inv];
            }
        }
    });
    return { validData, invalidData };
};

export const processIndicators = ({
    mapping,
    dataMapping,
    data,
    flippedOrgUnits,
}: {
    data: any[];
    mapping: Partial<IMapping>;
    dataMapping: Mapping;
    flippedOrgUnits: Map<string, string>;
}): { validData: Array<AggDataValue>; invalidData: any[] } => {
    const periodType = mapping.aggregate.periodType;
    let validData: AggDataValue[] = [];
    let invalidData: any[] = [];
    data.forEach((d) => {
        return Object.entries(dataMapping).forEach(([key, { source }]) => {
            const orgUnit = flippedOrgUnits.get(d["ou"]);
            if (d["dx"] === source && orgUnit) {
                const [dataElement, categoryOptionCombo, attributeOptionCombo] =
                    key.split(",");

                let result: AggDataValue = {
                    dataElement,
                    categoryOptionCombo,
                    value: d["value"],
                    orgUnit,
                    period: d["pe"],
                };
                if (attributeOptionCombo) {
                    result = { ...result, attributeOptionCombo };
                }
                const { validData: val, invalidData: inv } = validateAggValue(
                    result,
                    periodType,
                );
                if (val) {
                    validData = [...validData, ...val];
                }
                if (inv) {
                    invalidData = [...invalidData, ...inv];
                }
            }
        });
    });
    return { validData, invalidData };
};

export const validateValue = ({
    option,
    mapping,
    data,
    flippedOptions,
    field,
    uniqueKey,
}: {
    option: Option;
    mapping: Partial<RealMapping>;
    data: any;
    flippedOptions: Map<string, string>;
    field: string;
    uniqueKey: string;
}): Partial<{
    errors: any[];
    conflicts: any[];
    success: boolean;
    value: any;
}> => {
    const validation = ValueType[option.valueType];
    let value = getOr("", mapping.source, data);
    if (mapping.isSpecific) {
        value = mapping.source;
    }
    if (mapping.isCustom) {
        if (mapping.customType === "join columns") {
            value = mapping.source
                .split(",")
                .map((col) => getOr("", col, data))
                .join(" ");
        } else if (mapping.customType === "extract year") {
            value = dayjs(value, "YYYY-MM-DD").format("YYYY");
        }
    }
    if (option.optionSetValue) {
        value = flippedOptions.get(value) || value;
        if (
            option.availableOptions.findIndex(
                (v: Option) =>
                    v.code === value || v.id === value || v.value === value,
            ) !== -1
        ) {
            return { success: true, value, errors: [], conflicts: [] };
        } else {
            if (mapping.mandatory) {
                return {
                    success: false,
                    errors: [
                        {
                            id: generateUid(),
                            value,
                            field,
                            uniqueKey,
                            valueType: option.valueType,
                            attribute: option.value,
                            message: `Expected values (${option.availableOptions
                                .map(({ value }) => value)
                                .join(",")})`,
                        },
                    ],
                    conflicts: [],
                };
            }
            if (value) {
                return {
                    success: false,
                    conflicts: [
                        {
                            id: generateUid(),
                            value,
                            field,
                            uniqueKey,
                            valueType: option.valueType,
                            attribute: option.value,
                            message: `Expected values (${option.availableOptions
                                .map(({ value }) => value)
                                .join(",")})`,
                        },
                    ],
                    errors: [],
                };
            }
        }
    }
    if (validation && value) {
        try {
            validation.parse(value);
            if (option.valueType === "DATE") {
                return {
                    success: true,
                    value: String(value).slice(0, 10),
                };
            }

            if (option.valueType === "DATETIME") {
                return {
                    success: true,
                    value: String(value).replace("Z", ""),
                    errors: [],
                    conflicts: [],
                };
            }
            if (
                option.valueType === "BOOLEAN" &&
                ["true", "1", "yes", "ok"].includes(
                    String(value).toLowerCase().trim(),
                )
            ) {
                return {
                    success: true,
                    value: "true",
                    errors: [],
                    conflicts: [],
                };
            }

            if (
                option.valueType === "BOOLEAN" &&
                ["false", "0", "no"].includes(
                    String(value).toLowerCase().trim(),
                )
            ) {
                return {
                    success: true,
                    value: "false",
                    errors: [],
                    conflicts: [],
                };
            }

            if (
                option.valueType === "TRUE_ONLY" &&
                ["true", "1", "yes", "ok"].includes(
                    String(value).toLowerCase().trim(),
                )
            ) {
                return {
                    success: true,
                    value: "true",
                    errors: [],
                    conflicts: [],
                };
            }
            return { success: true, value, errors: [], conflicts: [] };
        } catch (error) {
            const { issues } = error;
            if (mapping.mandatory) {
                return {
                    success: false,
                    errors: issues.map((i: any) => ({
                        ...i,
                        value,
                        field,
                        uniqueKey,
                        valueType: mapping.valueType,
                        id: generateUid(),
                    })),
                    conflicts: [],
                };
            }
            if (value) {
                return {
                    success: false,
                    conflicts: issues.map((i: any) => ({
                        ...i,
                        value,
                        field,
                        uniqueKey,
                        valueType: mapping.valueType,
                        id: generateUid(),
                    })),
                    errors: [],
                };
            }
        }
    }
    if (mapping.mandatory) {
        return {
            success: false,
            errors: [
                {
                    id: generateUid(),
                    value,
                    field,
                    uniqueKey,
                    valueType: option.valueType,
                    attribute: field,
                    message:
                        "Attribute is mandatory but not no value was provided",
                },
            ],
            conflicts: [],
        };
    }

    return { success: false, conflicts: [], errors: [] };
};

export const processAttributes = ({
    attributeMapping,
    attributes,
    flippedOptions,
    data,
    uniqueKey,
    createEnrollments,
    createEntities,
    updateEnrollments,
    updateEntities,
}: {
    attributeMapping: Mapping;
    attributes: Option[];
    flippedOptions: Map<string, string>;
    data: any;
    uniqueKey: string;
    updateEnrollments: boolean;
    createEnrollments: boolean;
    createEntities: boolean;
    updateEntities: boolean;
}) => {
    let source: { [key: string]: any } = {};
    let conflicts: any[] = [];
    let errors: any[] = [];
    attributes.forEach((currentAttribute) => {
        const aMapping = attributeMapping.get(currentAttribute.value);
        if (aMapping && aMapping.source) {
            const {
                success,
                conflicts: cs,
                errors: es,
                value,
            } = validateValue({
                data,
                option: currentAttribute,
                field: currentAttribute.value,
                mapping: aMapping,
                flippedOptions,
                uniqueKey,
            });
            if (success) {
                source = {
                    ...source,
                    [currentAttribute.value]: value,
                };
            } else {
                conflicts = conflicts.concat(cs);
                errors = errors.concat(es);
            }
        } else if (
            currentAttribute.mandatory &&
            (createEnrollments ||
                createEntities ||
                updateEnrollments ||
                updateEntities)
        ) {
            errors = errors.concat([
                {
                    id: generateUid(),
                    value: "",
                    field: currentAttribute.value,
                    uniqueKey,
                    valueType: currentAttribute.valueType,
                    attribute: currentAttribute.value,
                    message: "Attribute is mandatory but not mapped",
                },
            ]);
        }
    });

    return { source, conflicts, errors };
};

export const getGeometry = ({
    data,
    featureType,
    geometryColumn,
}: {
    featureType: string;
    geometryColumn: string;
    data: any;
}) => {
    if (geometryColumn && featureType === "POINT") {
        const point = getOr("", geometryColumn, data);
        if (point && isArray(point)) {
            return {
                type: "Point",
                coordinates: point,
            };
        }
    }
    return {};
};

export const makeEvent = ({
    eventDateColumn,
    data,
    featureType,
    geometryColumn,
    eventIdColumn,
    elements,
    programStage,
    enrollment,
    trackedEntityInstance,
    program,
    orgUnit,
    options,
    dataElements,
    uniqueKey,
    registration,
    dueDateColumn,
    attributionValue,
    hasAttribution,
}: {
    eventDateColumn: string;
    data: any;
    featureType: string;
    geometryColumn: string;
    eventIdColumn: string;
    elements: Map<string, Partial<RealMapping>>;
    programStage: string;
    enrollment?: IEnrollment;
    trackedEntityInstance?: string;
    program: string;
    orgUnit: string;
    options: Map<string, string>;
    dataElements: Dictionary<Option>;
    uniqueKey: string;
    registration: boolean;
    hasAttribution: boolean;
    attributionValue: string;
    dueDateColumn?: string;
}): Partial<{
    errors: any[];
    conflicts: any[];
    event: PartialEvent;
}> => {
    const possibleEventDate = dayjs(getOr("", eventDateColumn, data));
    const possibleDueDate = dayjs(getOr("", dueDateColumn, data));
    let dataValues = {};
    let conflicts: any[] = [];
    let errors: any[] = [];
    let dueDate = "";
    if (possibleDueDate.isValid()) {
        dueDate = possibleDueDate.format("YYYY-MM-DD");
    }
    if (possibleEventDate.isValid()) {
        const eventDate = possibleEventDate.format("YYYY-MM-DD");
        let eventGeometry = getGeometry({
            data,
            featureType,
            geometryColumn,
        });
        const eventId = getOr(generateUid(), eventIdColumn, data);
        elements.forEach((eMapping, dataElement) => {
            console.log("Are we here finally");
            const currentDataElement = dataElements[dataElement];
            const {
                value,
                errors: errs,
                conflicts: conf,
            } = validateValue({
                data,
                option: currentDataElement,
                field: dataElement,
                mapping: eMapping,
                flippedOptions: options,
                uniqueKey,
            });
            if (value) {
                dataValues = {
                    ...dataValues,
                    [dataElement]: value,
                };
            } else {
                conflicts = conflicts.concat(
                    conf.map((a) => ({
                        ...a,
                        trackedEntityInstance,
                        id: `${a.id}${trackedEntityInstance}${uniqueKey}`,
                    })),
                );
                errors = errors.concat(
                    errs.map((a) => ({
                        ...a,
                        trackedEntityInstance,
                        id: `${a.id}${trackedEntityInstance}${uniqueKey}`,
                    })),
                );
            }
        });
        let event: PartialEvent = {
            eventDate,
            programStage,
            program,
            orgUnit,
            event: eventId,
            dataValues,
        };

        if (dueDate) {
            event = { ...event, dueDate };
        }

        if (!isEmpty(eventGeometry)) {
            event = { ...event, geometry: eventGeometry };
        }

        if (hasAttribution) {
            if (attributionValue && !registration && orgUnit) {
                return {
                    event: { ...event, attributeOptionCombo: attributionValue },
                    errors,
                    conflicts,
                };
            } else if (
                attributionValue &&
                registration &&
                enrollment &&
                trackedEntityInstance
            ) {
                return {
                    event: {
                        ...event,
                        enrollment: enrollment.enrollment,
                        trackedEntityInstance,
                        attributeOptionCombo: attributionValue,
                    },
                    errors,
                    conflicts,
                };
            } else {
                return {
                    errors: [
                        {
                            id: generateUid(),
                            field: "attribution",
                            valueType: "attribution",
                            message: `Attribution value is missing`,
                            uniqueKey,
                        },
                    ],
                    conflicts,
                };
            }
        } else if (!registration && orgUnit) {
            return { event, errors, conflicts };
        } else if (registration && enrollment && trackedEntityInstance) {
            return {
                event: {
                    ...event,
                    enrollment: enrollment.enrollment,
                    trackedEntityInstance,
                },
                errors,
                conflicts,
            };
        }

        return {
            errors: [
                {
                    id: generateUid(),
                    value: possibleEventDate,
                    field: "enrollment/tracked entity instance",
                    valueType: "enrollment",
                    message: `enrollment/tracked entity instance is missing`,
                    uniqueKey,
                },
            ],
            conflicts,
        };
    }
    return {
        errors: [
            {
                id: generateUid(),
                value: possibleEventDate,
                field: "eventDate",
                valueType: "DATE",
                message: `Event Date is missing`,
                uniqueKey,
            },
        ],
        conflicts: [],
    };
};

export const getConflicts = (error: DHIS2Response) => {
    const {
        imported = 0,
        updated = 0,
        deleted = 0,
        ignored = 0,
        importSummaries = [],
        total = 0,
    } = error?.response ?? {};
    const conflicts = importSummaries.flatMap(({ conflicts }) => conflicts);
    const failed = importSummaries.flatMap(
        ({ conflicts, reference, status }) => {
            if (conflicts.length === 0 || status === "ERROR") {
                return reference;
            }
            return [];
        },
    );
    return {
        conflicts,
        imported,
        updated,
        deleted,
        total,
        ignored,
        failed,
    };
};

export const processInstances = async (
    {
        trackedEntityInstances,
        mapping,
        attributeMapping,
        api,
        version,
        program,
        optionMapping,
        organisationUnitMapping,
        programStageMapping,
        enrollmentMapping,
        attributionMapping,
        setMessage,
    }: {
        attributeMapping: Mapping;
        attributionMapping: Mapping;
        mapping: Partial<IMapping>;
        trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
        api: Partial<{ engine: any; axios: AxiosInstance }>;
        version: number;
        program: Partial<IProgram>;
        optionMapping: Map<string, string>;
        organisationUnitMapping: Mapping;
        programStageMapping: StageMapping;
        enrollmentMapping: Mapping;
        setMessage: (message: string) => void;
    },
    callback: (processedData: Processed) => void,
) => {
    let stages: string[] = [];
    const programUniqAttributes = getProgramUniqAttributes(attributeMapping);
    const programStageUniqueElements = getProgramStageUniqColumns(
        mapping.eventStageMapping,
        programStageMapping,
    );

    if (
        mapping.program?.program === mapping.program?.remoteProgram &&
        mapping.dataSource === "dhis2-program" &&
        mapping.isCurrentInstance
    ) {
        stages = Object.keys(programStageMapping);
    }

    const currentData = flattenEntitiesByEvents(trackedEntityInstances);
    let instances: Array<Partial<TrackedEntityInstance>> = [];

    let uniqueAttributeValues: any[] = [];
    let trackedInstanceIds: string[] = [];

    if (
        mapping.program?.program === mapping.program?.remoteProgram &&
        mapping.dataSource === "dhis2-program" &&
        mapping.isCurrentInstance
    ) {
        instances = trackedEntityInstances;
        trackedInstanceIds = trackedEntityInstances.flatMap(
            ({ trackedEntityInstance }) => {
                if (trackedEntityInstance) return trackedEntityInstance;
                return [];
            },
        );
    } else {
        const { trackedEntityInstanceColumn } =
            mapping.trackedEntityMapping ?? { trackedEntityInstanceColumn: "" };
        if (trackedEntityInstanceColumn) {
            trackedInstanceIds = trackedEntityInstances.flatMap(
                ({ trackedEntityInstance }) => {
                    if (trackedEntityInstance) return trackedEntityInstance;
                    return [];
                },
            );
        } else {
            uniqueAttributeValues = findUniqAttributes(
                currentData,
                attributeMapping,
            );
        }
        if (currentData.length > 0) {
            setMessage("Fetching previous data for tracked entity instances");
            const { trackedEntityInstances } =
                await fetchTrackedEntityInstances({
                    api,
                    program: mapping.program?.program,
                    additionalParams: {},
                    uniqueAttributeValues,
                    withAttributes: true,
                    trackedEntityInstances: trackedInstanceIds,
                    fields: "*",
                    pageSize: "50",
                    setMessage,
                });
            instances = trackedEntityInstances;
        }
    }

    const previous = processPreviousInstances({
        trackedEntityInstances: instances,
        programUniqAttributes,
        programStageUniqueElements,
        currentProgram: mapping.program?.program,
        programStageMapping,
        trackedEntityIdIdentifiesInstance: trackedInstanceIds.length > 0,
        eventStageMapping: mapping.eventStageMapping,
    });
    setMessage(`Converting data to destination DHIS2`);
    const convertedData = convertToDHIS2({
        previousData: previous,
        data: currentData,
        mapping: mapping,
        organisationUnitMapping,
        attributeMapping,
        programStageMapping,
        optionMapping,
        version,
        program,
        enrollmentMapping,
        attributionMapping,
    });
    callback({ ...emptyProcessedData, dhis2: convertedData });
};

export const validatePeriod = (period: string, periodType: string): boolean => {
    const periodTypes = {
        Daily: /^(\d{4})(\d{2})(\d{2})$/,
        Weekly: /^(\d{4})W(\d{1})$/,
        WeeklyWednesday: /^(\d{4})WedW(\d{1})$/,
        WeeklyThursday: /^(\d{4})ThuW(\d{1})$/,
        WeeklySaturday: /^(\d{4})SatW(\d{1})$/,
        WeeklySunday: /^(\d{4})SunW(\d{1})$/,
        BiWeekly: /^(\d{4})BiW(\d{2})$/,
        Monthly: /^(\d{4})(\d{2})$/,
        BiMonthly: /^(\d{4})(\d{2})B$/,
        Quarterly: /^(\d{4})Q(\d{1})$/,
        // QUARTERLYNOVEMBER: /^(\d{4})NovemberQ(\d{1})$/,
        SixMonthly: /^(\d{4})S(\d{1})$/,
        SixMonthlyApril: /^(\d{4})AprilS(\d{1})$/,
        // SIXMONTHLYNOV: /^(\d{4})NovemberS(\d{1})$/,
        Yearly: /^(\d{4})$/,
        FinancialNov: /^(\d{4})Nov$/,
        FinancialOct: /^(\d{4})Oct$/,
        FinancialJuly: /^(\d{4})Jul$/,
        FinancialApril: /^(\d{4})Apr$/,
    };
    return periodTypes[periodType]?.test(period);
};

export const validateAggValue = (
    aggValue: AggDataValue,
    periodType: string,
) => {
    let validData: AggDataValue[] = [];
    let invalidData: any[] = [];
    const {
        dataElement,
        period,
        orgUnit,
        value,
        categoryOptionCombo,
        attributeOptionCombo,
    } = aggValue;
    if (
        dataElement &&
        period &&
        orgUnit &&
        value &&
        validatePeriod(period, periodType)
    ) {
        validData = validData.concat({
            dataElement,
            period,
            orgUnit,
            categoryOptionCombo,
            value,
            attributeOptionCombo,
        });
    } else {
        if (!dataElement) {
            invalidData = [
                ...invalidData,
                { ...aggValue, error: "Data element is missing" },
            ];
        }
        if (!period) {
            invalidData = [
                ...invalidData,
                { ...aggValue, error: "Period is missing" },
            ];
        }
        if (!validatePeriod(period, periodType)) {
            invalidData = [
                ...invalidData,
                { ...aggValue, error: "Period is invalid" },
            ];
        }
        if (!orgUnit) {
            invalidData = [
                ...invalidData,
                { ...aggValue, error: "Organisation unit is missing" },
            ];
        }
        if (!value) {
            invalidData = [
                ...invalidData,
                { ...aggValue, error: "Value is missing" },
            ];
        }
    }
    return { validData, invalidData };
};

export function buildParameters(mapping: Partial<IMapping>) {
    let additionalParams: Record<string, string> = {};

    if (
        mapping.dhis2SourceOptions?.ous &&
        mapping.dhis2SourceOptions.ous.length > 0
    ) {
        additionalParams = {
            ...additionalParams,
            orgUnit: mapping.dhis2SourceOptions.ous[0],
        };
    }
    if (
        mapping.program.isTracker &&
        mapping.dhis2SourceOptions?.trackedEntityInstance
    ) {
        additionalParams = {
            ...additionalParams,
            trackedEntityInstance:
                mapping.dhis2SourceOptions.trackedEntityInstance,
        };
    }

    if (
        mapping.dhis2SourceOptions &&
        mapping.dhis2SourceOptions.period &&
        mapping.dhis2SourceOptions.period.length > 0 &&
        mapping.dhis2SourceOptions.period[0].startDate &&
        mapping.dhis2SourceOptions.period[0].endDate &&
        mapping.dhis2SourceOptions.searchPeriod === "enrollmentDate"
    ) {
        const programStartDate = mapping.dhis2SourceOptions.period[0].startDate;
        const programEndDate = mapping.dhis2SourceOptions.period[0].endDate;

        additionalParams = {
            ...additionalParams,
            programEndDate,
            programStartDate,
        };
    }

    return additionalParams;
}

export const isExcel = (mapping: Partial<IMapping>) => {
    return (
        [
            "csv-line-list",
            "xlsx-line-list",
            "xlsx-tabular-data",
            "xlsx-form",
        ].indexOf(mapping.dataSource) !== -1
    );
};

export const isDHIS2 = (mapping: Partial<IMapping>) => {
    return (
        [
            "dhis2-data-set",
            "dhis2-indicators",
            "dhis2-program-indicators",
            "dhis2-program",
            "manual-dhis2-program-indicators",
        ].indexOf(mapping.dataSource) !== -1
    );
};

export function cleanString(
    input: string,
    preserveSpaces: boolean = false,
): string {
    if (preserveSpaces) {
        return input.replace(/[^a-zA-Z0-9 ]/g, "");
    } else {
        return input.replace(/[^a-zA-Z0-9]/g, "");
    }
}

export const flipMapping = (mapping: Mapping, isOrgUnit: boolean = false) => {
    const flipped: Map<string, string> = new Map<string, string>();
    mapping.forEach((value, unit) => {
        if (isOrgUnit && value && value.source) {
            value.source.split(",").forEach((u) => {
                flipped.set(cleanString(u).toLowerCase(), unit);
            });
        } else if (value && value.source) {
            value.source.split(",").forEach((u) => {
                flipped.set(u, unit);
            });
        }
    });
    return flipped;
};

export const sortOptionsByMandatory = (options: Option[]) =>
    orderBy(options, ["mandatory", "unique", "label"], ["desc", "desc", "asc"]);

export const queryOrganisationUnits = async (
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
