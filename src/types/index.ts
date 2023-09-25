export interface Pager {
  page: number;
  total: number;
  pageSize: number;
  nextPage?: string;
  pageCount: number;
}

export interface DataValue {
  dataElement: string;
  value: string;
}

export interface Attribute {
  attribute: string;
  value: string;
}

export interface Dhis2Event {
  event: string;
  trackedEntityInstance: string;
  orgUnitName: string;
  programStage: string;
  eventDate: string;
  dataValues: Array<DataValue>;
}

export interface Dhis2Enrollment {
  orgUnitName: string;
  enrollmentDate: string;
}

export interface Dhis2TrackedEntityInstance {
  trackedEntityInstance: string;
  enrollments: Array<Dhis2Enrollment>;
  attributes: Array<Attribute>;
}

export interface ProgramConfig {
  [key: string]: ProgramMapping;
}

export interface AttributeColumMapping {
  attribute: string;
  column: string;
}

export interface EventColumnMapping {
  column?: string;
  programStage: string;
  dataElement: string;
}

export interface ProgramMapping {
  attributeColumns: Array<AttributeColumMapping>;
  eventColumns: Array<EventColumnMapping>;
}
