import { fromPairs } from "lodash";
import {
    Authentication,
    GoDataEvent,
    GODataTokenGenerationResponse,
    IGoData,
    IGoDataData,
} from "./interfaces";
import { fetchRemote, getToken } from "./utils";

export const fetchGoDataData = async (
    goData: Partial<IGoData>,
    authentication: Partial<Authentication>,
) => {
    const {
        params,
        basicAuth,
        hasNextLink,
        headers,
        password,
        username,
        ...rest
    } = authentication;
    const response = await getToken<GODataTokenGenerationResponse>(
        authentication,
        "email",
        "password",
        "api/users/login",
    );
    const prev = await fetchRemote<Array<Partial<IGoDataData>>>(
        rest,
        `api/outbreaks/${goData.id}/cases`,
        {
            auth: {
                param: "access_token",
                value: response.id,
                forUpdates: false,
            },
        },
    );

    const allPrev = fromPairs(prev.map(({ visualId, id }) => [id, visualId]));

    const prevQuestionnaire = prev.map(
        ({ id, visualId, questionnaireAnswers }) => ({
            ...questionnaireAnswers,
            id,
            visualId,
        }),
    );

    const prevEpidemiology = prev.map(
        ({
            id,
            visualId,
            classification,
            dateOfOnset,
            isDateOfOnsetApproximate,
            dateBecomeCase,
            dateOfInfection,
            outcomeId,
            dateOfOutcome,
            transferRefused,
            dateRanges,
            dateOfBurial,
            burialPlaceName,
            burialLocationId,
            safeBurial,
        }) => ({
            classification,
            visualId,
            id,
            dateOfOnset: dateOfOnset ? dateOfOnset.slice(0, 10) : undefined,
            isDateOfOnsetApproximate,
            dateBecomeCase: dateBecomeCase
                ? dateBecomeCase.slice(0, 10)
                : undefined,
            dateOfInfection: dateOfInfection
                ? dateOfInfection.slice(0, 10)
                : undefined,
            outcomeId,
            dateOfOutcome: dateOfOutcome
                ? dateOfOutcome.slice(0, 10)
                : undefined,
            transferRefused,
            dateRanges,
            dateOfBurial: dateOfBurial ? dateOfBurial.slice(0, 10) : undefined,
            burialPlaceName,
            burialLocationId,
            safeBurial,
        }),
    );

    const prevPeople = prev.map(
        ({
            id,
            visualId,
            firstName,
            middleName,
            lastName,
            age,
            dob,
            gender,
            pregnancyStatus,
            occupation,
            riskLevel,
            riskReason,
            dateOfReporting,
            isDateOfReportingApproximate,
            responsibleUserId,
            followUpTeamId,
            followUp,
            vaccinesReceived,
            documents,
            addresses,
        }) => ({
            id,
            visualId,
            firstName,
            middleName,
            lastName,
            age,
            dob: dob ? dob.slice(0, 10) : undefined,
            gender,
            pregnancyStatus,
            occupation,
            riskLevel,
            riskReason,
            dateOfReporting: dateOfReporting
                ? dateOfReporting.slice(0, 10)
                : undefined,
            isDateOfReportingApproximate,
            responsibleUserId,
            followUpTeamId,
            followUp,
            vaccinesReceived,
            documents,
            addresses,
        }),
    );

    const prevEvents = await fetchRemote<Array<Partial<GoDataEvent>>>(
        rest,
        `api/outbreaks/${goData.id}/events`,
        {
            auth: {
                param: "access_token",
                value: response.id,
                forUpdates: false,
            },
        },
    );

    const labResponse = await Promise.all(
        prev.map(({ id }) =>
            fetchRemote<Array<any>>(
                rest,
                `api/outbreaks/${goData.id}/cases/${id}/lab-results`,
                {
                    auth: {
                        param: "access_token",
                        value: response.id,
                        forUpdates: false,
                    },
                },
            ),
        ),
    );

    const prevLab = labResponse.flat().map(({ personId, ...rest }) => ({
        ...rest,
        personId,
        visualId: allPrev[personId],
        dateSampleTaken: rest.dateSampleTaken
            ? rest.dateSampleTaken.slice(0, 10)
            : undefined,
        dateSampleDelivered: rest.dateSampleDelivered
            ? rest.dateSampleDelivered.slice(0, 10)
            : undefined,
        dateTesting: rest.dateTesting
            ? rest.dateTesting.slice(0, 10)
            : undefined,
        dateOfResult: rest.dateOfResult
            ? rest.dateOfResult.slice(0, 10)
            : undefined,
    }));
    return {
        metadata: {
            person: prevPeople,
            lab: prevLab,
            events: prevEvents,
            questionnaire: prevQuestionnaire,
            relationships: [],
            epidemiology: prevEpidemiology,
        },
        prev: allPrev,
    };
};
