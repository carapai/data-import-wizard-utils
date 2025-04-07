import { Dictionary } from "lodash";
import { CaseInvestigationTemplate, Option } from "./interfaces";

export const flattenGoData = (
    caseInvestigationTemplates: CaseInvestigationTemplate[],
    tokens: Map<string, string> = new Map(),
) => {
    return caseInvestigationTemplates.flatMap(
        ({
            variable,
            required,
            multiAnswer,
            answers,
            answerType,
            text,
        }): Option[] => {
            const original = tokens[text] || variable;
            if (
                answerType ===
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MULTIPLE_ANSWERS"
            ) {
                return answers.flatMap(
                    ({ additionalQuestions, value, order, alert, label }) => {
                        const currentLabel = tokens[label] || label;
                        const currentOpt = {
                            label: `${original} ${currentLabel}`,
                            value: `questionnaireAnswers.${value}[0].value`,
                            mandatory: false,
                            availableOptions: [],
                            optionSetValue: false,
                            parent: variable,
                        };
                        if (additionalQuestions) {
                            const additional = additionalQuestions.map(
                                ({ variable, text }) => {
                                    return {
                                        label: tokens[text] || variable,
                                        value: `questionnaireAnswers.${variable}[0].value`,
                                    };
                                },
                            );
                            return [currentOpt, ...additional];
                        }
                        return currentOpt;
                    },
                );
            } else {
                return [
                    {
                        label: tokens[text] || variable,
                        value: variable,
                        mandatory: required,
                        availableOptions: answers.map(({ value, label }) => ({
                            value: `questionnaireAnswers.${variable}[0].value`,
                            label: value,
                            name: value,
                            code: "",
                            id: value,
                        })),
                        optionSetValue: answers.length > 0,
                    },
                    ...answers.flatMap(({ additionalQuestions }) => {
                        if (additionalQuestions) {
                            return additionalQuestions.map(
                                ({ variable, text }) => {
                                    return {
                                        label: tokens[text] || variable,
                                        value: `questionnaireAnswers.${variable}[0].value`,
                                    };
                                },
                            );
                        }
                        return [];
                    }),
                ];
            }
        },
    );
};
