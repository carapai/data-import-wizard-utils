import { IGoData } from "./interfaces";

export const outbreak: Partial<IGoData> = {
    name: "Ebola and Marburg virus diseases Clone",
    description: "",
    disease: "LNG_REFERENCE_DATA_CATEGORY_DISEASE_EBOLA_VIRUS_DISEASE",
    countries: [
        {
            id: "LNG_REFERENCE_DATA_CATEGORY_COUNTRY_UGANDA",
        },
    ],
    locationIds: ["3e34fb30-0ce5-4dc6-9ed2-92ab7411effd"],
    startDate: "2022-01-01T00:00:00.000Z",
    longPeriodsBetweenCaseOnset: 12,
    periodOfFollowup: 21,
    frequencyOfFollowUp: 1,
    frequencyOfFollowUpPerDay: 1,
    generateFollowUpsOverwriteExisting: false,
    generateFollowUpsKeepTeamAssignment: true,
    generateFollowUpsTeamAssignmentAlgorithm:
        "LNG_REFERENCE_DATA_CATEGORY_FOLLOWUP_GENERATION_TEAM_ASSIGNMENT_ALGORITHM_ROUND_ROBIN_ALL_TEAMS",
    generateFollowUpsDateOfLastContact: false,
    // intervalOfFollowUp: "",
    noDaysAmongContacts: 1,
    noDaysInChains: 1,
    noDaysNotSeen: 3,
    noLessContacts: 5,
    noDaysNewContacts: 1,
    caseInvestigationTemplate: [
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_INFO_PROVIDED_BY_TEXT",
            variable: "Info_provided_by",
            category: "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_REPORTING",
            required: false,
            order: 0,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_INFO_PROVIDED_BY_ANSWER_PATIENT_LABEL",
                    value: "patient",
                    alert: false,
                    additionalQuestions: null,
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_INFO_PROVIDED_BY_ANSWER_PROXY_LABEL",
                    value: "proxy",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_INFO_PROVIDED_BY_ANSWER_PROXY_QUESTION_PROXY_NAME_TEXT",
                            variable: "proxy_name",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_REPORTING",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_INFO_PROVIDED_BY_ANSWER_PROXY_QUESTION_PROXY_RELATIONSHIP_TEXT",
                            variable: "proxy_relationship",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_REPORTING",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                    ],
                    order: 2,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_HH_NEXT_OF_KIN_TEXT",
            variable: "HH_Next_of_kin",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_PATIENT_INFORMATION",
            required: false,
            order: 1,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_BREASTFEEDING_WOMAN_TEXT",
            variable: "breastfeeding_woman",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_PATIENT_INFORMATION",
            required: false,
            order: 2,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_BREASTFEEDING_WOMAN_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: null,
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_BREASTFEEDING_WOMAN_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_BREASTFEEDING_WOMAN_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_TEXT",
            variable: "occupation_specify",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_PATIENT_INFORMATION",
            required: false,
            order: 3,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_ANSWER_BUSINESSMAN_WOMAN_LABEL",
                    value: "businessman-woman",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_ANSWER_BUSINESSMAN_WOMAN_QUESTION_BUSINESS_SPECIFY_TEXT",
                            variable: "business_specify",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_PATIENT_INFORMATION",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_ANSWER_TRANSPORTER_LABEL",
                    value: "transporter",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_ANSWER_TRANSPORTER_QUESTION_TRANSPORT_SPECIFY_TEXT",
                            variable: "transport_specify",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_PATIENT_INFORMATION",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_ANSWER_HCW_LABEL",
                    value: "hcw",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_ANSWER_HCW_QUESTION_POSITION_SPECIFY_TEXT",
                            variable: "position_specify",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_PATIENT_INFORMATION",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_ANSWER_HCW_QUESTION_HCF_NAME_TEXT",
                            variable: "hcf_name",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_PATIENT_INFORMATION",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 3,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_ANSWER_OTHER_LABEL",
                    value: "other",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OCCUPATION_SPECIFY_ANSWER_OTHER_QUESTION_OCCUPATION_OTHER_SPECIFY_TEXT",
                            variable: "occupation_other_specify",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_PATIENT_INFORMATION",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 4,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_TEXT",
            variable: "symp_onset-not",
            category: "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_CLINICAL",
            required: false,
            order: 4,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MULTIPLE_ANSWERS",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_FEVER_LABEL",
                    value: "fever",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_FEVER_QUESTION_FEVER_TEMP_TEXT",
                            variable: "fever_temp",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_CLINICAL",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_NUMERIC",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_FEVER_QUESTION_FEVER_SOURCE_TEXT",
                            variable: "fever_source",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_CLINICAL",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_FEVER_QUESTION_FEVER_SOURCE_ANSWER_AXILLARY_LABEL",
                                    value: "axillary",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_FEVER_QUESTION_FEVER_SOURCE_ANSWER_ORAL_LABEL",
                                    value: "oral",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_FEVER_QUESTION_FEVER_SOURCE_ANSWER_RECTAL_LABEL",
                                    value: "rectal",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                            ],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_VOMITING_NAUSEA_LABEL",
                    value: "vomiting-nausea",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_DIARRHEA_LABEL",
                    value: "diarrhea",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_INTENSE_FATIGUE_LABEL",
                    value: "intense_fatigue",
                    alert: false,
                    additionalQuestions: null,
                    order: 4,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_ANOREXIA_LABEL",
                    value: "anorexia ",
                    alert: false,
                    additionalQuestions: null,
                    order: 5,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_ABDOMINAL_PAIN_LABEL",
                    value: "abdominal_pain",
                    alert: false,
                    additionalQuestions: null,
                    order: 6,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_CHEST_PAIN_LABEL",
                    value: "chest_pain",
                    alert: false,
                    additionalQuestions: null,
                    order: 7,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_MUSCLE_PAIN_LABEL",
                    value: "muscle_pain",
                    alert: false,
                    additionalQuestions: null,
                    order: 8,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_JOINT_PAIN_LABEL",
                    value: "joint_pain",
                    alert: false,
                    additionalQuestions: null,
                    order: 9,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_HEADACHE_LABEL",
                    value: "headache",
                    alert: false,
                    additionalQuestions: null,
                    order: 10,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_COUGH_LABEL",
                    value: "cough",
                    alert: false,
                    additionalQuestions: null,
                    order: 11,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_DIFFICULTY_BREATHING_LABEL",
                    value: "difficulty_breathing",
                    alert: false,
                    additionalQuestions: null,
                    order: 12,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_DIFFICULTY_SWALLOWING_LABEL",
                    value: "difficulty_swallowing",
                    alert: false,
                    additionalQuestions: null,
                    order: 13,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_SORE_THROAT_LABEL",
                    value: "sore_throat",
                    alert: false,
                    additionalQuestions: null,
                    order: 14,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_JAUNDICE_LABEL",
                    value: "jaundice",
                    alert: false,
                    additionalQuestions: null,
                    order: 15,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_CONJUNCTIVITIS_LABEL",
                    value: "conjunctivitis ",
                    alert: false,
                    additionalQuestions: null,
                    order: 16,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_SKIN_RASH_LABEL",
                    value: "skin_rash",
                    alert: false,
                    additionalQuestions: null,
                    order: 17,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_HICCUPS_LABEL",
                    value: "hiccups",
                    alert: false,
                    additionalQuestions: null,
                    order: 18,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_PAIN_BEHIND_EYES_LABEL",
                    value: "pain_behind_eyes",
                    alert: false,
                    additionalQuestions: null,
                    order: 19,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_COMA_LABEL",
                    value: "coma",
                    alert: false,
                    additionalQuestions: null,
                    order: 20,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_CONFUSED_LABEL",
                    value: "confused ",
                    alert: false,
                    additionalQuestions: null,
                    order: 21,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_LABEL",
                    value: "unexplained_bleeding",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_TEXT",
                            variable: "bleeding_type",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_CLINICAL",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MULTIPLE_ANSWERS",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_BLEEDING_GUMS_LABEL",
                                    value: "bleeding_gums",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_BLEEDING_INJ_SITE_LABEL",
                                    value: "bleeding_inj_site",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_EPISTAXIS_LABEL",
                                    value: "epistaxis",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_MELENA_LABEL",
                                    value: "melena",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 4,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_HEMATEMESIS_LABEL",
                                    value: "hematemesis",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 5,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_DIGESTED_BLOOD_LABEL",
                                    value: "digested_blood",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 6,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_HEMOPTYSIS_LABEL",
                                    value: "hemoptysis",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 7,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_BLEEDING_FROM_VAGINA_LABEL",
                                    value: "bleeding_from_vagina",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 8,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_PETECHIAE_ECCHYMOSIS_LABEL",
                                    value: "petechiae-ecchymosis",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 9,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_HEMATURIA_LABEL",
                                    value: "hematuria",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 10,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_BLEEDING_SPECIFY_LABEL",
                                    value: "bleeding_specify",
                                    alert: false,
                                    additionalQuestions: [
                                        {
                                            multiAnswer: false,
                                            inactive: false,
                                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_UNEXPLAINED_BLEEDING_QUESTION_BLEEDING_TYPE_ANSWER_BLEEDING_SPECIFY_QUESTION_BLEEDING_SPECIFY_TEXT",
                                            variable: "bleeding_specify",
                                            category:
                                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_CLINICAL",
                                            required: false,
                                            order: 1,
                                            answerType:
                                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                                            answersDisplay:
                                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                                            answers: [],
                                        },
                                    ],
                                    order: 11,
                                },
                            ],
                        },
                    ],
                    order: 22,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_NON_HEMORRHAGIC_SYMP_LABEL",
                    value: "non-hemorrhagic_symp",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_SYMP_ONSET_NOT_ANSWER_NON_HEMORRHAGIC_SYMP_QUESTION_SYMP_NON_HEMORRHAGIC_SPECIFY_TEXT",
                            variable: "symp_non-hemorrhagic_specify",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 23,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_EVD_INFECTION_TEXT",
            variable: "expo_evd_infection",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
            required: false,
            order: 5,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_EVD_INFECTION_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: null,
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_EVD_INFECTION_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_EVD_INFECTION_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_8_D_97233_C_1_B_72_444_D_A_898_195_F_5_AF_6942_E_TEXT",
            variable: "8d97233c-1b72-444d-a898-195f5af6942e",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
            required: false,
            order: 6,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MARKUP",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_WITH_CASE_TEXT",
            variable: "expo_with_case",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
            required: false,
            order: 7,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_WITH_CASE_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_WITH_CASE_ANSWER_YES_QUESTION_BBF_835_E_0_AA_53_49_D_2_819_B_BF_27_CF_4_CA_70_E_CLONE_4_A_410577_4_A_1_C_4_FAB_8011_E_9_F_3_CB_59_AFF_4_TEXT",
                            variable:
                                "bbf835e0-aa53-49d2-819b-bf27cf4ca70e_clone_4a410577-4a1c-4fab-8011-e9f3cb59aff4",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MARKUP",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_WITH_CASE_ANSWER_YES_QUESTION_EXPO_DATE_OF_DEATH_TEXT",
                            variable: "expo_date_of_death",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_DATE_TIME",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_WITH_CASE_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_WITH_CASE_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: true,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_TEXT",
            variable: "expo_funerals",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
            required: false,
            order: 8,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_1_D_0_BA_2_F_8_90_AA_4_D_78_9_B_7_F_813_A_3_D_6233_D_0_CLONE_ABD_8_C_387_A_8_E_4_40_E_9_9_D_95_330_A_6863_FB_29_TEXT",
                            variable:
                                "1d0ba2f8-90aa-4d78-9b7f-813a3d6233d0_clone_abd8c387-a8e4-40e9-9d95-330a6863fb29",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MARKUP",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_EXPO_NAME_DECEASED_TEXT",
                            variable: "expo_name_deceased",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_EXPO_RELATIONSHIP_DECEASED_TEXT",
                            variable: "expo_relationship_deceased",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 3,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_EXPO_FUNERAL_DATE_TEXT",
                            variable: "expo_funeral_date",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 4,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_DATE_TIME",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_EXPO_FUNERAL_VILLAGE_TEXT",
                            variable: "expo_funeral_village",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 5,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_EXPO_FUNERAL_DISTRICT_TEXT",
                            variable: "expo_funeral_district",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 6,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_EXPO_TOUCH_DECEASED_TEXT",
                            variable: "expo_touch_deceased",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 7,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_EXPO_TOUCH_DECEASED_ANSWER_YES_LABEL",
                                    value: "yes",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_EXPO_TOUCH_DECEASED_ANSWER_NO_LABEL",
                                    value: "no",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_YES_QUESTION_EXPO_TOUCH_DECEASED_ANSWER_UNK_LABEL",
                                    value: "unk",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                            ],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_FUNERALS_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRAVEL_TEXT",
            variable: "expo_travel",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
            required: false,
            order: 9,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRAVEL_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRAVEL_ANSWER_YES_QUESTION_EXPO_TRAVEL_VILLAGE_TEXT",
                            variable: "expo_travel_village",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRAVEL_ANSWER_YES_QUESTION_EXPO_TRAVEL_DISTRICT_TEXT",
                            variable: "expo_travel_district",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRAVEL_ANSWER_YES_QUESTION_TRAVEL_START_DATE_TEXT",
                            variable: "travel_start_date",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 3,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_DATE_TIME",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRAVEL_ANSWER_YES_QUESTION_TRAVEL_END_DATE_TEXT",
                            variable: "travel_end_date",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 4,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_DATE_TIME",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRAVEL_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRAVEL_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRADITIONAL_HEALER_TEXT",
            variable: "expo_traditional_healer",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
            required: false,
            order: 10,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRADITIONAL_HEALER_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRADITIONAL_HEALER_ANSWER_YES_QUESTION_EXPO_NAME_HEALER_TEXT",
                            variable: "expo_name_healer",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRADITIONAL_HEALER_ANSWER_YES_QUESTION_EXPO_HEALER_VILLAGE_TEXT",
                            variable: "expo_healer_village",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRADITIONAL_HEALER_ANSWER_YES_QUESTION_EXPO_HEALER_DISTRICT_TEXT",
                            variable: "expo_healer_district",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 3,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRADITIONAL_HEALER_ANSWER_YES_QUESTION_EXPO_HEALER_DATE_TEXT",
                            variable: "expo_healer_date",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 4,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_DATE_TIME",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRADITIONAL_HEALER_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TRADITIONAL_HEALER_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_PRAYER_HOUSE_TEXT",
            variable: "expo_prayer_house",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
            required: false,
            order: 11,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_PRAYER_HOUSE_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_PRAYER_HOUSE_ANSWER_YES_QUESTION_EXPO_PASTOR_HOUSE_NAME_TEXT",
                            variable: "expo_pastor-house_name",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_PRAYER_HOUSE_ANSWER_YES_QUESTION_EXPO_PRAYER_HOUSE_VILLAGE_TEXT",
                            variable: "expo_prayer_house_village",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_PRAYER_HOUSE_ANSWER_YES_QUESTION_EXPO_PRAYER_HOUSE_DISTRICT_TEXT",
                            variable: "expo_prayer_house_district",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 3,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_PRAYER_HOUSE_ANSWER_YES_QUESTION_EXPO_PRAYER_HOUSE_DATE_TEXT",
                            variable: "expo_prayer_house_date",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 4,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_DATE_TIME",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_PRAYER_HOUSE_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_PRAYER_HOUSE_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_TEXT",
            variable: "expo_animals",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
            required: false,
            order: 12,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_FC_59_F_272_20_D_9_484_F_9610_DF_5_B_8_F_5_A_3_D_9_D_CLONE_05333_C_01_636_B_47_D_2_A_757_ABDF_9_B_6_A_76_F_8_CLONE_BD_17_FDE_8_43_D_0_49_C_3_8881_2_C_616_B_70_D_2_B_7_TEXT",
                            variable:
                                "fc59f272-20d9-484f-9610-df5b8f5a3d9d_clone_05333c01-636b-47d2-a757-abdf9b6a76f8_clone_bd17fde8-43d0-49c3-8881-2c616b70d2b7",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EXPOSURE_RISK",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MARKUP",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_BATS_TEXT",
                            variable: "expo_bats",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_BATS_ANSWER_NO_LABEL",
                                    value: "no",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_BATS_ANSWER_HEALTHY_LABEL",
                                    value: "healthy",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_BATS_ANSWER_SICK_DEAD_LABEL",
                                    value: "sick_dead",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                            ],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_MONKEYS_TEXT",
                            variable: "expo_monkeys",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 3,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_MONKEYS_ANSWER_NO_LABEL",
                                    value: "no",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_MONKEYS_ANSWER_HEALTHY_LABEL",
                                    value: "healthy",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_MONKEYS_ANSWER_SICK_DEAD_LABEL",
                                    value: "sick_dead",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                            ],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_RODENTS_TEXT",
                            variable: "expo_rodents",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 4,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_RODENTS_ANSWER_NO_LABEL",
                                    value: "no",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_RODENTS_ANSWER_HEALTHY_LABEL",
                                    value: "healthy",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_RODENTS_ANSWER_SICK_DEAD_LABEL",
                                    value: "sick_dead",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                            ],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_PIGS_TEXT",
                            variable: "expo_pigs",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 5,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_PIGS_ANSWER_NO_LABEL",
                                    value: "no",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_PIGS_ANSWER_HEALTHY_LABEL",
                                    value: "healthy",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_PIGS_ANSWER_SICK_DEAD_LABEL",
                                    value: "sick_dead",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                            ],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_POULTRY_TEXT",
                            variable: "expo_poultry",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 6,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_POULTRY_ANSWER_NO_LABEL",
                                    value: "no",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_POULTRY_ANSWER_HEALTHY_LABEL",
                                    value: "healthy",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_POULTRY_ANSWER_SICK_DEAD_LABEL",
                                    value: "sick_dead",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                            ],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_COWS_GOATS_SHEEP_TEXT",
                            variable: "expo_cows_goats_sheep",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 7,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_COWS_GOATS_SHEEP_ANSWER_NO_LABEL",
                                    value: "no",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_COWS_GOATS_SHEEP_ANSWER_HEALTHY_LABEL",
                                    value: "healthy",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_COWS_GOATS_SHEEP_ANSWER_SICK_DEAD_LABEL",
                                    value: "sick_dead",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                            ],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_ANIMALS_OTHER_TEXT",
                            variable: "expo_animals_other",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                            required: false,
                            order: 8,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_ANIMALS_OTHER_ANSWER_NO_LABEL",
                                    value: "no",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_ANIMALS_OTHER_ANSWER_HEALTHY_LABEL",
                                    value: "healthy",
                                    alert: false,
                                    additionalQuestions: [
                                        {
                                            multiAnswer: false,
                                            inactive: false,
                                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_ANIMALS_OTHER_ANSWER_HEALTHY_QUESTION_EXPO_ANIMAL_HLTY_SPECIFY_TEXT",
                                            variable:
                                                "expo_animal-hlty_specify",
                                            category:
                                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                                            required: false,
                                            order: 1,
                                            answerType:
                                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                                            answersDisplay:
                                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                                            answers: [],
                                        },
                                    ],
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_ANIMALS_OTHER_ANSWER_SICK_DEAD_LABEL",
                                    value: "sick_dead",
                                    alert: false,
                                    additionalQuestions: [
                                        {
                                            multiAnswer: false,
                                            inactive: false,
                                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_YES_QUESTION_EXPO_ANIMALS_OTHER_ANSWER_SICK_DEAD_QUESTION_EXPO_ANIMAL_SICK_SPECIFY_TEXT",
                                            variable:
                                                "expo_animal-sick_specify",
                                            category:
                                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
                                            required: false,
                                            order: 1,
                                            answerType:
                                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                                            answersDisplay:
                                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                                            answers: [],
                                        },
                                    ],
                                    order: 3,
                                },
                            ],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_ANIMALS_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TICK_TEXT",
            variable: "expo_tick",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_EPIDEMIOLOGY_AND_EXPOSURE",
            required: false,
            order: 13,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TICK_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: null,
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TICK_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_EXPO_TICK_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_19209960_FA_54_4609_B_5_B_8_912_F_8_FA_05_C_77_TEXT",
            variable: "19209960-fa54-4609-b5b8-912f8fa05c77",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 14,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MARKUP",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_REPORTING_DATE_TEXT",
            variable: "outcome_reporting_date",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 15,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_DATE_TIME",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_HORIZONTAL",
            answers: [],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_UNEXPLINED_BLEEDING_TEXT",
            variable: "outcome_unexplined_bleeding",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 16,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_UNEXPLINED_BLEEDING_ANSWER_YES_LABEL",
                    value: "yes",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_UNEXPLINED_BLEEDING_ANSWER_YES_QUESTION_OUTCOME_BLEEDING_SPECIFY_TEXT",
                            variable: "outcome_bleeding_specify",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_UNEXPLINED_BLEEDING_ANSWER_NO_LABEL",
                    value: "no",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_UNEXPLINED_BLEEDING_ANSWER_UNK_LABEL",
                    value: "unk",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_TEXT",
            variable: "outcome_symp",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 17,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MULTIPLE_ANSWERS",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_FEVER_LABEL",
                    value: "fever",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_FEVER_QUESTION_OUTCOME_FEVER_TEMP_TEXT",
                            variable: "outcome_fever_temp",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_NUMERIC",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_FEVER_QUESTION_OUTCOME_FEVER_SOURCE_TEXT",
                            variable: "outcome_ fever_source",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
                            required: false,
                            order: 2,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_FEVER_QUESTION_OUTCOME_FEVER_SOURCE_ANSWER_AXILLARY_LABEL",
                                    value: "axillary",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 1,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_FEVER_QUESTION_OUTCOME_FEVER_SOURCE_ANSWER_ORAL_LABEL",
                                    value: "oral",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 2,
                                },
                                {
                                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_FEVER_QUESTION_OUTCOME_FEVER_SOURCE_ANSWER_RECTAL_LABEL",
                                    value: "rectal",
                                    alert: false,
                                    additionalQuestions: null,
                                    order: 3,
                                },
                            ],
                        },
                    ],
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_VOMITING_NAUSEA_LABEL",
                    value: "vomiting-nausea",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_DIARRHEA_LABEL",
                    value: "diarrhea",
                    alert: false,
                    additionalQuestions: null,
                    order: 3,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_INTENSE_FATIGUE_LABEL",
                    value: "intense_fatigue",
                    alert: false,
                    additionalQuestions: null,
                    order: 4,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_ANOREXIA_LABEL",
                    value: "anorexia ",
                    alert: false,
                    additionalQuestions: null,
                    order: 5,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_ABDOMINAL_PAIN_LABEL",
                    value: "abdominal_pain",
                    alert: false,
                    additionalQuestions: null,
                    order: 6,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_CHEST_PAIN_LABEL",
                    value: "chest_pain",
                    alert: false,
                    additionalQuestions: null,
                    order: 7,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_MUSCLE_PAIN_LABEL",
                    value: "muscle_pain",
                    alert: false,
                    additionalQuestions: null,
                    order: 8,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_JOINT_PAIN_LABEL",
                    value: "joint_pain",
                    alert: false,
                    additionalQuestions: null,
                    order: 9,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_HEADACHE_LABEL",
                    value: "headache",
                    alert: false,
                    additionalQuestions: null,
                    order: 10,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_COUGH_LABEL",
                    value: "cough",
                    alert: false,
                    additionalQuestions: null,
                    order: 11,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_DIFFICULTY_BREATHING_LABEL",
                    value: "difficulty_breathing",
                    alert: false,
                    additionalQuestions: null,
                    order: 12,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_DIFFICULTY_SWALLOWING_LABEL",
                    value: "difficulty_swallowing",
                    alert: false,
                    additionalQuestions: null,
                    order: 13,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_SORE_THROAT_LABEL",
                    value: "sore_throat",
                    alert: false,
                    additionalQuestions: null,
                    order: 14,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_JAUNDICE_LABEL",
                    value: "jaundice",
                    alert: false,
                    additionalQuestions: null,
                    order: 15,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_CONJUNCTIVITIS_LABEL",
                    value: "conjunctivitis ",
                    alert: false,
                    additionalQuestions: null,
                    order: 16,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_SKIN_RASH_LABEL",
                    value: "skin_rash",
                    alert: false,
                    additionalQuestions: null,
                    order: 17,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_HICCUPS_LABEL",
                    value: "hiccups",
                    alert: false,
                    additionalQuestions: null,
                    order: 18,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_PAIN_BEHIND_EYES_LABEL",
                    value: "pain_behind_eyes",
                    alert: false,
                    additionalQuestions: null,
                    order: 19,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_COMA_LABEL",
                    value: "coma",
                    alert: false,
                    additionalQuestions: null,
                    order: 20,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_CONFUSED_LABEL",
                    value: "confused ",
                    alert: false,
                    additionalQuestions: null,
                    order: 21,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_NON_HEMORRHAGIC_SYMP_LABEL",
                    value: "non-hemorrhagic_symp",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_SYMP_ANSWER_NON_HEMORRHAGIC_SYMP_QUESTION_OUTCOME_SYMP_SPECIFY_TEXT",
                            variable: "outcome_symp_specify",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 22,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_2_E_9357_FA_0764_4826_8333_CC_0632_CF_792_D_TEXT",
            variable: "2e9357fa-0764-4826-8333-cc0632cf792d",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 18,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MARKUP",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_184682_F_2_B_105_4296_8_C_06_AF_567_A_2601_A_9_TEXT",
            variable: "184682f2-b105-4296-8c06-af567a2601a9",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 19,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MARKUP",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_PLACE_OF_DEATH_TEXT",
            variable: "outcome_place_of_death",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 20,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_PLACE_OF_DEATH_ANSWER_COMMUNITY_LABEL",
                    value: "community",
                    alert: false,
                    additionalQuestions: null,
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_PLACE_OF_DEATH_ANSWER_HOSPITAL_LABEL",
                    value: "hospital",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_PLACE_OF_DEATH_ANSWER_OTHER_LABEL",
                    value: "other",
                    alert: false,
                    additionalQuestions: [
                        {
                            multiAnswer: false,
                            inactive: false,
                            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_PLACE_OF_DEATH_ANSWER_OTHER_QUESTION_OUTCOME_PLACE_DEATH_SPECIFY_TEXT",
                            variable: "outcome_place_death_specify",
                            category:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
                            required: false,
                            order: 1,
                            answerType:
                                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
                            answersDisplay:
                                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
                            answers: [],
                        },
                    ],
                    order: 3,
                },
            ],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_DEATH_VILLAGE_TEXT",
            variable: "outcome_death_village",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 21,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_DEATH_DISTRICT_TEXT",
            variable: "outcome_death_district",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 22,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_OUTCOME_DEATH_SUB_COUNTY_TEXT",
            variable: "outcome_death_sub-county",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 23,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_FREE_TEXT",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [],
        },
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_FUNERAL_CONDUCTED_BY_TEXT",
            variable: "funeral_conducted_by",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_OUTCOME_STATUS",
            required: false,
            order: 24,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_SINGLE_ANSWER",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_FUNERAL_CONDUCTED_BY_ANSWER_FAMILY_COMMUNITY_LABEL",
                    value: "family_community",
                    alert: false,
                    additionalQuestions: null,
                    order: 1,
                },
                {
                    label: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_CASEINVESTIGATIONTEMPLATE_QUESTION_FUNERAL_CONDUCTED_BY_ANSWER_OUTBREAK_BURIAL_TEAM_LABEL",
                    value: "outbreak_burial_team",
                    alert: false,
                    additionalQuestions: null,
                    order: 2,
                },
            ],
        },
    ],
    contactInvestigationTemplate: [],
    contactFollowUpTemplate: [],
    labResultsTemplate: [
        {
            multiAnswer: false,
            inactive: false,
            text: "LNG_OUTBREAK_07939044-F6A1-41D1-8296-168D31F46A4C_LABRESULTSTEMPLATE_QUESTION_49_E_6_A_703_A_0_EC_4042_BD_96_73_C_2_E_69_EBE_49_TEXT",
            variable: "49e6a703-a0ec-4042-bd96-73c2e69ebe49",
            category:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_CATEGORY_FORM_COMPLETION_INFORMATION",
            required: false,
            order: 0,
            answerType:
                "LNG_REFERENCE_DATA_CATEGORY_QUESTION_ANSWER_TYPE_MARKUP",
            answersDisplay:
                "LNG_OUTBREAK_QUESTIONNAIRE_ANSWERS_DISPLAY_ORIENTATION_VERTICAL",
            answers: [],
        },
    ],
    caseIdMask: "*",
    contactIdMask: "*",
    arcGisServers: [
        {
            name: "WHO Polygon Basemap",
            url: "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_no_labels/VectorTileServer",
            type: "LNG_REFERENCE_DATA_OUTBREAK_MAP_SERVER_TYPE_VECTOR_TILE_VECTOR_TILE_LAYER",
            styleUrl:
                "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_no_labels/VectorTileServer/resources/styles/",
            styleUrlSource: "esri",
        },
        {
            name: "Disputed Areas and Borders for Polygon Basemap",
            url: "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_Disputed_Areas_and_Borders_VTP/VectorTileServer",
            type: "LNG_REFERENCE_DATA_OUTBREAK_MAP_SERVER_TYPE_VECTOR_TILE_VECTOR_TILE_LAYER",
            styleUrl:
                "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_Disputed_Areas_and_Borders_VTP/VectorTileServer/resources/styles/",
            styleUrlSource: "esri",
        },
        {
            name: "Labels",
            url: "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_labels/VectorTileServer",
            type: "LNG_REFERENCE_DATA_OUTBREAK_MAP_SERVER_TYPE_VECTOR_TILE_VECTOR_TILE_LAYER",
            styleUrl:
                "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_labels/VectorTileServer/resources/styles/",
            styleUrlSource: "esri",
        },
    ],
    reportingGeographicalLevelId:
        "LNG_REFERENCE_DATA_CATEGORY_LOCATION_GEOGRAPHICAL_LEVEL_ADMIN_LEVEL_2",
    isContactLabResultsActive: false,
    contactOfContactIdMask: "*",
    isContactsOfContactsActive: false,
    isDateOfOnsetRequired: false,
    applyGeographicRestrictions: false,
    // checkLastContactDateAgainstDateOnSet: false,
    // disableModifyingLegacyQuestionnaire: false,
    id: "07939044-f6a1-41d1-8296-168d31f46a4c",
    createdAt: "2023-05-17T05:41:13.274Z",
    createdBy: "1b9a42fc-b944-492f-b27d-9645f70496c0",
    updatedAt: "2023-05-17T05:41:13.274Z",
    updatedBy: "1b9a42fc-b944-492f-b27d-9645f70496c0",
    createdOn: "API",
    deleted: false,
};
