import { IfhirR4 } from "@smile-cdr/fhirts";
import dayjs from "dayjs";
import { isArray } from "lodash";

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

    return encounters.flatMap((e) => {
        const currentEpisodeOfCare = episodeOfCares.find((a) => {
            if (isArray(e.episodeOfCare)) {
                return (
                    e.episodeOfCare.filter((e) => e.reference.includes(a.id))
                        .length > 0
                );
            } else {
                const episode: { reference: string } = e.episodeOfCare;
                return episode.reference.includes(a.id);
            }
        });

        if (currentEpisodeOfCare) {
            let results: Record<string, string> = {
                occurredAt: dayjs(e.period.start).format("YYYY-MM-DD"),
                enrollmentDate: dayjs(currentEpisodeOfCare.period.start).format(
                    "YYYY-MM-DD",
                ),
            };
            return results;
        }

        return [];
    });
}
