import * as XLSX from "xlsx";
import { DateTime } from "luxon";
import { groupBy, keys, uniq, chunk, map, find } from "lodash";

import logger from "../logging";
import {
  Attribute,
  DataValue,
  Dhis2Enrollment,
  Dhis2Event,
  Dhis2TrackedEntityInstance,
} from "../types";
import dhis2Client from "../clients/dhis2";
import { columnMappings } from "../configs/columns";

interface EventExtractionArguments {
  startDate: string;
  program: string;
  endDate?: string;
}

interface BeneficiaryData {
  [key: string]: string;
}

const EVENTS_PAGE_SIZE = 5000;
const TEI_PAGE_SIZE = 100;

export async function initializeEventsDataExtraction({
  startDate,
  endDate,
  program,
}: EventExtractionArguments) {
  try {
    endDate = endDate ?? DateTime.now().toISODate() ?? "";
    logger.info(
      `Evaluating event for ${program} program from ${startDate} to ${endDate}`
    );
    const events = await getOnlineEvents(startDate, endDate, program);

    const groupedEventsByTrackedEntityInstances = groupBy(
      events,
      "trackedEntityInstance"
    );

    const teiIds = uniq(keys(groupedEventsByTrackedEntityInstances));

    const trackedEntityInstances = await getTrackedEntityInstancesByIds(
      teiIds,
      program
    );

    const beneficiaries = getBeneficiariesMappedWithTheirEvents(
      program,
      groupedEventsByTrackedEntityInstances,
      trackedEntityInstances
    );

    saveDataToFile(beneficiaries, startDate, endDate, program);
  } catch (error) {
    logger.error(
      `Failed to evaluate events for ${program} program. Check the log below`
    );
    logger.error(JSON.stringify(error));
  }
}

function getBeneficiariesMappedWithTheirEvents(
  program: string,
  groupedEventsByTrackedEntityInstances: {
    [key: string]: Dhis2Event[];
  },
  trackedEntityInstances: Dhis2TrackedEntityInstance[]
): Array<BeneficiaryData> {
  logger.info("Generating data for export");
  const beneficiaries: Array<BeneficiaryData> = [];
  for (const trackedEntityInstanceObject of trackedEntityInstances) {
    const { attributes, trackedEntityInstance, enrollments } =
      trackedEntityInstanceObject;
    const events = groupedEventsByTrackedEntityInstances[trackedEntityInstance];

    const attributeAttributeColumns = getIdentifiers(
      attributes,
      enrollments,
      program
    );
    const ServiceColumns = getServiceColumns(events, program);

    beneficiaries.push({
      ...attributeAttributeColumns,
      ...sortByKeys(ServiceColumns),
    });
  }

  return beneficiaries;
}

function sortByKeys(unorderedData: { [key: string]: string }): {
  [key: string]: string;
} {
  return Object.keys(unorderedData)
    .sort()
    .reduce((object: { [key: string]: string }, key: string) => {
      object[key] = unorderedData[key];
      return object;
    }, {});
}

function sanitizeValue(value: string, codes?: Array<string>): string {
  if (codes && codes.length) {
    return codes.includes(value) ? "Yes" : "";
  }
  return ["Yes", "1", "true"].includes(value)
    ? "Yes"
    : ["No", "0", "false"].includes(value)
      ? ""
      : value;
}

function getIdentifiers(
  attributes: Attribute[],
  enrollments: Dhis2Enrollment[],
  program: string
): { [key: string]: string } {
  let data = {};
  const { attributeColumns } = columnMappings[program];
  for (const attributeColumn of attributeColumns) {
    const { attribute: attributeId, column } = attributeColumn;
    if (!["enrollmentDate", "orgUnitName"].includes(attributeId)) {
      const attribute = find(
        attributes,
        ({ attribute }) => attribute === attributeId
      );
      data = { ...data, [column]: sanitizeValue(attribute?.value ?? "") };
    } else {
      if (enrollments.length) {
        for (const enrollment of enrollments) {
          const { enrollmentDate, orgUnitName } = enrollment;
          data = {
            ...data,
            [column]:
              attributeId == "enrollmentDate"
                ? (enrollmentDate ?? "").split("T")[0]
                : attributeId == "orgUnitName"
                  ? orgUnitName ?? ""
                  : "",
          };
        }
      }
    }
  }
  return data;
}

function getServiceColumns(
  events: Dhis2Event[],
  program: string
): { [key: string]: string } {
  let data: { [key: string]: string } = {};
  const groupedEventsByProgramStage = groupBy(events, "programStage");

  const { eventColumns } = columnMappings[program];

  for (const eventColumn of eventColumns) {
    const { programStage, column, dataElement, codes } = eventColumn;
    const programStagesEvents = programStage
      ? groupedEventsByProgramStage[programStage]
      : events;
    const separator = "-";
    let value = "";
    for (const event of programStagesEvents ?? []) {
      const { dataValues } = event;

      if (dataElement === "service_from_referral") {
        if (column) {
          const value = getServiceFromReferral(dataValues, codes ?? []);
          data = {
            ...data,
            [column]: value,
          };
        }
      } else if (!["eventDate", "orgUnitName"].includes(dataElement)) {
        value = dataElement
          .split(separator)
          .map((de: string) => {
            const dataValue =
              find(
                dataValues,
                (dataValue: DataValue) => de === dataValue.dataElement
              )?.value ?? "";

            return !dataElement.includes(separator)
              ? sanitizeValue(dataValue, codes)
              : dataValue;
          })
          .join(separator);

        if (dataElement.includes(separator) && value.length > 1) {
          data = {
            ...data,
            [value]: "Yes",
          };
        } else if (column) {
          data = {
            ...data,
            [column]: value === "" && data[column] ? data[column] : value,
          };
        }
      } else if (column) {
        data = {
          ...data,
          [column]:
            dataElement == "eventDate"
              ? (event.eventDate ?? "").split("T")[0]
              : dataElement == "orgUnitName"
                ? event.orgUnitName ?? ""
                : "",
        };
      }
    }
  }

  return data;
}

function getServiceFromReferral(
  dataValues: Array<DataValue>,
  codes: string[]
): string {
  const communityServiceField = "rsh5Kvx6qAU";
  const facilityServiceField = "OrC9Bh2bcFz";
  const serviceProvidedField = "hXyqgOWZ17b";

  const isServiceProvided = find(
    dataValues,
    ({ dataElement }) => dataElement === serviceProvidedField
  );
  const providedService = find(
    dataValues,
    ({ dataElement, value }) =>
      [facilityServiceField, communityServiceField].includes(dataElement) &&
      value != ""
  );
  if (
    `${isServiceProvided?.value}` === "1" &&
    [communityServiceField, facilityServiceField].some(
      (referralService: string) => {
        return providedService?.value && codes.includes(providedService.value);
      }
    )
  ) {
    return "Yes";
  } else {
    return "";
  }
}

function saveDataToFile(
  data: BeneficiaryData[],
  startDate: string,
  endDate: string,
  program: string
) {
  logger.info("Saving the extracted data into the file");
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    const fileName = `LODIIS Data for ${program} from ${startDate} ot ${endDate}.xlsx`;

    XLSX.writeFile(workbook, fileName);

    logger.info(`Extracted data are saved on file ${fileName}`);
  } catch (error) {
    logger.error("Failed to save the file! Check the error message below");
    logger.error(JSON.stringify(error));
  }
}

async function getTrackedEntityInstancesByIds(
  teiIds: string[],
  program: string
): Promise<Dhis2TrackedEntityInstance[]> {
  let trackedEntityInstances: Dhis2TrackedEntityInstance[] = [];
  const teiIdGroups = map(chunk(teiIds, TEI_PAGE_SIZE), (teiList: string[]) =>
    teiList.join(";")
  );
  const url = `trackedEntityInstances.json?ouMode=ACCESSIBLE&program=${program}&fields=trackedEntityInstance,attributes[attribute,value],enrollments[enrollmentDate,orgUnitName]`;

  try {
    let index = 1;
    for (const teiList of teiIdGroups) {
      const response = await dhis2Client.get(
        `${url}&trackedEntityInstance=${teiList}`
      );
      const { data, status } = response;
      if (status === 200) {
        const { trackedEntityInstances: teis } = data;
        trackedEntityInstances = [
          ...trackedEntityInstances,
          ...(teis as Dhis2TrackedEntityInstance[]),
        ];
        logger.info(
          `Successfully fetched ${index} of ${teiIdGroups.length} pages of trackedEntityInstances`
        );
        index++;
      } else {
        logger.error(
          `Failed to fetch Tracked entity instances due to HTTP status: ${status}`
        );
      }
    }
  } catch (error) {
    logger.error(
      `Failed to evaluate tracked entity instances for ${program} program. Check the log below`
    );
    logger.error(JSON.stringify(error));
  }

  return trackedEntityInstances;
}

async function getOnlineEvents(
  startDate: string,
  endDate: string,
  program: string
): Promise<Dhis2Event[]> {
  const url = `events.json?ouMode=ACCESSIBLE&startDate=${startDate}&endDate=${endDate}&program=${program}&fields=event,trackedEntityInstance,orgUnitName,programStage,eventDate,dataValues[dataElement,value]&totalPages=true&pageSize=${EVENTS_PAGE_SIZE}&order=eventDate:ASC`;
  let events: Dhis2Event[] = [];

  try {
    let fetchingEventData = true;
    let page = 1;
    while (fetchingEventData) {
      const response = await getDhis2DataByPagination(url, page);
      const { data, status } = response;

      if (status === 200) {
        const { events: fetchedEvents, pager } = data;
        const { page, pageCount } = pager;
        fetchingEventData = pageCount > page;
        events = [...events, ...(fetchedEvents as Dhis2Event[])];
        logger.info(
          `Successfully fetched ${page} out of ${pageCount} pages of Events`
        );
      } else {
        fetchingEventData = false;
        logger.error(`Failed to fetch events due to HTTP status: ${status}`);
      }

      page++;
    }
  } catch (e) {
    logger.error(`Failed to fetch events! Check the logs below.`);
    logger.error(JSON.stringify(e));
  }

  return events;
}

async function getDhis2DataByPagination(url: string, page = 1): Promise<any> {
  return dhis2Client.get(`${url}&page=${page}`);
}
