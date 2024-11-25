import { Authentication } from "./interfaces";
import { fetchRemote } from "./utils";

export const fetchApiData = async (authentication: Partial<Authentication>) => {
    const data = await fetchRemote<any>(authentication);
    return data;
};
