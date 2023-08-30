import axios, { AxiosInstance } from "axios";
import { fromPairs, get, groupBy, isArray, isString, max } from "lodash/fp";
import {
    Authentication,
    GODataOption,
    GODataTokenGenerationResponse,
    IGoData,
    IGoDataOrgUnit,
    IProgramMapping,
    Mapping,
    Option,
    Param,
    StageMapping,
    Update,
} from "./interfaces";
import {
    Dictionary,
    difference,
    intersection,
    isEqual,
    isObject,
    transform,
} from "lodash";

export const makeRemoteApi = (
    authentication: Partial<Authentication> | undefined
) => {
    let params = new URLSearchParams();
    Object.values(authentication?.params || {}).forEach(({ param, value }) => {
        if (param && value) {
            params.append(param, value);
        }
    });
    if (
        authentication?.basicAuth &&
        authentication?.username &&
        authentication?.password
    ) {
        return axios.create({
            baseURL: authentication.url,
            auth: {
                username: authentication.username,
                password: authentication.password,
            },
            params,
        });
    }
    return axios.create({
        baseURL: authentication?.url || "",
        params,
    });
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
    programMapping: Partial<IProgramMapping>,
    goData: Partial<IGoData>,
    tokens: Dictionary<string>,
    token: string,
    remoteAPI: AxiosInstance
) => {
    if (programMapping.dataSource === "godata" && goData.id) {
        const data = await fetchRemote<any[]>(
            {
                ...programMapping.authentication,
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
            console.log(key, firstDest, firstSource);

            console.log(findDifference(firstDest, firstSource, attributes));
        } else if (isObject(destinationValue) && isObject(sourceValue)) {
        } else if (
            JSON.stringify(destinationValue) !== JSON.stringify(sourceValue)
        ) {
            current = { ...current, [key]: source[key] };
        }
    }

    return current;
}

export const getGoDataToken = async (
    programMapping: Partial<IProgramMapping>
) => {
    const {
        params,
        basicAuth,
        hasNextLink,
        headers,
        password,
        username,
        ...rest
    } = programMapping.authentication || {};

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

export const loadPreviousGoData = async (
    token: string,
    programMapping: Partial<IProgramMapping>,
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
    } = programMapping.authentication || {};

    if (!outbreak) {
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
            `api/outbreaks/${programMapping.remoteProgram}`
        );
    }

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

    return {
        tokens: actualTokens,
        organisations,
        outbreak,
        options: realGoDataOptions,
        goDataOptions,
    };
};
