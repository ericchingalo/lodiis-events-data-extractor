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
  dataValues: DataValue[];
}

export interface Dhis2TrackedEntityInstance {
  trackedEntityInstance: string;
}
