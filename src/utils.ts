import axios from "axios";
import { fromPairs, get, groupBy, max } from "lodash/fp";
import { Authentication, IGoDataOrgUnit, Option, Param } from "./interfaces";

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
