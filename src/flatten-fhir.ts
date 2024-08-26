import { IfhirR4 } from "@smile-cdr/fhirts";
import dayjs from "dayjs";
import { fromPairs, isArray } from "lodash";

export function flattenBundle(bundle: IfhirR4.IBundle) {
    const encounters: IfhirR4.IEncounter[] = [];
    const episodeOfCares: IfhirR4.IEpisodeOfCare[] = [];
    const observations: IfhirR4.IObservation[] = [];
    const patients: IfhirR4.IPatient[] = [];

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

        console.log(patient);

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

                return fromPairs(
                    observation.code.coding.map((a) => [a.code, realValue]),
                );
            }

            return [];
        });

        if (currentEpisodeOfCare) {
            let results: Record<string, string> = {
                occurredAt: dayjs(encounter.period.start).format("YYYY-MM-DD"),
                enrollmentDate: dayjs(currentEpisodeOfCare.period.start).format(
                    "YYYY-MM-DD",
                ),
            };

            for (const obs of currentObservations) {
                results = { ...results, ...obs };
            }
            return results;
        }

        return [];
    });
}
