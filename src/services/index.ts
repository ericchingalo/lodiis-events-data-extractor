import { DateTime } from "luxon";
import { groupBy, keys, uniq, chunk, map } from "lodash";

import logger from "../logging";
import { Dhis2Event, Dhis2TrackedEntityInstance } from "../types";
import dhis2Client from "../clients/dhis2";

interface EventExtractionArguments {
  startDate?: string;
  endDate?: string;
  program: string;
}

const EVENTS_PAGE_SIZE = 500;
const TEI_PAGE_SIZE = 50;

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

    const groupedEventsByTrackeEntityInstances = groupBy(
      events,
      "trackedEntityInstance"
    );

    const teiIds = uniq(keys(groupedEventsByTrackeEntityInstances));

    const trackedEntityInstances = await getTrackedEntityInstancesByIds(
      teiIds,
      program
    );

    console.log(JSON.stringify({ trackedEntityInstances, events }));
    // 3. Combine the payload events with tei data in rows.
  } catch (error) {
    logger.error(
      `Failed to evaluate events for ${program} program. Check the log below`
    );
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
  const url = `trackedEntityInstances.json?ouMode=ACCESSIBLE&program=${program}&fields=trackedEntityInstance,attributes[attribute,value]`;

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
    while (fetchingEventData) {
      const response = await getDhis2DataByPagination(url);
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

async function getOnlineEventsFromList() {}
