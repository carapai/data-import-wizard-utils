import { z } from "zod";
import { OptionBase } from "chakra-react-select";

export interface IMapping {
    id: string;
    name: string;
    description: string;
}

export type Update = {
    attribute: string;
    value: any;
};
export type StageUpdate = Update & { stage: string };
export type StageMapping = {
    [key: string]: Mapping;
};

export type Processed = {
    trackedEntities: Array<Partial<TrackedEntityInstance>>;
    enrollments: Array<Partial<Enrollment>>;
    events: Array<Partial<Event>>;
    trackedEntityUpdates: Array<Partial<TrackedEntityInstance>>;
    eventsUpdates: Array<Partial<Event>>;
};
export interface CommonIdentifier {
    id: string;
    name: string;
    code: string;
}

export interface DHIS2OrgUnit extends CommonIdentifier {
    parent: Partial<DHIS2OrgUnit>;
}

export const ValueType = {
    TEXT: z.string(),
    LONG_TEXT: z.string(),
    LETTER: z.string().length(1),
    PHONE_NUMBER: z.string(),
    EMAIL: z.string().email(),
    BOOLEAN: z.boolean(),
    TRUE_ONLY: z.literal(true),
    DATE: z.string().regex(/^(\d{4})-(\d{2})-(\d{2})/),
    DATETIME: z
        .string()
        .regex(
            /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)((-(\d{2}):(\d{2})|Z)?)$/
        ),
    TIME: z.string().regex(/^(\d{2}):(\d{2})/),
    NUMBER: z.number(),
    UNIT_INTERVAL: z.string(),
    PERCENTAGE: z.number().int().gte(0).lte(100),
    INTEGER: z.number().int(),
    INTEGER_POSITIVE: z.number().int().positive().min(1),
    INTEGER_NEGATIVE: z.number().int().negative(),
    INTEGER_ZERO_OR_POSITIVE: z.number().int().min(0),
    TRACKER_ASSOCIATE: z.string().length(11),
    USERNAME: z.string(),
    COORDINATE: z.string(),
    ORGANISATION_UNIT: z.string().length(11),
    REFERENCE: z.string().length(11),
    AGE: z.string().regex(/^(\d{4})-(\d{2})-(\d{2})/),
    URL: z.string().url(),
    FILE_RESOURCE: z.string(),
    IMAGE: z.string(),
    GEOJSON: z.string(),
    MULTI_TEXT: z.string(),
};
export interface Param {
    param: string;
    value: string;
    forUpdates: boolean;
}
export interface Authentication {
    basicAuth: boolean;
    username: string;
    password: string;
    url: string;
    hasNextLink: boolean;
    headers: {
        [key: string]: Partial<Param>;
    };
    params: {
        [key: string]: Partial<Param>;
    };
}

export interface IProgramMapping extends IMapping {
    program: string;
    // id: string;
    // name: string;
    // displayName: string;
    // lastUpdated: any;
    programType: string;

    // programStages: IProgramStage[];
    // categoryCombo: string;
    // programTrackedEntityAttributes: any;
    trackedEntityType: string;
    // trackedEntity: string;
    // mappingId: string;
    // isRunning: boolean;
    orgUnitColumn: string;
    manuallyMapOrgUnitColumn: boolean;
    manuallyMapEnrollmentDateColumn: boolean;
    manuallyMapIncidentDateColumn: boolean;
    orgUnitsUploaded: boolean;
    // orgUnitStrategy: {
    //     value: "auto";
    //     label: "auto";
    // };
    // organisationUnits: IOrganisationUnit[];
    // headerRow: 1;
    // dataStartRow: 2;
    createEnrollments: boolean;
    createEntities: boolean;
    updateEntities: boolean;
    enrollmentDateColumn: string;
    incidentDateColumn: string;
    isSource: boolean;
    prefetch: boolean;
    authentication: Partial<Authentication>;
    orgUnitApiAuthentication: Partial<Authentication>;
    metadataApiAuthentication: Partial<Authentication>;
    trackedEntityInstanceColumn: string;
    trackedEntityInstanceColumnIsManual: boolean;
    remoteOrgUnitLabelField: string;
    remoteOrgUnitValueField: string;
    metadataOptions: {
        labelField: string;
        valueField: string;
        metadata: any[];
        sourceType: "api" | "upload";
        idField: string;
        requiredField: string;
        dhis2: string;
        mapper: string;
    };

    // dateFilter: string;
    // dateEndFilter: string;
    // lastRun: string;
    // uploaded: string;
    // uploadMessage: string;
    // page: number;
    // rowsPerPage: number;
    // dialogOpen: false;
    // orderBy: "mandatory";
    // order: "desc";
    // attributesFilter: string;

    // trackedEntityInstances: [];
    // fetchingEntities: 0;

    // responses: any[];

    // increment: 0;

    // errors: any[];
    // conflicts: any[];
    // duplicates: any[];

    // longitudeColumn: string;
    // latitudeColumn: string;

    // pulling: boolean;

    // workbook: null;

    // selectedSheet: null;

    // pulledData: null;

    // sheets: any[];

    dataSource: "xlsx" | "dhis2" | "api" | "csv" | "json" | "godata";

    // scheduleTime: 0;

    // percentages: any[];

    // total: number;
    // displayProgress: boolean;

    // username: string;
    // password: string;
    // params: any[];
    responseKey: string;
    // fileName: string;
    // mappingName: string;
    // mappingDescription: string;
    // templateType: string;
    // sourceOrganisationUnits: [];
    // message: string;
    // incidentDateProvided: boolean;
    // processed: boolean;
    // data: [];
    // isUploadingFromPage: boolean;

    // selectIncidentDatesInFuture: string;
    // selectEnrollmentDatesInFuture: string;
    isDHIS2: boolean;
    // attributes: boolean;
    // remotePrograms: [];
    remoteProgram: string;
    // remoteId: string;
    orgUnitSource: "api" | "manual" | "default";
    // enrollments: boolean;
    // events: boolean;
    // remoteStage: string;
    // remoteTrackedEntityTypes: {};
    created: string;
    lastUpdated: string;
}

export interface IProgramStage {
    id: string;
    name: string;
    displayName: string;
    repeatable: boolean;
    programStageDataElements: IProgramStageDataElement[];
    dataElementsFilter: string;
    page: number;
    rowsPerPage: number;
    orderBy: "compulsory";
    order: "asc" | "desc";
    eventDateIdentifiesEvent: false;
    completeEvents: false;
    longitudeColumn: string;
    latitudeColumn: string;
    createNewEvents: false;
    updateEvents: boolean;
    eventDateColumn: string;
    eventsByDate: {};
    eventsByDataElement: {};
}

export interface IProgramStageDataElement {
    compulsory: boolean;
    dataElement: IDataElement;
    allowFutureDate: boolean;
}

export interface IProgramTrackedEntityAttribute {
    valueType: string;
    mandatory: boolean;
    trackedEntityAttribute: ITrackedEntityAttribute;
    open: false;
    name: string;
    program: CommonIdentifier;
    sortOrder: number;
    allowFutureDate: boolean;
    displayShortName: string;
    displayName: string;
    id: string;
}
export interface ITrackedEntityAttribute extends CommonIdentifier {
    displayName: string;
    valueType: keyof typeof ValueType;
    confidential: boolean;
    unique: boolean;
    generated: boolean;
    pattern: string;
    optionSetValue: boolean;
    displayFormName: string;
    optionSet?: OptionSet;
}

export interface OptionSet {
    name: string;
    options: CommonIdentifier[];
    id: string;
}

export interface IDataElement extends CommonIdentifier {
    displayName: string;
    optionSet: boolean;
    optionSetValue: string;
    valueType: keyof typeof ValueType;
    zeroIsSignificant: boolean;
}
export interface IProgram {
    name: string;
    shortName: string;
    enrollmentDateLabel: string;
    incidentDateLabel: string;
    programType: string;
    displayIncidentDate: boolean;
    ignoreOverdueEvents: boolean;
    onlyEnrollOnce: boolean;
    selectEnrollmentDatesInFuture: boolean;
    selectIncidentDatesInFuture: boolean;
    trackedEntityType: CommonIdentifier;
    categoryCombo: CommonIdentifier;
    featureType: string;
    displayEnrollmentDateLabel: string;
    displayIncidentDateLabel: string;
    registration: boolean;
    withoutRegistration: boolean;
    displayShortName: string;
    displayFormName: string;
    displayName: string;
    id: string;
    attributeValues: any[];
    organisationUnits: DHIS2OrgUnit[];
    programStages: IProgramStage[];
    programSections: any[];
    programTrackedEntityAttributes: IProgramTrackedEntityAttribute[];
}

export interface RealMapping {
    manual: boolean;
    compulsory: boolean;
    value: string;
    eventDateColumn: string;
    unique: boolean;
    createEvents: boolean;
    updateEvents: boolean;
    eventDateIsUnique: boolean;
    eventIdColumn: string;
    stage: string;
    eventIdColumnIsManual: boolean;
}

export interface Mapping {
    [key: string]: Partial<RealMapping>;
}
export interface TrackedEntityInstance {
    created: string;
    orgUnit: string;
    createdAtClient: string;
    trackedEntityInstance: string;
    lastUpdated: string;
    trackedEntityType: string;
    potentialDuplicate: boolean;
    deleted: boolean;
    inactive: boolean;
    featureType: string;
    programOwners: ProgramOwner[];
    enrollments: Array<Partial<Enrollment>>;
    relationships: any[];
    attributes: Array<Partial<Attribute>>;
    lastUpdatedAtClient: string;
}

export interface Enrollment {
    createdAtClient: string;
    program: string;
    lastUpdated: string;
    created: string;
    orgUnit: string;
    enrollment: string;
    trackedEntityInstance: string;
    trackedEntityType: string;
    orgUnitName: string;
    enrollmentDate: string;
    followup: boolean;
    deleted: boolean;
    incidentDate: string;
    status: string;
    notes: any[];
    relationships: any[];
    events: Event[];
    attributes: Attribute[];
    storedBy: string;
    lastUpdatedAtClient: string;
}

export interface Attribute {
    lastUpdated: string;
    displayName: string;
    created: string;
    valueType: keyof typeof ValueType;
    attribute: string;
    value: string;
    code?: string;
    storedBy: string;
}

export interface Event {
    dueDate: string;
    // createdAtClient: string;
    program: string;
    event: string;
    programStage: string;
    orgUnit: string;
    enrollment: string;
    trackedEntityInstance: string;
    enrollmentStatus: string;
    status: string;
    eventDate: string;
    orgUnitName: string;
    attributeCategoryOptions: string;
    lastUpdated: string;
    created: string;
    // followup: boolean;
    deleted: boolean;
    attributeOptionCombo: string;
    dataValues: Array<Partial<DataValue>>;
    notes: any[];
    relationships: any[];
    storedBy: string;
}

export interface DataValue {
    lastUpdated: string;
    created: string;
    dataElement: string;
    value: string;
    providedElsewhere: boolean;
}

interface ProgramOwner {
    ownerOrgUnit: string;
    program: string;
    trackedEntityInstance: string;
}

export interface Option extends OptionBase {
    label: string;
    value: string;
    id?: string;
    code?: string;
    unique?: boolean;
    optionSetValue?: boolean;
    mandatory?: boolean;
    options?: CommonIdentifier[];
}

export interface IGoData {
    name: string;
    description: string;
    disease: string;
    countries: Country[];
    locationIds: string[];
    startDate: string;
    longPeriodsBetweenCaseOnset: number;
    periodOfFollowup: number;
    frequencyOfFollowUp: number;
    frequencyOfFollowUpPerDay: number;
    generateFollowUpsOverwriteExisting: boolean;
    generateFollowUpsKeepTeamAssignment: boolean;
    generateFollowUpsTeamAssignmentAlgorithm: string;
    generateFollowUpsDateOfLastContact: boolean;
    noDaysAmongContacts: number;
    noDaysInChains: number;
    noDaysNotSeen: number;
    noLessContacts: number;
    noDaysNewContacts: number;
    caseInvestigationTemplate: CaseInvestigationTemplate[];
    contactInvestigationTemplate: AdditionalQuestion2[];
    contactFollowUpTemplate: AdditionalQuestion2[];
    labResultsTemplate: any[];
    caseIdMask: string;
    contactIdMask: string;
    arcGisServers: ArcGisServer[];
    reportingGeographicalLevelId: string;
    isContactLabResultsActive: boolean;
    contactOfContactIdMask: string;
    isContactsOfContactsActive: boolean;
    isDateOfOnsetRequired: boolean;
    applyGeographicRestrictions: boolean;
    id: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    createdOn: string;
    deleted: boolean;
    locations: any[];
}

interface ArcGisServer {
    name: string;
    url: string;
    type: string;
    styleUrl: string;
    styleUrlSource: string;
}

interface CaseInvestigationTemplate {
    multiAnswer: boolean;
    inactive: boolean;
    text: string;
    variable: string;
    category: string;
    required: boolean;
    order: number;
    answerType: string;
    answersDisplay: string;
    answers: Answer[];
}

interface AdditionalQuestion5 {
    multiAnswer: boolean;
    inactive: boolean;
    text: string;
    variable: string;
    category: string;
    required: boolean;
    order: number;
    answerType: string;
    answersDisplay: string;
    answers: Answer4[];
}

interface Answer4 {
    label: string;
    value: string;
    alert: boolean;
    additionalQuestions?: (AdditionalQuestion4[] | null)[];
    order: number;
}

interface AdditionalQuestion4 {
    multiAnswer: boolean;
    inactive: boolean;
    text: string;
    variable: string;
    category: string;
    required: boolean;
    order: number;
    answerType: string;
    answersDisplay: string;
    answers: any[];
}

interface AdditionalQuestion3 {
    multiAnswer: boolean;
    inactive: boolean;
    text: string;
    variable: string;
    category: string;
    required: boolean;
    order: number;
    answerType: string;
    answersDisplay: string;
    answers: (Answer2 | Answers2)[];
}

interface Answers2 {
    label: string;
    value: string;
    alert: boolean;
    additionalQuestions?: AdditionalQuestion2[];
    order: number;
}

interface AdditionalQuestion2 {
    multiAnswer: boolean;
    inactive: boolean;
    text: string;
    variable: string;
    category: string;
    required: boolean;
    order: number;
    answerType: string;
    answersDisplay: string;
    answers: Answer[];
}

interface Answer2 {
    label: string;
    value: string;
    alert: boolean;
    additionalQuestions?: AdditionalQuestion[];
    order: number;
}

interface AdditionalQuestion {
    multiAnswer: boolean;
    inactive: boolean;
    text: string;
    variable: string;
    category: string;
    required: boolean;
    order: number;
    answerType: string;
    answersDisplay: string;
    answers: Answer[];
}

interface Answer {
    label: string;
    value: string;
    alert: boolean;
    additionalQuestions?: any;
    order: number;
}

interface Country {
    id: string;
}

export interface IGoDataOrgUnit {
    name: string;
    active: boolean;
    parentLocationId: string;
    geographicalLevelId: string;
    id: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    createdOn: string;
    deleted: boolean;
}

export interface GODataTokenGenerationResponse {
    id: string;
    ttl: number;
    created: string;
    userId: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    deleted: boolean;
}

export interface GODataOption {
    categoryId: string;
    value: string;
    description: string;
    readOnly: boolean;
    active: boolean;
    isDefaultReferenceData: boolean;
    id: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    createdOn: string;
    deleted: boolean;
}
export interface ISchedule {
    id: string;
    name: string;
    type: string;
    schedule: string;
    createdAt: string;
    nextRun: string;
    lastRun: string;
    additionalDays: number;
    schedulingSeverURL: string;
    description: string;
    immediate: boolean;
    upstream: string;
    mapping: string;
    updatedAt: string;
    status: "scheduled" | "running" | "stopped" | "created";
}
