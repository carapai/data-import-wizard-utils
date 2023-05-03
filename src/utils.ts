import { Option } from "./interfaces";

export const createOptions = (options: string[]): Option[] => {
    return options.map((label) => {
        return { label, value: label };
    });
};
