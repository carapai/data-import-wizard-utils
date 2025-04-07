import dayjs from "dayjs";
import { fromPairs, getOr, groupBy, isEmpty } from "lodash/fp";
import { processEvents } from "./events-converter";
import {
    Attribute,
    DHIS2ProcessedData,
    Enrollment,
    IEnrollment,
    IMapping,
    IProgram,
    IProgramStage,
    Mapping,
    StageMapping,
    TrackedEntityInstance,
} from "./interfaces";
import {
    getAttributes,
    getDataElements,
    getProgramUniqAttributes,
} from "./program";
import { generateUid } from "./uid";
import {
    cleanString,
    findChanges,
    flipMapping,
    getGeometry,
    processAttributes,
} from "./utils";
export const convertToDHIS2 = ({
    program,
    previousData,
    data,
    mapping,
    version,
    attributeMapping,
    programStageMapping,
    organisationUnitMapping,
    optionMapping,
    attributionMapping,
}: {
    previousData: {
        attributes: Map<string, Partial<Attribute>[]>;
        dataElements: Map<
            string,
            Map<string, Map<string, Map<string, string>>>
        >;
        events: Map<string, Map<string, Map<string, string>>>;
        enrollments: Map<string, IEnrollment[]>;
        trackedEntities: Map<string, string>;
        orgUnits: Map<string, string>;
    };
    data: any[];
    mapping: Partial<IMapping>;
    organisationUnitMapping: Mapping;
    attributeMapping: Mapping;
    attributionMapping: Mapping;
    programStageMapping: StageMapping;
    optionMapping: Map<string, string>;
    version: number;
    program: Partial<IProgram>;
    enrollmentMapping: Mapping;
}): DHIS2ProcessedData => {
    const {
        selectEnrollmentDatesInFuture,
        selectIncidentDatesInFuture,
        programStages,
        registration,
    } = program;
    const allElements = fromPairs(
        getDataElements(program).map((e) => [e.value, e]),
    );

    const stages: Map<string, IProgramStage> = new Map(
        programStages.map((programStage) => [programStage.id, programStage]),
    );

    const { orgUnitColumn } = mapping.orgUnitMapping ?? {};

    const flippedUnits = flipMapping(organisationUnitMapping, true);
    const flippedAttribution = flipMapping(attributionMapping);
    const flippedOptions: Map<string, string> = new Map<string, string>();
    optionMapping.forEach((value, option) => {
        if (value) {
            value.split(",").forEach((u) => {
                flippedOptions.set(u, option);
            });
        }
    });

    let results: DHIS2ProcessedData = {
        enrollments: [],
        events: [],
        eventUpdates: [],
        trackedEntityInstanceUpdates: [],
        enrollmentUpdates: [],
        errors: [],
        conflicts: [],
        trackedEntityInstances: [],
    };

    if (mapping.program.isTracker) {
        let groupedData: Record<string, any[]> = {};
        const { attributes } = getAttributes(program);
        const attributeValues = attributes.map((a) => a.value);
        const uniqColumns = getProgramUniqAttributes(attributeMapping);
        const trackedEntityGeometryType =
            program.trackedEntityType?.featureType ?? "";
        const enrollmentGeometryType = program.featureType ?? "";
        const {
            trackedEntityInstanceColumn,
            geometryColumn: instanceGeometryColumn,
            createEntities,
            updateEntities,
        } = mapping.trackedEntityMapping ?? {};

        const {
            enrollmentDateColumn,
            incidentDateColumn,
            updateEnrollments,
            createEnrollments,
            geometryColumn: enrollmentGeometryColumn,
        } = mapping.enrollmentMapping ?? {};

        if (trackedEntityInstanceColumn) {
            groupedData = groupBy(trackedEntityInstanceColumn, data);
        } else if (uniqColumns.length > 0) {
            groupedData = groupBy(
                (item: any) =>
                    uniqColumns
                        .map((column) => getOr("", column.source, item))
                        .sort()
                        .join(""),
                data,
            );
        } else {
            groupedData = groupBy(
                "id",
                data.map((d) => {
                    return { id: generateUid(), ...d };
                }),
            );
        }
        Object.entries(groupedData).forEach(([uniqueKey, current]) => {
            let currentUnit = "";
            if (orgUnitColumn) {
                currentUnit = orgUnitColumn
                    .split(",")
                    .map((u) => getOr("", u, current[0]).trim())
                    .join("/");
            }
            let previousOrgUnit = previousData.orgUnits.get(uniqueKey);
            if (!isEmpty(flippedUnits) && currentUnit) {
                previousOrgUnit = flippedUnits.get(
                    cleanString(currentUnit).toLowerCase(),
                );
            }
            let previousTrackedEntity =
                previousData.trackedEntities.get(uniqueKey) ?? "";
            let previousEnrollments =
                previousData.enrollments.get(uniqueKey) ?? [];
            const previousAttributes =
                previousData.attributes.get(uniqueKey) ?? [];
            const trackedEntityGeometry = getGeometry({
                data: current[0],
                geometryColumn: instanceGeometryColumn,
                featureType: trackedEntityGeometryType,
            });
            const enrollmentGeometry = getGeometry({
                data: current[0],
                geometryColumn: enrollmentGeometryColumn,
                featureType: enrollmentGeometryType,
            });

            const { source, errors, conflicts } = processAttributes({
                attributeMapping,
                attributes,
                flippedOptions,
                data: current[0],
                uniqueKey,
                updateEnrollments,
                updateEntities,
                createEnrollments,
                createEntities,
            });

            results = {
                ...results,
                errors: results.errors.concat(errors),
                conflicts: results.conflicts.concat(conflicts),
            };
            const destination = fromPairs(
                previousAttributes.map(({ attribute, value }) => [
                    attribute,
                    value,
                ]),
            );

            const differences = findChanges({
                destination,
                source,
            });

            const processedTrackedEntityAttributes = Object.entries({
                ...destination,
                ...differences,
            }).flatMap(([attribute, value]) => {
                if (new Set(attributeValues).has(attribute))
                    return { attribute, value };
                return [];
            });

            let currentTrackedEntity: Partial<TrackedEntityInstance> = {};

            if (
                previousAttributes.length > 0 &&
                updateEntities &&
                results.errors.length === 0
            ) {
                if (!isEmpty(differences)) {
                    currentTrackedEntity = {
                        trackedEntityInstance: previousTrackedEntity,
                        attributes: processedTrackedEntityAttributes,
                        trackedEntityType: mapping.program.trackedEntityType,
                        orgUnit: previousOrgUnit,
                    };
                    if (!isEmpty(trackedEntityGeometry)) {
                        currentTrackedEntity = {
                            ...currentTrackedEntity,
                            geometry: trackedEntityGeometry,
                        };
                    }
                }
            } else if (
                previousAttributes.length === 0 &&
                createEntities &&
                results.errors.length === 0
            ) {
                previousTrackedEntity = getOr(
                    generateUid(),
                    trackedEntityInstanceColumn,
                    current[0],
                );
                if (previousOrgUnit) {
                    currentTrackedEntity = {
                        trackedEntityInstance: previousTrackedEntity,
                        attributes: processedTrackedEntityAttributes,
                        trackedEntityType: mapping.program.trackedEntityType,
                        orgUnit: previousOrgUnit,
                    };
                    if (!isEmpty(trackedEntityGeometry)) {
                        currentTrackedEntity = {
                            ...currentTrackedEntity,
                            geometry: trackedEntityGeometry,
                        };
                    }
                } else {
                    results = {
                        ...results,
                        errors: results.errors.concat({
                            message: `Missing equivalent mapping for organisation unit ${currentUnit}`,
                            attribute: `orgUnit`,
                            field: "orgUnit",
                            id: generateUid(),
                            value: "",
                            valueType: "TEXT",
                            uniqueKey,
                        }),
                    };
                }
            }

            if (
                !isEmpty(previousAttributes) &&
                updateEntities &&
                !isEmpty(currentTrackedEntity)
            ) {
                results = {
                    ...results,
                    trackedEntityInstanceUpdates:
                        results.trackedEntityInstanceUpdates.concat(
                            currentTrackedEntity,
                        ),
                };
            }

            if (enrollmentDateColumn && results.errors.length === 0) {
                const groupedByEnrollmentDate = groupBy(
                    enrollmentDateColumn,
                    current,
                );
                for (const [eDate, enrollmentData] of Object.entries(
                    groupedByEnrollmentDate,
                )) {
                    let previousEnrollment: IEnrollment | undefined = undefined;
                    if (
                        program.onlyEnrollOnce &&
                        previousEnrollments.length > 0
                    ) {
                        previousEnrollment = previousEnrollments[0];
                    } else {
                        previousEnrollment = previousEnrollments.find((a) =>
                            dayjs(a.enrollmentDate).isSame(dayjs(eDate)),
                        );
                    }
                    if (
                        previousEnrollment &&
                        !dayjs(previousEnrollment.enrollmentDate).isSame(
                            dayjs(eDate),
                        ) &&
                        updateEnrollments
                    ) {
                        const { attributes, ...rest } = previousEnrollment;
                        const currentEnrollment: Partial<Enrollment> = {
                            ...rest,
                            enrollmentDate: eDate,
                        };
                        results = {
                            ...results,
                            enrollmentUpdates:
                                results.enrollmentUpdates.concat(
                                    currentEnrollment,
                                ),
                        };
                    } else if (
                        previousOrgUnit &&
                        createEnrollments &&
                        isEmpty(previousEnrollment)
                    ) {
                        const enrollmentDate = dayjs(eDate);
                        const incidentDate = dayjs(
                            getOr("", incidentDateColumn, enrollmentData[0]),
                        );
                        if (
                            enrollmentDate.isValid() &&
                            incidentDate.isValid()
                        ) {
                            let dateAreValid = true;
                            if (
                                !selectEnrollmentDatesInFuture &&
                                enrollmentDate.isAfter(dayjs())
                            ) {
                                dateAreValid = false;

                                results = {
                                    ...results,
                                    errors: results.errors.concat({
                                        message: `Date ${enrollmentDate.format(
                                            "YYYY-MM-DD",
                                        )} is in the future`,
                                        value: "",
                                        attribute: `Enrollment date`,
                                        field: `Enrollment date`,
                                        id: generateUid(),
                                        valueType: "DATE",
                                    }),
                                };
                            }

                            if (
                                !selectIncidentDatesInFuture &&
                                incidentDate.isAfter(dayjs())
                            ) {
                                dateAreValid = false;

                                results = {
                                    ...results,
                                    errors: results.errors.concat({
                                        message: `Date ${incidentDate.format(
                                            "YYYY-MM-DD",
                                        )} is in the future`,
                                        value: "",
                                        field: "Incident date",
                                        attribute: "Incident date",
                                        id: generateUid(),
                                        valueType: "DATE",
                                        uniqueKey,
                                    }),
                                };
                            }
                            if (dateAreValid) {
                                previousEnrollment = {
                                    enrollment: generateUid(),
                                    enrollmentDate:
                                        enrollmentDate.format("YYYY-MM-DD"),
                                    attributes: {},
                                };
                                let currentEnrollment: Partial<Enrollment> = {
                                    program: mapping.program.program,
                                    trackedEntityInstance:
                                        previousTrackedEntity,
                                    orgUnit: previousOrgUnit,
                                    enrollmentDate:
                                        enrollmentDate.format("YYYY-MM-DD"),
                                    incidentDate:
                                        enrollmentDate.format("YYYY-MM-DD"),
                                    enrollment: previousEnrollment.enrollment,
                                };
                                if (!isEmpty(enrollmentGeometry)) {
                                    currentEnrollment = {
                                        ...currentEnrollment,
                                        geometry: enrollmentGeometry,
                                    };
                                }
                                results = {
                                    ...results,
                                    enrollments:
                                        results.enrollments.concat(
                                            currentEnrollment,
                                        ),
                                };

                                if (
                                    isEmpty(previousAttributes) &&
                                    createEntities &&
                                    !isEmpty(currentTrackedEntity)
                                ) {
                                    results = {
                                        ...results,
                                        trackedEntityInstances:
                                            results.trackedEntityInstances.concat(
                                                currentTrackedEntity,
                                            ),
                                    };
                                }
                            }
                        } else {
                            results = {
                                ...results,
                                errors: results.errors.concat({
                                    value: "",
                                    attribute:
                                        "enrollment date and/or incident date",
                                    field: "enrollment date and/or incident date",
                                    id: generateUid(),
                                    message:
                                        "Missing enrollment date and/or incident date",
                                    valueType: "DATE",
                                    uniqueKey,
                                }),
                            };
                        }
                    }
                    if (
                        previousOrgUnit &&
                        previousEnrollment &&
                        previousEnrollment.enrollment &&
                        previousEnrollment.enrollmentDate &&
                        previousTrackedEntity
                    ) {
                        const { eventUpdates, newEvents } = processEvents({
                            data: enrollmentData,
                            programStageMapping,
                            trackedEntityInstance: previousTrackedEntity,
                            enrollment: previousEnrollment,
                            orgUnit: previousOrgUnit,
                            program: mapping.program.program || "",
                            previousEvents:
                                previousData.dataElements.get(uniqueKey),
                            stages,
                            options: flippedOptions,
                            dataElements: allElements,
                            uniqueKey,
                            registration,
                            eventStageMapping: mapping.eventStageMapping,
                            flippedAttribution,
                            mapping,
                        });
                        results = {
                            ...results,
                            events: results.events.concat(newEvents),
                            eventUpdates:
                                results.eventUpdates.concat(eventUpdates),
                            conflicts: results.conflicts.concat(conflicts),
                            errors: results.errors.concat(errors),
                        };
                    }
                }
            } else if (previousOrgUnit && previousEnrollments.length === 1) {
                console.log("Are we here");
                const { eventUpdates, newEvents } = processEvents({
                    data: current,
                    programStageMapping,
                    trackedEntityInstance: previousTrackedEntity,
                    enrollment: previousEnrollments[0],
                    orgUnit: previousOrgUnit,
                    program: mapping.program.program || "",
                    previousEvents: previousData.dataElements.get(uniqueKey),
                    stages,
                    options: flippedOptions,
                    dataElements: allElements,
                    uniqueKey,
                    registration,
                    eventStageMapping: mapping.eventStageMapping,
                    flippedAttribution,
                    mapping,
                });
                results = {
                    ...results,
                    events: results.events.concat(newEvents),
                    eventUpdates: results.eventUpdates.concat(eventUpdates),
                    conflicts: results.conflicts.concat(conflicts),
                    errors: results.errors.concat(errors),
                };
            } else if (previousOrgUnit && previousEnrollments.length > 0) {
                console.log("We are actually in the middle");
            }
        });
    } else {
        const { eventUpdates, newEvents, conflicts, errors } = processEvents({
            data,
            programStageMapping,
            program: mapping.program.program || "",
            previousEvents: previousData.events,
            stages,
            options: flippedOptions,
            dataElements: allElements,
            registration: false,
            eventStageMapping: mapping.eventStageMapping,
            flippedAttribution,
            mapping,
        });

        results = {
            ...results,
            events: results.events.concat(newEvents),
            eventUpdates: results.eventUpdates.concat(eventUpdates),
            conflicts: results.conflicts.concat(conflicts),
            errors: results.errors.concat(errors),
        };
    }
    return {
        ...results,
        conflicts: results.conflicts.filter((a) => !!a),
        errors: results.errors.filter((a) => !!a),
    };
};
