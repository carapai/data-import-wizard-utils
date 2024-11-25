import { IfhirR4 } from "@smile-cdr/fhirts";
import dayjs from "dayjs";
import { fromPairs, isArray } from "lodash";

export function flattenBundle(bundle: IfhirR4.IBundle) {
    const encounters: IfhirR4.IEncounter[] = [];
    const episodeOfCares: IfhirR4.IEpisodeOfCare[] = [];
    const observations: IfhirR4.IObservation[] = [];
    const patients: IfhirR4.IPatient[] = [];

    if (bundle && bundle.entry) {
        bundle.entry.forEach((entry) => {
            if (entry.resource.resourceType === "Encounter") {
                encounters.push(entry.resource);
            } else if (entry.resource.resourceType === "Observation") {
                observations.push(entry.resource);
            } else if (entry.resource.resourceType === "EpisodeOfCare") {
                episodeOfCares.push(entry.resource);
            } else if (entry.resource.resourceType === "Patient") {
                patients.push(entry.resource);
            }
        });
    }

    return encounters.flatMap((encounter) => {
        const currentEpisodeOfCare = episodeOfCares.find((a) => {
            if (isArray(encounter.episodeOfCare)) {
                return (
                    encounter.episodeOfCare.filter((e) =>
                        e.reference.includes(a.id),
                    ).length > 0
                );
            } else {
                const episode: { reference: string } = encounter.episodeOfCare;
                return episode.reference.includes(a.id);
            }
        });

        const patient = patients.find((p) => {
            return encounter.subject.reference.includes(p.id);
        });

        const currentObservations = observations.flatMap((observation) => {
            if (observation.encounter.reference.includes(encounter.id)) {
                let realValue =
                    observation.valueString ||
                    observation.valueInteger ||
                    observation.valueTime ||
                    observation.valueBoolean;
                if (observation.valueDateTime !== undefined) {
                    realValue = String(observation.valueDateTime).slice(0, 10);
                } else if (observation.valueQuantity !== undefined) {
                    realValue = observation.valueQuantity.value;
                } else if (observation.valueCodeableConcept !== undefined) {
                    const valueCode =
                        observation.valueCodeableConcept.coding.find(
                            (code) => !!code.system,
                        );
                    realValue = valueCode.code;
                }

                let all = fromPairs(
                    observation.code.coding.map((a) => [a.code, realValue]),
                );
                return {
                    ...all,
                    effectiveDateTime: observation.effectiveDateTime,
                    observation: { id: observation.id },
                };
            }

            return [];
        });

        if (currentEpisodeOfCare) {
            let identifier = {};

            patient.identifier.forEach((i) => {
                identifier = {
                    ...identifier,
                    [i.type.text]: i.value,
                };
                i.type.coding.forEach((a) => {
                    identifier = {
                        ...identifier,
                        [a.code]: i.value,
                    };
                });
            });
            let results: Record<string, any> = {
                encounter: {
                    period: {
                        start: encounter.period.start,
                        end: encounter.period.end,
                    },
                    id: encounter.id,
                },
                episodeOfCare: {
                    id: encounter.id,
                    period: {
                        start: currentEpisodeOfCare.period.start,
                        end: currentEpisodeOfCare.period.end,
                    },
                },
                patient: {
                    id: patient.id,
                    given: patient.name[0].given.join(" "),
                    family: patient.name[0].family,
                    name:
                        patient.name[0].given.join(" ") +
                        patient.name[0].family,
                    birthDate: dayjs(patient.birthDate).format("YYYY-MM-DD"),
                    gender: patient.gender,
                    deceasedDateTime: patient.deceasedDateTime,
                    deceasedBoolean: patient.deceasedBoolean,
                    managingOrganization: {
                        ...patient.managingOrganization,
                        reference:
                            patient.managingOrganization.reference.split(
                                "/",
                            )[1],
                    },
                    address: {
                        city: patient.address[0].city ?? "",
                        country: patient.address[0].country ?? "",
                        state: patient.address[0].state ?? "",
                        postalCode: patient.address[0].postalCode ?? "",
                        district: patient.address[0].district ?? "",
                    },
                    identifier,
                },
            };
            for (const obs of currentObservations) {
                results = { ...results, ...obs };
            }
            return results;
        }

        return [];
    });
}
