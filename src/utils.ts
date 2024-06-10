import axios, { AxiosInstance } from "axios";
import dayjs from "dayjs";
import { diff } from "jiff";
import {
    Dictionary,
    difference,
    intersection,
    isEmpty,
    isEqual,
    isObject,
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
import {
    AggDataValue,
    Authentication,
    DHIS2ProcessedData,
    DHIS2Response,
    GODataOption,
    GODataTokenGenerationResponse,
    GoDataOuTree,
    GoResponse,
    IGoData,
    IGoDataOrgUnit,
    IMapping,
    IProgram,
    Mapping,
    Option,
    Param,
    PartialEvent,
    Period,
    RealMapping,
    StageMapping,
    TrackedEntityInstance,
    Update,
    ValueType,
} from "./interfaces";
import {
    convertToDHIS2,
    fetchTrackedEntityInstances,
    findUniqAttributes,
    flattenTrackedEntityInstances,
    processPreviousInstances,
} from "./program";
import { generateUid } from "./uid";

export function modifyGoDataOu(
    node: GoDataOuTree,
    parent: { id: string; name: string }
) {
    if (!node.children || node.children.length === 0) {
        const { location } = node;
        return { title: location.name, value: location.id };
    }
    const modifiedChildren = node.children.map((chidNode) =>
        modifyGoDataOu(chidNode, node.location)
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
    parentInfo: Array<{ id: string; name: string }> = []
): Array<{
    id: string;
    name: string;
    parentInfo: Array<{ id: string; name: string }>;
}> {
    if (!node.children || node.children.length === 0) {
        return [{ id: node.location.id, name: node.location.name, parentInfo }];
    }
    const childLeaves = node.children.flatMap((child) =>
        getLeavesWithParentInfo(child, [
            ...parentInfo,
            { name: node.location.name, id: node.location.id },
        ])
    );

    return childLeaves;
}

export const makeFlipped = (dataMapping: Mapping) => {
    return fromPairs(
        Object.entries(dataMapping).map(([option, { value }]) => {
            return [value, option];
        })
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
                    ({ param, value }) => [param, value]
                )
            ),
        });
    }

    if (!isEmpty(authentication) && authentication.url) {
        return axios.create({
            baseURL: authentication.url,
            params,
            headers: fromPairs(
                Object.values(authentication?.headers ?? {}).map(
                    ({ param, value }) => [param, value]
                )
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
            "/"
        );
        return { ...child, name };
    });
}

export const fetchRemote = async <IData>(
    authentication: Partial<Authentication> | undefined,
    url: string = "",
    params: { [key: string]: Param } = {}
) => {
    const api = makeRemoteApi({
        ...authentication,
        params: { ...(authentication?.params || {}), ...params },
    });
    const { data } = await api.get<IData>(url);
    return data;
};

export const postRemote = async <IData>(
    authentication: Partial<Authentication> | undefined,
    url: string = "",
    payload: Object,
    params: { [key: string]: Partial<Param> } = {}
) => {
    const api = makeRemoteApi({
        ...authentication,
        params: { ...(authentication?.params || {}), ...params },
    });
    const { data } = await api.post<IData>(url, payload);
    return data;
};

export const putRemote = async <IData>(
    authentication: Partial<Authentication> | undefined,
    url: string = "",
    payload: Object,
    params: { [key: string]: Partial<Param> } = {}
) => {
    const api = makeRemoteApi({
        ...authentication,
        params: { ...(authentication?.params || {}), ...params },
    });
    const { data } = await api.put<IData>(url, payload);
    return data;
};

export const compareArrays = <TData>(
    source: TData[],
    destination: TData[],
    key: keyof TData
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
    key: string
) => {
    const sources = source.map((val: TData) => [get(key, val), val]);
    let destinations = fromPairs<TData>(
        destination.map((val) => [get(key, val), val])
    );

    sources.forEach(([key, value]) => {
        destinations = { ...destinations, [key]: value };
    });
    return Object.values(destinations);
};

export const updateObject = (
    state: Mapping,
    { attribute, value, key }: Update
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
    tokenGenerationURL: string
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
    tokens: Dictionary<string>,
    token: string,
    remoteAPI: AxiosInstance
) => {
    if (mapping.dataSource === "go-data" && goData.id) {
        const data = await fetchRemote<any[]>(
            {
                ...mapping.authentication,
                params: {
                    auth: { param: "access_token", value: token },
                },
            },
            `api/outbreaks/${goData.id}/cases`
        );
        return data.map((d) => {
            const processed = Object.entries(d).map(([key, value]) => {
                if (isArray(value)) {
                    return [key, value.map((v) => tokens[v] || v)];
                }

                if (isString(value)) {
                    return [key, tokens[value] || value];
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
    base: { [key: string]: any }
) {
    function changes(
        object: { [key: string]: any },
        base: { [key: string]: any }
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
    attributes: Dictionary<Option>
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
            // console.log(key);
        }

        if (isArray(destinationValue) && isArray(sourceValue)) {
            const firstDest = destinationValue[0];
            const firstSource = sourceValue[0];
            // console.log(key, firstDest, firstSource);

            // console.log(findDifference(firstDest, firstSource, attributes));
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
        }
    );

    if (response) {
        return response.id;
    }
};

export const fetchGoDataHierarchy = async (
    authentication: Partial<Authentication>,
    locationIds: string[]
) => {
    const hierarchy = await fetchRemote<GoDataOuTree[]>(
        authentication,
        "api/locations/hierarchical"
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
    outbreak?: Partial<IGoData>
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
                params: {
                    auth: {
                        param: "access_token",
                        value: token,
                    },
                },
            },
            `api/outbreaks/${mapping.program.remoteProgram}`
        );
    }

    const reference = await fetchRemote<any>(
        {
            ...rest,
            params: {
                auth: { param: "access_token", value: token },
            },
        },
        "api/filter-mappings"
    );

    const tokens = await fetchRemote<{
        languageId: string;
        lastUpdateDate: string;
        tokens: Array<{ token: string; translation: string }>;
    }>(
        {
            ...rest,
            params: {
                auth: { param: "access_token", value: token },
            },
        },
        "api/languages/english_us/language-tokens"
    );

    const actualTokens = fromPairs(
        tokens.tokens.map(({ token, translation }) => [token, translation])
    );

    const organisations = await fetchRemote<IGoDataOrgUnit[]>(
        {
            ...rest,
            params: {
                auth: { param: "access_token", value: token },
            },
        },
        "api/locations"
    );

    const goDataOptions = await fetchRemote<GODataOption[]>(
        {
            ...rest,
            params: { auth: { param: "access_token", value: token } },
        },
        "api/reference-data"
    );

    const realGoDataOptions = goDataOptions.map(({ id }) => {
        return { label: actualTokens[id] || id, value: id };
    });

    const hierarchy = await fetchGoDataHierarchy(
        {
            ...rest,
            params: { auth: { param: "access_token", value: token } },
        },
        outbreak.locationIds
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
                    (d: any) => keys.map((k) => d[k]).join("") === sourceValue
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
    uniqAttributes: string[],
    uniqColumns: string[]
) => {
    let errors: any[] = [];
    let conflicts: any[] = [];
    const uniqValues = uniqColumns
        .map((value) => getOr("", value, instanceData))
        .join("");
    let results: { [key: string]: any } = {};
    fields.forEach(
        ({ value: val, optionSetValue, availableOptions, valueType }) => {
            const mapping = attributeMapping[val];
            if (mapping) {
                const validation = ValueType[mapping.valueType];
                let value = getOr("", mapping.value, instanceData);
                if (mapping.isSpecific) {
                    value = mapping.value;
                } else if (value && valueType === "INTEGER") {
                    value = parseInt(value, 10);
                } else if (valueType === "DATE" && value) {
                    value = value.slice(0, 10);
                }
                let result: any = { success: true };
                if (optionSetValue) {
                    value = flippedOptions[value] || value;
                    if (
                        availableOptions.findIndex(
                            (v: Option) =>
                                v.code === value ||
                                v.id === value ||
                                v.value === value
                        ) !== -1
                    ) {
                        result = { ...result, success: true };
                    } else {
                        if (mapping.mandatory) {
                            errors = [
                                ...errors,
                                {
                                    id: Date.now() + Math.random(),
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
                                    id: Date.now() + Math.random(),
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
                } else if (validation) {
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
                                    [uniqAttributes.join("")]: uniqValues,
                                    id: Date.now() + Math.random(),
                                })),
                            ];
                        } else if (value) {
                            conflicts = [
                                ...conflicts,
                                ...issues.map((i: any) => ({
                                    ...i,
                                    value,
                                    attribute: val,
                                    valueType: mapping.valueType,
                                    [uniqAttributes.join("")]: uniqValues,
                                    id: Date.now() + Math.random(),
                                })),
                            ];
                        }
                    }
                }
                if (value && result.success) {
                    if (mapping.isOrgUnit && flippedUnits[value]) {
                        results = set(val, flippedUnits[value], results);
                    } else {
                        results = set(val, value, results);
                    }
                }
            }
        }
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
    attribute: string
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
                path !== `/addresses/0`
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
    prev: Dictionary<string>,
    authentication: Partial<Authentication>,
    setMessage: React.Dispatch<React.SetStateAction<string>>,
    setInserted: React.Dispatch<React.SetStateAction<any[]>>,
    setUpdates: React.Dispatch<React.SetStateAction<any[]>>,
    setErrors: React.Dispatch<React.SetStateAction<any[]>>
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
    setMessage(() => "Getting auth token");
    let response: GODataTokenGenerationResponse | undefined = undefined;
    try {
        response = await postRemote<GODataTokenGenerationResponse>(
            rest,
            "api/users/login",
            {
                email: username,
                password,
            }
        );
    } catch (error) {}
    if (response) {
        const token = response.id;
        for (const p of inserts.person) {
            const epidemiology = inserts.epidemiology.find(
                (x) => x.visualId === p.visualId
            );
            let questionnaireAnswers = inserts.questionnaire.find(
                (x) => x.visualId === p.visualId
            );

            if (questionnaireAnswers) {
                const { visualId, ...rest } = questionnaireAnswers;
                questionnaireAnswers = fromPairs(
                    Object.entries(rest).map(([key, value]) => [
                        key,
                        [{ value }],
                    ])
                );
            } else {
                questionnaireAnswers = {};
            }

            if (epidemiology) {
                setMessage(() => `Creating person with id ${p.visualId}`);
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
                        {
                            auth: {
                                param: "access_token",
                                value: token,
                            },
                        }
                    );
                    setInserted((prev) => [...prev, response]);
                    const { id } = response;
                    prev = { ...prev, [p.visualId]: id };
                } catch (error) {
                    if (error?.response?.data?.error) {
                        setErrors((prev) => [
                            ...prev,
                            { ...error?.response?.data?.error, id: p.visualId },
                        ]);
                    }
                }
            }
        }

        for (const p of updates.person) {
            const epidemiology1 = inserts.epidemiology.find(
                (x) => x.visualId === p.visualId
            );
            const epidemiology2 = updates.epidemiology.find(
                (x) => x.visualId === p.visualId
            );

            const q1 = inserts.questionnaire.find(
                (x) => x.visualId === p.visualId
            );
            const q2 = updates.questionnaire.find(
                (x) => x.visualId === p.visualId
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
                    ])
                );
            } else if (q2) {
                const { visualId: v1, ...rest } = q2;
                questionnaireAnswers = fromPairs(
                    Object.entries(rest).map(([key, value]) => [
                        key,
                        [{ value }],
                    ])
                );
            }
            setMessage(() => `Updating person with id ${p.visualId}`);
            try {
                const response3 = await putRemote<any>(
                    {
                        ...rest,
                    },
                    `api/outbreaks/${goData.id}/cases/${p.id}`,
                    { ...p, ...epidemiology, questionnaireAnswers },
                    {
                        auth: {
                            param: "access_token",
                            value: token,
                        },
                    }
                );
                setUpdates((prev) => [...prev, response3]);
            } catch (error) {
                if (error?.response?.data?.error) {
                    setErrors((prev) => [
                        ...prev,
                        { ...error?.response?.data?.error, id: p.visualId },
                    ]);
                }
            }
        }

        for (const l of inserts.lab) {
            const id = prev[l.visualId];
            if (id) {
                setMessage(
                    () => `Creating lab result for peron with id ${l.visualId}`
                );
                try {
                    const response2 = await postRemote(
                        { ...rest },
                        `api/outbreaks/${goData.id}/cases/${id}/lab-results`,
                        l,
                        {
                            auth: {
                                param: "access_token",
                                value: token,
                            },
                        }
                    );
                    setInserted((prev) => [...prev, response2]);
                } catch (error) {
                    if (error?.response?.data?.error) {
                        setErrors((prev) => [
                            ...prev,
                            { ...error?.response?.data?.error, id: l.visualId },
                        ]);
                    }
                }
            }
        }

        if (inserts.questionnaire.length > 0 && inserts.person.length === 0) {
            for (const q of inserts.questionnaire) {
                const id = prev[q.visualId];
                const { visualId, ...others } = q;
                const actual = Object.entries(others).map(([key, value]) => [
                    key,
                    [{ value }],
                ]);
                if (id) {
                    setMessage(
                        () =>
                            `Updating questionnaire  for person with id ${q.visualId}`
                    );
                    try {
                        const response2 = await putRemote(
                            { ...rest },
                            `api/outbreaks/${goData.id}/cases/${id}`,
                            { questionnaireAnswers: fromPairs(actual) },
                            {
                                auth: {
                                    param: "access_token",
                                    value: token,
                                },
                            }
                        );
                        setUpdates((prev) => [...prev, response2]);
                    } catch (error) {
                        if (error?.response?.data?.error) {
                            setErrors((prev) => [
                                ...prev,
                                {
                                    ...error?.response?.data?.error,
                                    id: q.visualId,
                                },
                            ]);
                        }
                    }
                }
            }
        }

        if (updates.questionnaire.length > 0 && updates.person.length === 0) {
            for (const q of updates.questionnaire) {
                const id = prev[q.visualId];
                const { visualId, ...others } = q;
                const actual = Object.entries(others).map(([key, value]) => [
                    key,
                    [{ value }],
                ]);
                if (id) {
                    setMessage(
                        () =>
                            `Updating questionnaire  for person with id ${q.visualId}`
                    );
                    try {
                        const response2 = await putRemote(
                            { ...rest },
                            `api/outbreaks/${goData.id}/cases/${id}`,
                            { questionnaireAnswers: fromPairs(actual) },
                            {
                                auth: {
                                    param: "access_token",
                                    value: token,
                                },
                            }
                        );
                        setUpdates((prev) => [...prev, response2]);
                    } catch (error) {
                        if (error?.response?.data?.error) {
                            setErrors((prev) => [
                                ...prev,
                                {
                                    ...error?.response?.data?.error,
                                    id: q.visualId,
                                },
                            ]);
                        }
                    }
                }
            }
        }

        for (const l of updates.lab) {
            const id = prev[l.visualId];
            if (id) {
                setMessage(
                    () => `Updating lab result for peron with id ${l.id}`
                );
                try {
                    const response2 = await putRemote(
                        { ...rest },
                        `api/outbreaks/${goData.id}/cases/${id}/lab-results/${l.id}`,
                        l,
                        {
                            auth: {
                                param: "access_token",
                                value: token,
                            },
                        }
                    );
                    setUpdates((prev) => [...prev, response2]);
                } catch (error) {
                    if (error?.response?.data?.error) {
                        setErrors((prev) => [
                            ...prev,
                            { ...error?.response?.data?.error, id: l.visualId },
                        ]);
                    }
                }
            }
        }
    }
};

export const processLineList = ({
    data,
    mapping,
    attributionMapping,
    ouMapping,
}: {
    data: any[];
    mapping: Partial<IMapping>;
    attributionMapping: Mapping;
    ouMapping: Mapping;
}): Array<AggDataValue> => {
    const {
        orgUnitColumn,
        aggregate: {
            dataElementColumn,
            periodColumn,
            categoryOptionComboColumn,
            attributeOptionComboColumn,
            valueColumn,
        },
    } = mapping;

    return data.map((a) => ({
        dataElement: a[dataElementColumn],
        period: a[periodColumn],
        orgUnit: a[orgUnitColumn],
        categoryOptionCombo: a[categoryOptionComboColumn],
        attributeOptionCombo: a[attributeOptionComboColumn],
        value: a[valueColumn],
    }));
};

export const processElements = ({
    mapping,
    dataMapping,
    data,
    ouMapping,
    attributionMapping,
}: {
    data: any[];
    mapping: Partial<IMapping>;
    dataMapping: Mapping;
    ouMapping: Mapping;
    attributionMapping: Mapping;
}): Array<AggDataValue> => {
    const {
        orgUnitColumn,
        aggregate: {
            periodColumn,
            attributeOptionComboColumn,
            attributionMerged,
            hasAttribution,
        },
    } = mapping;
    const processed = data.flatMap((d) => {
        return Object.entries(dataMapping).map(([key, { value }]) => {
            const [dataElement, categoryOptionCombo] = key.split(",");
            let result: AggDataValue = {
                dataElement,
                categoryOptionCombo,
                value: d[value],
                orgUnit: d[orgUnitColumn],
                period: d[periodColumn],
            };
            if (hasAttribution) {
                if (attributionMerged) {
                    result = {
                        ...result,
                        attributeOptionCombo: d[attributeOptionComboColumn],
                    };
                }
            }
            return result;
        });
    });
    return processed;
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
    array2: Array<string>
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
    ouMapping,
    attributionMapping,
}: {
    data: any[];
    mapping: Partial<IMapping>;
    dataMapping: Mapping;
    ouMapping: Mapping;
    attributionMapping: Mapping;
}) => {
    const flippedUnits = makeFlipped(ouMapping);
    const flippedMapping = makeFlipped(dataMapping);
    const flippedAttribution = makeFlipped(attributionMapping);
    return data.flatMap((d) => {
        const key = `${d["dataElement"]},${d["categoryOptionCombo"]}`;
        const mapping = flippedMapping[key];
        const orgUnit = flippedUnits[d["orgUnit"]];
        const attributeOptionCombo =
            flippedAttribution[d["attributeOptionCombo"]];

        if (mapping && orgUnit && attributeOptionCombo) {
            const [dataElement, categoryOptionCombo] = mapping.split(",");
            return {
                dataElement,
                categoryOptionCombo,
                value: d["value"],
                orgUnit,
                attributeOptionCombo,
                period: d["period"],
            };
        }

        return [];
    });
};

export const processIndicators = ({
    mapping,
    dataMapping,
    data,
    ouMapping,
    attributionMapping,
}: {
    data: any[];
    mapping: Partial<IMapping>;
    dataMapping: Mapping;
    ouMapping: Mapping;
    attributionMapping: Mapping;
}): Array<AggDataValue> => {
    const flippedUnits = makeFlipped(ouMapping);
    const processed = data.flatMap((d) => {
        return Object.entries(dataMapping).flatMap(([key, { value }]) => {
            const orgUnit = flippedUnits[d["ou"]];
            if (d["dx"] === value && orgUnit) {
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
                return result;
            }
            return [];
        });
    });
    return processed;
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
    flippedOptions: Dictionary<string>;
    field: string;
    uniqueKey: string;
}): Partial<{
    errors: any[];
    conflicts: any[];
    success: boolean;
    value: any;
}> => {
    if (mapping.value) {
        const validation = ValueType[option.valueType];
        let value = getOr("", mapping.value, data);
        if (mapping.isSpecific) {
            value = mapping.value;
        }
        if (mapping.isCustom) {
            if (mapping.customType === "join columns") {
                value = mapping.value
                    .split(",")
                    .map((col) => getOr("", col, data))
                    .join(" ");
            } else if (mapping.customType === "extract year") {
                value = dayjs(value, "YYYY-MM-DD").format("YYYY");
            }
        }
        if (option.optionSetValue) {
            value = flippedOptions[value] || value;
            if (
                option.availableOptions.findIndex(
                    (v: Option) =>
                        v.code === value || v.id === value || v.value === value
                ) !== -1
            ) {
                return { success: true, value };
            } else {
                if (mapping.mandatory) {
                    return {
                        success: false,
                        errors: [
                            {
                                id: Date.now() + Math.random(),
                                value,
                                field,
                                uniqueKey,
                                valueType: option.valueType,
                                message: `Expected values (${option.availableOptions
                                    .map(({ value }) => value)
                                    .join(",")})`,
                            },
                        ],
                    };
                }
                if (value) {
                    return {
                        success: false,
                        conflicts: [
                            {
                                id: Date.now() + Math.random(),
                                value,
                                field,
                                uniqueKey,
                                valueType: option.valueType,
                                message: `Expected values (${option.availableOptions
                                    .map(({ value }) => value)
                                    .join(",")})`,
                            },
                        ],
                    };
                }
            }
        } else if (validation) {
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
                    };
                }
                return { success: true, value };
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
                            id: Date.now() + Math.random(),
                        })),
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
                            id: Date.now() + Math.random(),
                        })),
                    };
                }
            }
        } else if (value) {
            return { success: true, value };
        }
    }
    return { success: false, conflicts: [], errors: [] };
};

export const processAttributes = ({
    attributeMapping,
    attributes,
    flippedOptions,
    data,
    uniqueKey,
}: {
    attributeMapping: Mapping;
    attributes: Dictionary<Option>;
    flippedOptions: Dictionary<string>;
    data: any;
    uniqueKey: string;
}) => {
    let source: { [key: string]: any } = {};
    let conflicts: any[] = [];
    let errors: any[] = [];

    Object.entries(attributeMapping).forEach(([attribute, aMapping]) => {
        const currentAttribute = attributes[attribute];
        if (aMapping.value && currentAttribute) {
            const {
                success,
                conflicts: cs,
                errors: es,
                value,
            } = validateValue({
                data,
                option: currentAttribute,
                field: attribute,
                mapping: aMapping,
                flippedOptions,
                uniqueKey,
            });

            if (success) {
                source = { ...source, [attribute]: value };
            } else {
                conflicts = conflicts.concat(cs);
                errors = errors.concat(es);
            }
        }
    });

    return { source, conflicts, errors };
};

export const getGeometry = ({
    data,
    featureType,
    geometryMerged,
    geometryColumn,
    latitudeColumn,
    longitudeColumn,
}: {
    featureType: string;
    geometryMerged: boolean;
    geometryColumn: string;
    latitudeColumn: string;
    longitudeColumn: string;
    data: any;
}) => {
    if (featureType === "POINT" && geometryMerged && geometryColumn) {
        const point = getOr("", geometryColumn, data);

        if (point && isArray(point)) {
            return {
                type: "Point",
                coordinates: point,
            };
        }
    } else if (
        featureType === "POINT" &&
        !geometryMerged &&
        latitudeColumn &&
        longitudeColumn
    ) {
        const lat = getOr("", latitudeColumn, data);
        const lon = getOr("", longitudeColumn, data);

        if (lon && lat) {
            return {
                type: "Point",
                coordinates: [lat, lon],
            };
        }
    } else if (featureType === "POLYGON" && geometryColumn) {
    }
    return {};
};

export const makeEvent = ({
    eventDateColumn,
    data,
    featureType,
    geometryColumn,
    geometryMerged,
    latitudeColumn,
    longitudeColumn,
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
}: {
    eventDateColumn: string;
    data: any;
    featureType: string;
    geometryColumn: string;
    geometryMerged: boolean;
    latitudeColumn: string;
    longitudeColumn: string;
    eventIdColumn: string;
    elements: {
        [key: string]: Partial<RealMapping>;
    };
    programStage: string;
    enrollment: { enrollmentDate: string; enrollment: string };
    trackedEntityInstance: string;
    program: string;
    orgUnit: string;
    options: Dictionary<string>;
    dataElements: Dictionary<Option>;
    uniqueKey: string;
}): Partial<{
    errors: any[];
    conflicts: any[];
    event: PartialEvent;
}> => {
    const possibleEventDate = dayjs(getOr("", eventDateColumn, data));
    let dataValues = {};
    let conflicts: any[] = [];
    let errors: any[] = [];
    if (possibleEventDate.isValid()) {
        const eventDate = possibleEventDate.format("YYYY-MM-DD");
        let eventGeometry = getGeometry({
            data,
            featureType,
            geometryColumn,
            geometryMerged,
            latitudeColumn,
            longitudeColumn,
        });
        const eventId = getOr(generateUid(), eventIdColumn, data);
        Object.entries(elements).forEach(([dataElement, eMapping]) => {
            const currentDataElement = dataElements[dataElement];
            const validation = validateValue({
                data,
                option: currentDataElement,
                field: dataElement,
                mapping: eMapping,
                flippedOptions: options,
                uniqueKey,
            });
            if (validation.value) {
                dataValues = {
                    ...dataValues,
                    [dataElement]: validation.value,
                };
            } else {
                conflicts = conflicts.concat(validation.conflicts);
                errors = errors.concat(validation.errors);
            }
        });
        let event: PartialEvent = {
            eventDate,
            programStage,
            enrollment: enrollment.enrollment,
            trackedEntityInstance,
            program,
            orgUnit,
            event: eventId,
            dataValues,
        };
        if (!isEmpty(eventGeometry)) {
            event = { ...event, geometry: eventGeometry };
        }
        return { event, errors, conflicts };
    }
    return {
        errors: [
            {
                id: Date.now() + Math.random(),
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
        }
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
        programStageUniqueElements,
        programUniqAttributes,
        setMessage,
    }: {
        attributeMapping: Mapping;
        mapping: Partial<IMapping>;
        trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
        api: Partial<{ engine: any; axios: AxiosInstance }>;
        version: number;
        program: Partial<IProgram>;
        optionMapping: Record<string, string>;
        organisationUnitMapping: Mapping;
        programStageMapping: StageMapping;
        programStageUniqueElements: Dictionary<string[]>;
        programUniqAttributes: string[];
        setMessage: (message: string) => void;
    },
    callback: (processedData: DHIS2ProcessedData) => Promise<void>
) => {
    const currentData = flattenTrackedEntityInstances(
        {
            trackedEntityInstances,
        },
        "ALL"
    );
    let uniqueAttributeValues: any[] = [];
    let trackedInstanceIds: string[] = [];
    if (mapping.program?.trackedEntityInstanceColumn) {
        trackedInstanceIds = trackedEntityInstances
            .map(({ trackedEntityInstance }) => trackedEntityInstance ?? "")
            .filter((a) => a !== "");
    } else {
        uniqueAttributeValues = findUniqAttributes(
            currentData,
            attributeMapping
        );
    }

    if (currentData.length > 0) {
        setMessage(`Fetching data from destination program`);
        const instances = await fetchTrackedEntityInstances({
            api,
            program: mapping.program?.program,
            additionalParams: {},
            uniqueAttributeValues,
            withAttributes: true,
            trackedEntityInstances: trackedInstanceIds,
            fields: "*",
            pageSize: "50",
        });

        const previous = processPreviousInstances({
            trackedEntityInstances: instances.trackedEntityInstances,
            programUniqAttributes,
            programStageUniqueElements,
            currentProgram: mapping.program?.program,
            trackedEntityIdIdentifiesInstance: trackedInstanceIds.length > 0,
            programStageMapping,
        });

        const convertedData = await convertToDHIS2({
            previousData: previous,
            data: currentData,
            mapping: mapping,
            organisationUnitMapping,
            attributeMapping,
            programStageMapping,
            optionMapping,
            version,
            program,
        });
        callback(convertedData);
    }
};
