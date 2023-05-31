import { groupBy, max } from "lodash/fp";
import { Authentication, IGoDataOrgUnit, Option, Param } from "./interfaces";
import { makeRemoteApi } from "./program";

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
        params: { ...authentication?.params, ...params },
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
