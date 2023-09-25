import { Command } from "commander";
import logger from "../logging";
import { initializeEventsDataExtraction } from "../services";

const program = new Command();

program
  .command(`extract-events`)
  .description("Initiate data extraction")
  .option("-p --program <program>", "Program Id whose data needs to be fetched")
  .option("-s --startDate <startDate>", "Start date formatted as YYYY-MM-DD")
  .option("-e --endDate <endDate>", "End date formatted as YYYY-MM-DD")
  .action(async (args) => {
    let { startDate, endDate, program } = args ?? {};
    logger.info("Started the extraction of events data");
    await initializeEventsDataExtraction({
      program,
      startDate,
      endDate,
    });
  });
export default program;
