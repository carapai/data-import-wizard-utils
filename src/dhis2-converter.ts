import dayjs from "dayjs";
import { fromPairs, getOr, groupBy, isEmpty } from "lodash/fp";
import { processEvents } from "./events-converter";
import {
    DHIS2ProcessedData,
    Enrollment,
    Event,
    IEnrollment,
    IMapping,
    IProgram,
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
    enrollmentMapping,
}: {
    previousData: {
        attributes: Record<string, Array<{ attribute: string; value: string }>>;
        dataElements: Record<
            string,
            Record<string, Record<string, Record<string, any>>>
        >;
        enrollments: Record<string, IEnrollment[]>;
        trackedEntities: Record<string, string>;
        orgUnits: Record<string, string>;
    };
    data: any[];
    mapping: Partial<IMapping>;
    organisationUnitMapping: Mapping;
    attributeMapping: Mapping;
    programStageMapping: StageMapping;
    optionMapping: Record<string, string>;
    version: number;
    program: Partial<IProgram>;
    enrollmentMapping: Mapping;
}): DHIS2ProcessedData => {
    const { enrollmentAttributes, trackedEntityAttributes } =
        getAttributes(program);
    const aAttributes = fromPairs(
        trackedEntityAttributes.map((a) => [a.value, a]),
    );
    const eAttributes = fromPairs(
        enrollmentAttributes.map((a) => [a.value, a]),
    );
    const allElements = fromPairs(
        getDataElements(program).map((e) => [e.value, e]),
    );
    const uniqColumns = getProgramUniqAttributes(attributeMapping);
    const uniqEnrollmentColumns = getProgramUniqAttributes(enrollmentMapping);

    const trackedEntityGeometryType =
        program.trackedEntityType?.featureType ?? "";

    const enrollmentGeometryType = program.featureType ?? "";
    const {
        onlyEnrollOnce,
        selectEnrollmentDatesInFuture,
        selectIncidentDatesInFuture,
        programTrackedEntityAttributes,
        programStages,
        registration,
    } = program;

    const stages = fromPairs(
        programStages.map((programStage) => {
            return [programStage.id, programStage];
        }),
    );

    const {
        trackedEntityInstanceColumn,
        geometryColumn: instanceGeometryColumn,
        createEntities,
        updateEntities,
    } = mapping.trackedEntityMapping ?? {};

    const { orgUnitColumn } = mapping.orgUnitMapping ?? {};
    const {
        enrollmentDateColumn,
        incidentDateColumn,
        updateEnrollments,
        createEnrollments,
        geometryColumn: enrollmentGeometryColumn,
    } = mapping.enrollmentMapping ?? {};

    const flippedUnits = flipMapping(organisationUnitMapping, true);

    const flippedOptions: Record<string, string> = {};

    Object.entries(optionMapping).forEach(([option, value]) => {
        if (value) {
            value.split(",").forEach((u) => {
                flippedOptions[u] = option;
            });
        }
    });
    let groupedData: Record<string, any[]> = {};
    if (trackedEntityInstanceColumn) {
        groupedData = groupBy(trackedEntityInstanceColumn, data);
    } else if (uniqColumns.length > 0 || uniqEnrollmentColumns.length > 0) {
        groupedData = groupBy(
            (item: any) =>
                uniqColumns
                    .concat(uniqEnrollmentColumns)
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

    const processed = Object.entries(groupedData).flatMap(
        ([uniqueKey, current]) => {
            let results: {
                enrollments: Array<Partial<Enrollment>>;
                enrollmentUpdates: Array<Partial<Enrollment>>;
                trackedEntity: Partial<TrackedEntityInstance>;
                events: Array<Partial<Event>>;
                eventUpdates: Array<Partial<Event>>;
                trackedEntityUpdate: Partial<TrackedEntityInstance>;
                conflicts: any[];
                errors: any[];
            } = {
                enrollments: [],
                trackedEntity: {},
                events: [],
                eventUpdates: [],
                trackedEntityUpdate: {},
                enrollmentUpdates: [],
                errors: [],
                conflicts: [],
            };

            let currentUnit = "";

            if (orgUnitColumn) {
                currentUnit = orgUnitColumn
                    .split(",")
                    .map((u) => getOr("", u, current[0]).trim())
                    .join("/");
            }

            let previousOrgUnit = getOr(
                getOr("", uniqueKey, previousData.orgUnits),
                cleanString(currentUnit).toLowerCase(),
                flippedUnits,
            );

            if (program.registration) {
                let previousTrackedEntity = getOr(
                    "",
                    uniqueKey,
                    previousData.trackedEntities,
                );
                let previousEnrollments = getOr(
                    [],
                    uniqueKey,
                    previousData.enrollments,
                );
                const previousAttributes = getOr(
                    [],
                    uniqueKey,
                    previousData.attributes,
                );
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

                let { source, errors, conflicts } = processAttributes({
                    attributeMapping,
                    attributes: aAttributes,
                    flippedOptions,
                    data: current[0],
                    uniqueKey,
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

                if (
                    previousAttributes.length > 0 &&
                    updateEntities &&
                    results.errors.length === 0
                ) {
                    if (!isEmpty(differences)) {
                        const attributes = Object.entries({
                            ...destination,
                            ...differences,
                        }).map(([attribute, value]) => ({ attribute, value }));

                        results = {
                            ...results,
                            trackedEntityUpdate: {
                                trackedEntityInstance: previousTrackedEntity,
                                attributes,
                                trackedEntityType:
                                    mapping.program.trackedEntityType,
                                orgUnit: previousOrgUnit,
                            },
                        };

                        if (!isEmpty(trackedEntityGeometry)) {
                            results = {
                                ...results,
                                trackedEntityUpdate: {
                                    ...results.trackedEntityUpdate,
                                    geometry: trackedEntityGeometry,
                                },
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
                        results = {
                            ...results,
                            trackedEntity: {
                                trackedEntityInstance: previousTrackedEntity,
                                attributes: Object.entries({
                                    ...differences,
                                    ...source,
                                }).map(([attribute, value]) => ({
                                    attribute,
                                    value,
                                })),
                                trackedEntityType:
                                    mapping.program.trackedEntityType,
                                orgUnit: previousOrgUnit,
                            },
                        };
                        if (!isEmpty(trackedEntityGeometry)) {
                            results = {
                                ...results,
                                trackedEntity: {
                                    ...results.trackedEntity,
                                    geometry: trackedEntityGeometry,
                                },
                            };
                        }
                    } else {
                        results = {
                            ...results,
                            errors: results.errors.concat({
                                value: `Missing equivalent mapping for organisation unit ${currentUnit}`,
                                attribute: `OrgUnit for ${uniqueKey}`,
                                id: generateUid(),
                            }),
                        };
                    }
                }

                if (enrollmentDateColumn && results.errors.length === 0) {
                    const groupedByEnrollmentDate = groupBy(
                        enrollmentDateColumn,
                        current,
                    );

                    for (const [eDate, enrollmentData] of Object.entries(
                        groupedByEnrollmentDate,
                    )) {
                        let previousEnrollment: IEnrollment =
                            previousEnrollments.find((a) =>
                                dayjs(a.enrollmentDate).isSame(dayjs(eDate)),
                            );
                        if (
                            previousOrgUnit &&
                            createEnrollments &&
                            isEmpty(previousEnrollment)
                        ) {
                            const enrollmentDate = dayjs(eDate);
                            const incidentDate = dayjs(
                                getOr(
                                    "",
                                    incidentDateColumn,
                                    enrollmentData[0],
                                ),
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
                                            value: `Date ${enrollmentDate.format(
                                                "YYYY-MM-DD",
                                            )} is in the future`,
                                            attribute: `Enrollment date for ${uniqueKey}`,
                                            id: generateUid(),
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
                                            value: `Date ${incidentDate.format(
                                                "YYYY-MM-DD",
                                            )} is in the future`,
                                            attribute: `Incident date for ${uniqueKey}`,
                                            id: generateUid(),
                                        }),
                                    };
                                }
                                if (dateAreValid) {
                                    const { source, errors, conflicts } =
                                        processAttributes({
                                            attributeMapping: enrollmentMapping,
                                            attributes: eAttributes,
                                            flippedOptions,
                                            data: current[0],
                                            uniqueKey,
                                        });

                                    results = {
                                        ...results,
                                        errors: results.errors.concat(errors),
                                        conflicts:
                                            results.conflicts.concat(conflicts),
                                    };

                                    if (errors.length === 0) {
                                        const differences = findChanges({
                                            destination: {},
                                            source,
                                        });

                                        previousEnrollment = {
                                            enrollment: generateUid(),
                                            enrollmentDate:
                                                enrollmentDate.format(
                                                    "YYYY-MM-DD",
                                                ),
                                            attributes: {},
                                        };
                                        let currentEnrollment: Partial<Enrollment> =
                                            {
                                                program:
                                                    mapping.program.program,
                                                trackedEntityInstance:
                                                    previousTrackedEntity,
                                                orgUnit: previousOrgUnit,
                                                enrollmentDate:
                                                    enrollmentDate.format(
                                                        "YYYY-MM-DD",
                                                    ),
                                                incidentDate:
                                                    enrollmentDate.format(
                                                        "YYYY-MM-DD",
                                                    ),
                                                enrollment:
                                                    previousEnrollment.enrollment,

                                                attributes: Object.entries({
                                                    ...differences,
                                                    ...source,
                                                }).map(
                                                    ([attribute, value]) => ({
                                                        attribute,
                                                        value,
                                                    }),
                                                ),
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
                                    }
                                }
                            } else {
                                results = {
                                    ...results,
                                    errors: results.errors.concat({
                                        value: "Missing",
                                        attribute:
                                            "enrollment date and/or incident date",
                                        id: generateUid(),
                                    }),
                                };
                            }
                        } else if (
                            previousOrgUnit &&
                            updateEnrollments &&
                            !isEmpty(previousEnrollment)
                        ) {
                            const { source, errors, conflicts } =
                                processAttributes({
                                    attributeMapping: enrollmentMapping,
                                    attributes: eAttributes,
                                    flippedOptions,
                                    data: current[0],
                                    uniqueKey,
                                });

                            const differences = findChanges({
                                destination: previousEnrollment.attributes,
                                source,
                            });

                            if (!isEmpty(differences)) {
                                let currentEnrollment: Partial<Enrollment> = {
                                    ...previousData,
                                    attributes: Object.entries({
                                        ...differences,
                                        ...source,
                                    }).map(([attribute, value]) => ({
                                        attribute,
                                        value,
                                    })),
                                };
                                results = {
                                    ...results,
                                    enrollmentUpdates:
                                        results.enrollmentUpdates.concat(
                                            currentEnrollment,
                                        ),
                                };
                            }

                            results = {
                                ...results,
                                errors: results.errors.concat(errors),
                                conflicts: results.conflicts.concat(conflicts),
                            };
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
                                previousEvents: getOr(
                                    {},
                                    uniqueKey,
                                    previousData.dataElements,
                                ),
                                stages,
                                options: flippedOptions,
                                dataElements: allElements,
                                uniqueKey,
                                registration,
                                eventStageMapping: mapping.eventStageMapping,
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
                } else if (
                    previousOrgUnit &&
                    previousEnrollments.length === 1
                ) {
                    const { eventUpdates, newEvents } = processEvents({
                        data: current,
                        programStageMapping,
                        trackedEntityInstance: previousTrackedEntity,
                        enrollment: previousEnrollments[0],
                        orgUnit: previousOrgUnit,
                        program: mapping.program.program || "",
                        previousEvents: getOr(
                            {},
                            uniqueKey,
                            previousData.dataElements,
                        ),
                        stages,
                        options: flippedOptions,
                        dataElements: allElements,
                        uniqueKey,
                        registration,
                        eventStageMapping: mapping.eventStageMapping,
                    });
                    results = {
                        ...results,
                        events: results.events.concat(newEvents),
                        eventUpdates: results.eventUpdates.concat(eventUpdates),
                        conflicts: results.conflicts.concat(conflicts),
                        errors: results.errors.concat(errors),
                    };
                }
            } else if (previousOrgUnit) {
                const { eventUpdates, newEvents, conflicts, errors } =
                    processEvents({
                        data: current,
                        programStageMapping,
                        orgUnit: previousOrgUnit,
                        program: mapping.program.program || "",
                        previousEvents: getOr(
                            {},
                            uniqueKey,
                            previousData.dataElements,
                        ),
                        stages,
                        options: flippedOptions,
                        dataElements: allElements,
                        uniqueKey,
                        registration: false,
                        eventStageMapping: mapping.eventStageMapping,
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
        },
    );

    const trackedEntityInstances = processed.flatMap(({ trackedEntity }) => {
        if (!isEmpty(trackedEntity)) return trackedEntity;
        return [];
    });

    const enrollments = processed.flatMap(({ enrollments }) => enrollments);
    const enrollmentUpdates = processed.flatMap(
        ({ enrollmentUpdates }) => enrollmentUpdates,
    );
    const errors = processed.flatMap(({ errors }) => errors);
    const conflicts = processed.flatMap(({ conflicts }) => conflicts);
    const events = processed.flatMap(({ events }) => events);
    const trackedEntityInstanceUpdates = processed.flatMap(
        ({ trackedEntityUpdate }) => {
            if (!isEmpty(trackedEntityUpdate)) return trackedEntityUpdate;
            return [];
        },
    );
    const eventUpdates = processed.flatMap(({ eventUpdates }) => eventUpdates);
    return {
        trackedEntityInstances,
        events,
        enrollments,
        trackedEntityInstanceUpdates,
        enrollmentUpdates,
        eventUpdates,
        errors,
        conflicts,
    };
};
