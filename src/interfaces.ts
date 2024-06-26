import { OptionBase } from "chakra-react-select";
import { Dictionary } from "lodash";
import type {
    ZodBoolean,
    ZodEffects,
    ZodLiteral,
    ZodNumber,
    ZodString,
} from "zod";
import z from "zod";
export type Extraction = "json" | "cell" | "column";
export type DataSource =
    | "api"
    | "json"
    | "go-data"
    | "csv-line-list"
    | "xlsx-line-list"
    | "xlsx-tabular-data"
    | "xlsx-form"
    | "dhis2-data-set"
    | "dhis2-indicators"
    | "dhis2-program-indicators"
    | "dhis2-program"
    | "manual-dhis2-program-indicators";
export type ImportType =
    | "individual"
    | "aggregate"
    | "organisation-units"
    | "users"
    | "metadata";

export interface Step {
    label: string;
    content: JSX.Element;
    id: number;
    nextLabel: string;
    lastLabel: string;
}

export interface INamed {
    id: string;
    name: string;
    description?: string;
}
export interface DHIS2DestinationOptions {
    chunkSize: number;
    async: boolean;
    completeDataSet: boolean;
}

export interface DHIS2SourceOptions {
    programStage: string[];
    ous: string[];
    period: Period[];
    useAnalytics: boolean;
    searchPeriod: "enrollmentDate" | "eventDate";
}

export type Update = {
    attribute: string;
    key: keyof RealMapping;
    value: any;
};
export type StageUpdate = Update & { stage: string };
export type StageMapping = {
    [key: string]: Mapping;
};

export type Processed = {
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
    enrollments: Array<Partial<Enrollment>>;
    events: Array<Partial<Event>>;
    trackedEntityInstanceUpdates: Array<Partial<TrackedEntityInstance>>;
    eventUpdates: Array<Partial<Event>>;
    errors: Array<any>;
    conflicts: Array<any>;
};
export interface CommonIdentifier {
    id: string;
    name: string;
    code: string;
}
export interface TrackedEntityType extends CommonIdentifier {
    featureType: string;
}

export interface DHIS2OrgUnit extends CommonIdentifier {
    parent: Partial<DHIS2OrgUnit>;
}

export const ValueType: {
    [key: string]:
        | ZodString
        | ZodBoolean
        | ZodNumber
        | ZodLiteral<true>
        | ZodEffects<ZodNumber, number, unknown>;
} = {
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
    NUMBER: z.preprocess(Number, z.number()),
    UNIT_INTERVAL: z.string(),
    PERCENTAGE: z.preprocess(Number, z.number().int().gte(0).lte(100)),
    INTEGER: z.preprocess(Number, z.number().int()),
    INTEGER_POSITIVE: z.preprocess(Number, z.number().int().positive().min(1)),
    INTEGER_NEGATIVE: z.preprocess(Number, z.number().int().negative()),
    INTEGER_ZERO_OR_POSITIVE: z.preprocess(Number, z.number().int().min(0)),
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
    headers: Record<string, Partial<Param>>;
    params: Record<string, Partial<Param>>;
}

export type MetadataOptions = {
    labelField: string;
    valueField: string;
    metadata: Option[];
    sourceType: "api" | "upload";
    idField: string;
    requiredField: string;
    dhis2: string;
    mapper: string;
};

export interface IProgramMapping {
    program: string;
    programType: string;
    trackedEntityType: string;
    customEnrollmentDateColumn: boolean;
    customIncidentDateColumn: boolean;
    createEnrollments: boolean;
    createEntities: boolean;
    updateEntities: boolean;
    enrollmentDateColumn: string;
    incidentDateColumn: string;
    metadataApiAuthentication: Partial<Authentication>;
    trackedEntityInstanceColumn: string;
    trackedEntityInstanceColumnIsManual: boolean;
    onlyEnrollOnce: boolean;
    metadataOptions: MetadataOptions;
    withoutRegistration: boolean;
    responseKey: string;
    remoteProgram: string;
    selectIncidentDatesInFuture: boolean;
    selectEnrollmentDatesInFuture: boolean;
    longitudeColumn: string;
    latitudeColumn: string;
    geometryColumn: string;
    geometryMerged: boolean;
    enrollmentLongitudeColumn: string;
    enrollmentLatitudeColumn: string;
    enrollmentGeometryColumn: string;
    enrollmentGeometryMerged: boolean;
}

export interface IAggregateMapping {
    dataSet: string;
    remote: string;
    dataElementColumn: string;
    periodColumn: string;
    attributeOptionComboColumn: string;
    categoryOptionComboColumn: string;
    categoryColumns: { [key: string]: string };
    valueColumn: string;
    attributionMerged: boolean;
    hasAttribution: boolean;
    indicatorGenerationLevel: string;
}

export interface IMapping {
    id: string;
    name: string;
    description: string;
    orgUnitColumn: string;
    isSource: boolean;
    created: string;
    useColumnLetters: boolean;
    lastUpdated: string;
    orgUnitSource: "api" | "manual" | "default";
    customOrgUnitColumn: boolean;
    authentication: Partial<Authentication>;
    orgUnitApiAuthentication: Partial<Authentication>;
    remoteOrgUnitLabelField: string;
    remoteOrgUnitValueField: string;
    orgUnitsUploaded: boolean;
    headerRow: number;
    dataStartRow: number;
    sheet: string;
    isCurrentInstance: boolean;
    prefetch: boolean;
    type: ImportType;
    destination: string;
    source: string;
    aggregate: Partial<IAggregateMapping>;
    program: Partial<IProgramMapping>;
    dataSource: DataSource;
    dhis2SourceOptions: Partial<DHIS2SourceOptions>;
    dhis2DestinationOptions: Partial<DHIS2DestinationOptions>;
    chunkSize: number;
}

export interface IProgramStage {
    id: string;
    name: string;
    displayName: string;
    repeatable: boolean;
    programStageDataElements: IProgramStageDataElement[];
    dataElementsFilter: string;
    featureType: string;
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
    optionSet: OptionSet;
    optionSetValue: boolean;
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
    trackedEntityType: TrackedEntityType;
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
    isCustom: boolean;
    mandatory: boolean;
    value: string;
    eventDateColumn: string;
    dueDateColumn: string;
    eventIdColumn: string;
    customDueDateColumn: boolean;
    customEventDateColumn: boolean;
    customEventIdColumn: boolean;
    createEmptyEvents: boolean;
    unique: boolean;
    createEvents: boolean;
    updateEvents: boolean;
    uniqueEventDate: boolean;
    stage: string;
    isSpecific: boolean;
    valueType: string;
    isOrgUnit: boolean;
    completeEvents: boolean;
    longitudeColumn: string;
    latitudeColumn: string;
    geometryColumn: string;
    geometryMerged: boolean;
    customType: string;
}

export interface Mapping {
    [key: string]: Partial<RealMapping>;
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
    geometry: any;
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
    events: Array<Partial<Event>>;
    attributes: Array<Partial<Attribute>>;
    storedBy: string;
    lastUpdatedAtClient: string;
    geometry: any;
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
    geometry: any;
}

export interface DataValue {
    lastUpdated: string;
    created: string;
    dataElement: string;
    value: string;
    providedElsewhere: boolean;
}

export interface ProgramOwner {
    ownerOrgUnit: string;
    program: string;
    trackedEntityInstance: string;
}

export interface Option extends OptionBase {
    label: string;
    value?: string;
    id?: string;
    code?: string;
    unique?: boolean;
    optionSetValue?: boolean;
    optionSet?: string;
    mandatory?: boolean;
    availableOptions?: Option[];
    valueType?: string;
    entity?: string;
    multiple?: boolean;
    isOrgUnit?: boolean;
    parent?: string;
    options?: Option[];
    allowFutureDate?: boolean;
}

export interface MultiOption extends OptionBase {
    options: Option[];
    label: string;
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
    intervalOfFollowUp: string;
    eventIdMask: string;
    checkLastContactDateAgainstDateOnSet: boolean;
    disableModifyingLegacyQuestionnaire: boolean;
    dbUpdatedAt: string;
}

interface ArcGisServer {
    name: string;
    url: string;
    type: string;
    styleUrl: string;
    styleUrlSource: string;
}

export interface CaseInvestigationTemplate {
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
    type: "aggregate" | "tracker";
    schedule: string;
    createdAt: string;
    nextRun: string;
    lastRun: string;
    additionalDays: number;
    schedulingSeverURL: string;
    description: string;
    immediate: boolean;
    mapping: string;
    updatedAt: string;
    status: "scheduled" | "running" | "stopped" | "created";
    url: string;
}

export type FlattenedEnrollment = Omit<Enrollment, "events">;

export type FlattenedInstance = Omit<
    TrackedEntityInstance,
    "attributes" | "events" | "enrollments"
> &
    Record<string, string> & {
        enrollment: Partial<FlattenedEnrollment>;
    };

export type FlattenedEvent = FlattenedInstance &
    Record<string, Omit<Event, "dataValues"> & Record<string, string>>;

export interface IGoDataData {
    firstName: string;
    middleName: string;
    lastName: string;
    wasContact: boolean;
    outcomeId: string;
    safeBurial: boolean;
    classification: string;
    dateInvestigationCompleted: string;
    transferRefused: boolean;
    questionnaireAnswers: QuestionnaireAnswers;
    vaccinesReceived: any[];
    id: string;
    outbreakId: string;
    visualId: string;
    dob?: string;
    gender: string;
    pregnancyStatus: boolean;
    riskLevel: string;
    riskReason: string;
    responsibleUserId: string;
    followUpTeamId: string;
    followUp: any;
    age: Age;
    occupation: string;
    documents: any[];
    addresses: Address[];
    dateOfReporting: string;
    isDateOfReportingApproximate: boolean;
    dateOfOnset: string;
    dateRanges: any[];
    isDateOfOnsetApproximate: boolean;
    dateBecomeCase: string;
    dateOfInfection: string;
    dateOfBurial: string;
    burialPlaceName: string;
    burialLocationId: string;
    classificationHistory: ClassificationHistory[];
    dateOfOutcome: string;
    hasRelationships: boolean;
    numberOfExposures: number;
    numberOfContacts: number;
    usualPlaceOfResidenceLocationId: string;
    // duplicateKeys: Fever;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    createdOn: string;
    deleted: boolean;
    // address: Fever;
}

interface ClassificationHistory {
    classification: string;
    startDate: string;
    endDate?: string;
}

export interface Address {
    typeId: string;
    locationId: string;
    geoLocationAccurate: boolean;
    date: string;
    phoneNumber: string;
}

export interface Age {
    years: number;
}

interface QuestionnaireAnswers {
    [key: string]: Array<Partial<GoValue>>;
}

interface GoValue {
    value: string | number | boolean;
}

export interface GoResponse {
    person: any[];
    epidemiology: any[];
    events: any[];
    relationships: any[];
    lab: any[];
    questionnaire: any[];
}

export interface GoDataEvent {
    visualId: string;
    name: string;
    endDate: string;
    description: string;
    address: Partial<Address>;
    id: string;
    date: string;
    numberOfExposures: number;
    numberOfContacts: number;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    deleted: boolean;
}

interface DataSetElement {
    dataElement: DataElement;
}

interface DataElement {
    code: string;
    name: string;
    id: string;
    categoryCombo: CategoryCombo;
}

interface CategoryCombo {
    categories: Category[];
    categoryOptionCombos: Category[];
}

interface Category {
    code: string;
    name: string;
    categoryOptions: CategoryOption[];
    id: string;
}

interface CategoryOption {
    code: string;
    name: string;
    id: string;
}

export interface IDataSet {
    code: string;
    name: string;
    dataSetElements: DataSetElement[];
    id: string;
    organisationUnits: DHIS2OrgUnit[];
    categoryCombo: CategoryCombo;
}

export type AggDataValue = {
    dataElement: string;
    period: string;
    orgUnit: string;
    categoryOptionCombo: string;
    attributeOptionCombo?: string;
    value: string;
};

export interface AggConflict {
    object: string;
    value: string;
    errorCode: string;
    property: string;
}

export type RelativePeriodType =
    | "DAILY"
    | "WEEKLY"
    | "BIWEEKLY"
    | "WEEKS_THIS_YEAR"
    | "MONTHLY"
    | "BIMONTHLY"
    | "QUARTERLY"
    | "SIXMONTHLY"
    | "FINANCIAL"
    | "YEARLY";

export type FixedPeriodType =
    | "DAILY"
    | "WEEKLY"
    | "WEEKLYWED"
    | "WEEKLYTHU"
    | "WEEKLYSAT"
    | "WEEKLYSUN"
    | "BIWEEKLY"
    | "MONTHLY"
    | "BIMONTHLY"
    | "QUARTERLY"
    | "QUARTERLYNOV"
    | "SIXMONTHLY"
    | "SIXMONTHLYAPR"
    | "SIXMONTHLYNOV"
    | "YEARLY"
    | "FYNOV"
    | "FYOCT"
    | "FYJUL"
    | "FYAPR";

export type FixedPeriod = {
    id: string;
    iso?: string;
    name: string;
    startDate: string;
    endDate: string;
};

export interface Period extends Option {
    startDate?: string;
    endDate?: string;
    type: "fixed" | "relative" | "range";
}

export type AggMetadata = {
    sourceOrgUnits: Array<Option>;
    destinationOrgUnits: Array<Option>;
    sourceColumns: Array<Option>;
    destinationColumns: Array<Option>;
    destinationCategories: Array<Option>;
    sourceCategories: Array<Option>;
    destinationCategoryOptionCombos: Array<Option>;
    sourceCategoryOptionCombos: Array<Option>;
};
export type Metadata = {
    sourceOrgUnits: Option[];
    destinationOrgUnits: Option[];
    sourceColumns: Option[];
    destinationColumns: Option[];
    sourceAttributes: Option[];
    destinationAttributes: Option[];
    sourceStages: Option[];
    destinationStages: Option[];
    uniqueAttributeValues: Array<Dictionary<any>>;
    epidemiology: Option[];
    case: Option[];
    questionnaire: Option[];
    events: Option[];
    lab: Option[];
    relationship: Option[];
    contact: Option[];
    trackedEntityInstanceIds: any[];
    destinationCategories: Option[];
    destinationCategoryOptionCombos: Option[];
    sourceCategoryOptionCombos: Option[];
    sourceCategories: Option[];
};

export interface GoDataOuTree {
    children: GoDataOuTree[];
    location: {
        id: string;
        name: string;
    };
}

export type DHIS2ProcessedData = {
    enrollments: Array<Partial<Enrollment>>;
    trackedEntityInstances: Array<Partial<TrackedEntityInstance>>;
    events: Array<Partial<Event>>;
    eventUpdates: Array<Partial<Event>>;
    trackedEntityInstanceUpdates: Array<Partial<TrackedEntityInstance>>;
    conflicts: any[];
    errors: any[];
};

export interface DHIS2Response {
    httpStatus: string;
    httpStatusCode: number;
    status: string;
    message: string;
    response: Response;
}

export interface Response {
    responseType: string;
    status: string;
    imported: number;
    updated: number;
    deleted: number;
    ignored: number;
    importOptions: ImportOptions;
    importSummaries: ImportSummary[];
    total: number;
}

export interface ImportSummary {
    responseType: string;
    status: string;
    importCount: ImportCount;
    conflicts: Conflict[];
    rejectedIndexes: any[];
    reference: string;
}

export interface Conflict {
    object: string;
    value: string;
}

interface ImportCount {
    imported: number;
    updated: number;
    ignored: number;
    deleted: number;
}

interface ImportOptions {
    idSchemes: IdSchemes;
    dryRun: boolean;
    async: boolean;
    importStrategy: string;
    mergeMode: string;
    reportMode: string;
    skipExistingCheck: boolean;
    sharing: boolean;
    skipNotifications: boolean;
    skipAudit: boolean;
    datasetAllowsPeriods: boolean;
    strictPeriods: boolean;
    strictDataElements: boolean;
    strictCategoryOptionCombos: boolean;
    strictAttributeOptionCombos: boolean;
    strictOrganisationUnits: boolean;
    strictDataSetApproval: boolean;
    strictDataSetLocking: boolean;
    strictDataSetInputPeriods: boolean;
    requireCategoryOptionCombo: boolean;
    requireAttributeOptionCombo: boolean;
    skipPatternValidation: boolean;
    ignoreEmptyCollection: boolean;
    force: boolean;
    firstRowIsHeader: boolean;
    skipLastUpdated: boolean;
    mergeDataValues: boolean;
    skipCache: boolean;
}

interface IdSchemes {}

export type PartialEvent = Partial<{
    eventDate: string;
    programStage: string;
    enrollment: string;
    trackedEntityInstance: string;
    program: string;
    orgUnit: string;
    event: string;
    dataValues: Dictionary<string>;
    geometry: any;
    status: string;
}>;

export type OtherProcessed = {
    newInserts: Array<any>;
    updates: Array<any>;
    events: Array<any>;
    labResults: { [key: string]: any };
};

export type DHIS2SOptions = keyof DHIS2SourceOptions;
export type DHIS2DOptions = keyof DHIS2DestinationOptions;
export type AggregateOptions = keyof IAggregateMapping;
export type ProgramOptions = keyof IProgramMapping;
export type AuthOptions = keyof Authentication;

export type KeyOptions =
    | DHIS2DOptions
    | DHIS2SOptions
    | AggregateOptions
    | ProgramOptions
    | AuthOptions;

export type SubKeys = keyof MetadataOptions;
export type ParamsOptions = keyof Param;

export type MappingEvent = {
    attribute: keyof IMapping;
    value: any;
    path?: KeyOptions;
    subPath?: SubKeys | AuthOptions | ParamsOptions | string;
};
