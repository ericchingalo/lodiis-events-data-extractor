import * as XLSX from "xlsx";
import { DateTime } from "luxon";
import { groupBy, keys, uniq, chunk, map, find } from "lodash";

import logger from "../logging";
import {
  Attribute,
  DataValue,
  Dhis2Event,
  Dhis2TrackedEntityInstance,
} from "../types";
import dhis2Client from "../clients/dhis2";
import { columnMappings } from "../configs/columns";

interface EventExtractionArguments {
  startDate?: string;
  endDate?: string;
  program: string;
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
  startDate = startDate ?? DateTime.now().toISODate() ?? "";
  endDate = endDate ?? DateTime.now().toISODate() ?? "";
  logger.info(
    `Evaluating event for ${program} program from ${startDate} to ${endDate}`
  );

  try {
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

    saveDataToFile(beneficiaries, startDate, endDate);
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
    const { attributes, trackedEntityInstance } = trackedEntityInstanceObject;
    const events = groupedEventsByTrackedEntityInstances[trackedEntityInstance];

    const attributeAttributeColumns = getIdentifiers(attributes, program);
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

function getIdentifiers(
  attributes: Attribute[],
  program: string
): { [key: string]: string } {
  let data = {};
  const { attributeColumns } = columnMappings[program];
  for (const attributeColumn of attributeColumns) {
    const { attribute: attributeId, column } = attributeColumn;
    const attribute = find(
      attributes,
      ({ attribute }) => attribute === attributeId
    );
    data = { ...data, [column]: attribute?.value ?? "" };
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
    const { programStage, column, dataElement } = eventColumn;
    const programStagesEvents = groupedEventsByProgramStage[programStage];
    const sepator = "-";
    let value = "";
    for (const event of programStagesEvents ?? []) {
      const { dataValues } = event;
      value = dataElement
        .split(sepator)
        .map((de: string) => {
          const dataValue =
            find(
              dataValues,
              (dataValue: DataValue) => de === dataValue.dataElement
            )?.value ?? "";

          return !dataElement.includes("-")
            ? ["Yes", "1", "true"].includes(dataValue)
              ? "Yes"
              : ["No", "0", "false"].includes(dataValue)
              ? ""
              : dataValue
            : dataValue;
        })
        .join(sepator);

      if (dataElement.includes("-") && value.length > 1) {
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
    }
  }

  return data;
}

function saveDataToFile(
  data: BeneficiaryData[],
  startDate: string,
  endDate: string
) {
  logger.info("Saving the extracted data into the file");
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    const fileName = `Service Data from ${startDate} ot ${endDate}.xlsx`;

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
  const url = `trackedEntityInstances.json?ouMode=ACCESSIBLE&program=${program}&fields=trackedEntityInstance,attributes[attribute,value],enrollments[orgUnitName]`;

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
          `Failed to fetch Trakced entity instances due to HTTP status: ${status}`
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
  const url = `events.json?ouMode=ACCESSIBLE&startDate=${startDate}&endDate=${endDate}&program=${program}&fields=event,trackedEntityInstance,orgUnitName,programStage,eventDate,dataValues[dataElement,value]&totalPages=true&pageSize=${EVENTS_PAGE_SIZE}`;
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
