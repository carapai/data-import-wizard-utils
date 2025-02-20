import { isEmpty } from "lodash/fp";
import { z } from "zod";
import {
    DataSource,
    EventStageMapping,
    IMapping,
    IProgram,
    Mapping,
    Metadata,
    Option,
    StageMapping,
} from "./interfaces";
const validURL = (mapping: Partial<IMapping>, mySchema: z.ZodSchema) => {
    return mySchema.safeParse(mapping.authentication?.url).success;
};

const hasLogins = (mapping: Partial<IMapping>) => {
    if (mapping && mapping.authentication?.basicAuth) {
        return (
            !isEmpty(mapping.authentication.username) &&
            !isEmpty(mapping.authentication.password)
        );
    }
    return false;
};

const hasRemote = (mapping: Partial<IMapping>) => {
    return mapping && !isEmpty(mapping.program?.remoteProgram);
};

const hasName = (mapping: Partial<IMapping>) => {
    return mapping && mapping.name && mapping.dataSource;
};
const hasData = (mapping: Partial<IMapping>, data: any[]) => {
    if (mapping && mapping.isSource) {
        return true;
    }
    return data && data.length > 0;
};

const hasProgram = (mapping: Partial<IMapping>) =>
    !isEmpty(mapping && mapping.program?.program);

const hasRemoteProgram = (mapping: Partial<IMapping>) =>
    !isEmpty(mapping && mapping.program?.remoteProgram);

const mandatoryAttributesMapped = ({
    attributeMapping,
    destinationFields,
}: {
    destinationFields: Option[];
    attributeMapping: Mapping;
}) => {
    if (attributeMapping && destinationFields) {
        const mandatoryFields = destinationFields.flatMap(
            ({ mandatory, value }) => {
                if (
                    mandatory &&
                    attributeMapping[value] &&
                    attributeMapping[value].source
                ) {
                    return true;
                } else if (mandatory) {
                    return false;
                }
                return [];
            },
        );
        if (mandatoryFields.length > 0) {
            return mandatoryFields.every((value) => value === true);
        }
        return true;
    }
    return false;
};

const mandatoryGoDataMapped = ({
    mapping,
    attributeMapping,
    metadata,
}: {
    mapping: Partial<IMapping>;
    attributeMapping: Mapping;
    metadata: Metadata;
}) => {
    if (attributeMapping && mapping) {
        const allAttributes = Object.keys(attributeMapping);
        const hasLab = metadata.lab.find(
            ({ value }) => allAttributes.indexOf(value) !== -1,
        );
        if (mapping.program?.responseKey === "EVENT") {
            return mandatoryAttributesMapped({
                destinationFields: metadata.events,
                attributeMapping,
            });
        } else if (mapping.program?.responseKey === "CASE") {
            if (hasLab) {
                return mandatoryAttributesMapped({
                    destinationFields: [
                        ...metadata.case,
                        ...metadata.epidemiology,
                        ...metadata.lab,
                    ],
                    attributeMapping,
                });
            }
            return mandatoryAttributesMapped({
                destinationFields: [...metadata.case, ...metadata.epidemiology],
                attributeMapping,
            });
        } else if (mapping.program?.responseKey === "CONTACT") {
            if (hasLab) {
                return mandatoryAttributesMapped({
                    destinationFields: [
                        ...metadata.contact,
                        ...metadata.epidemiology,
                        ...metadata.relationship,
                        ...metadata.lab,
                    ],
                    attributeMapping,
                });
            }
            return mandatoryAttributesMapped({
                destinationFields: [
                    ...metadata.contact,
                    ...metadata.epidemiology,
                    ...metadata.relationship,
                ],
                attributeMapping,
            });
        }
    }
};

const isValidProgramStage = (
    program: Partial<IProgram>,
    eventStageMapping: Record<string, EventStageMapping>,
    programStageMapping: StageMapping,
) => {
    if (isEmpty(programStageMapping)) {
        return true;
    }

    const all = Object.entries(programStageMapping).map(([stage, mapping]) => {
        const { createEvents, updateEvents, eventDateColumn } =
            eventStageMapping[stage];
        const currentStage = program.programStages.find(
            ({ id }) => id === stage,
        );
        if ((createEvents || updateEvents) && eventDateColumn && currentStage) {
            const allCompulsoryMapped =
                currentStage.programStageDataElements.flatMap(
                    ({ compulsory, dataElement: { id } }) => {
                        if (compulsory && mapping[id]?.source) {
                            return true;
                        } else if (compulsory) {
                            return false;
                        }
                        return true;
                    },
                );
            return allCompulsoryMapped.every((e) => e === true);
        } else if (createEvents || updateEvents) {
            return false;
        }
        return true;
    });
    return all.every((e) => e === true);
};

const hasOrgUnitMapping = (organisationUnitMapping: Mapping) => {
    if (!isEmpty(organisationUnitMapping)) {
        return (
            Object.values(organisationUnitMapping).flatMap(({ source }) => {
                if (source) {
                    return source;
                }
                return [];
            }).length > 0
        );
    }
    return false;
};

export const makeValidation = ({
    mapping,
    programStageMapping,
    attributeMapping,
    organisationUnitMapping,
    step,
    mySchema,
    data,
    program,
    metadata,
    hasError,
    enrollmentMapping,
}: {
    mapping: Partial<IMapping>;
    programStageMapping: StageMapping;
    attributeMapping: Mapping;
    organisationUnitMapping: Mapping;
    step: number;
    mySchema: z.ZodSchema;
    data: any[];
    program: Partial<IProgram>;
    metadata: Metadata;
    hasError: boolean;
    enrollmentMapping: Mapping;
}) => {
    const allOptions: Record<number, Record<DataSource, boolean>> = {
        2: {
            "go-data":
                !hasName(mapping) ||
                !validURL(mapping, mySchema) ||
                !hasLogins(mapping),
            "csv-line-list": !hasData(mapping, data) || !hasName(mapping),
            "xlsx-line-list": !hasData(mapping, data) || !hasName(mapping),
            "dhis2-program": !hasName(mapping),
            json: !hasData(mapping, data) || !hasName(mapping),
            fhir: false,
            api: (data && data.length === 0) || !hasName(mapping),
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        3: {
            "go-data": !hasProgram(mapping),
            "csv-line-list": !hasProgram(mapping),
            "xlsx-line-list": !hasProgram(mapping),
            "dhis2-program": !hasProgram(mapping),
            json: !hasProgram(mapping),
            api: !hasProgram(mapping),
            fhir: !hasProgram(mapping),
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        5: {
            "go-data": !hasRemote(mapping),
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
            fhir: false,

            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        6: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": !hasRemoteProgram(mapping),
            json: false,
            api: false,
            fhir: false,
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        7: {
            "go-data": !hasOrgUnitMapping(organisationUnitMapping),
            "csv-line-list": !hasOrgUnitMapping(organisationUnitMapping),
            "xlsx-line-list": !hasOrgUnitMapping(organisationUnitMapping),
            "dhis2-program": !hasOrgUnitMapping(organisationUnitMapping),
            json: !hasOrgUnitMapping(organisationUnitMapping),
            api: !hasOrgUnitMapping(organisationUnitMapping),
            fhir: !hasOrgUnitMapping(organisationUnitMapping),
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        8: {
            "go-data": !mandatoryGoDataMapped({
                mapping,
                attributeMapping,
                metadata,
            }),
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
            fhir: false,
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        9: {
            "go-data": !mandatoryAttributesMapped({
                destinationFields:
                    metadata.destinationTrackedEntityTypeAttributes,
                attributeMapping,
            }),
            "csv-line-list": !mandatoryAttributesMapped({
                destinationFields:
                    metadata.destinationTrackedEntityTypeAttributes,
                attributeMapping,
            }),
            "xlsx-line-list": !mandatoryAttributesMapped({
                destinationFields:
                    metadata.destinationTrackedEntityTypeAttributes,
                attributeMapping,
            }),
            "dhis2-program": !mandatoryAttributesMapped({
                destinationFields:
                    metadata.destinationTrackedEntityTypeAttributes,
                attributeMapping,
            }),
            json: !mandatoryAttributesMapped({
                destinationFields:
                    metadata.destinationTrackedEntityTypeAttributes,
                attributeMapping,
            }),
            api: !mandatoryAttributesMapped({
                destinationFields:
                    metadata.destinationTrackedEntityTypeAttributes,
                attributeMapping,
            }),
            fhir: !mandatoryAttributesMapped({
                destinationFields:
                    metadata.destinationTrackedEntityTypeAttributes,
                attributeMapping,
            }),

            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        10: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
            fhir: false,
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        11: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
            fhir: false,
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        12: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
            fhir: false,
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        13: {
            "go-data": false,
            "csv-line-list": false,
            "xlsx-line-list": false,
            "dhis2-program": false,
            json: false,
            api: false,
            fhir: false,
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
        15: {
            "go-data": !mandatoryAttributesMapped({
                destinationFields: metadata.destinationEnrollmentAttributes,
                attributeMapping: enrollmentMapping,
            }),
            "csv-line-list": !mandatoryAttributesMapped({
                destinationFields: metadata.destinationEnrollmentAttributes,
                attributeMapping: enrollmentMapping,
            }),
            "xlsx-line-list": !mandatoryAttributesMapped({
                destinationFields: metadata.destinationEnrollmentAttributes,
                attributeMapping: enrollmentMapping,
            }),
            "dhis2-program": !mandatoryAttributesMapped({
                destinationFields: metadata.destinationEnrollmentAttributes,
                attributeMapping: enrollmentMapping,
            }),
            json: !mandatoryAttributesMapped({
                destinationFields: metadata.destinationEnrollmentAttributes,
                attributeMapping: enrollmentMapping,
            }),
            api: !mandatoryAttributesMapped({
                destinationFields: metadata.destinationEnrollmentAttributes,
                attributeMapping: enrollmentMapping,
            }),
            fhir: !mandatoryAttributesMapped({
                destinationFields: metadata.destinationEnrollmentAttributes,
                attributeMapping: enrollmentMapping,
            }),
            "xlsx-tabular-data": false,
            "xlsx-form": false,
            "dhis2-data-set": false,
            "dhis2-indicators": false,
            "dhis2-program-indicators": false,
            "manual-dhis2-program-indicators": false,
        },
    };
    if (hasError) return hasError;
    if (mapping && mapping.dataSource) {
        return allOptions[step]?.[mapping.dataSource];
    }
    return true;
};
