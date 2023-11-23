import { Command } from "commander";
import logger from "../logging";
import { initializeEventsDataExtraction } from "../services";

const program = new Command();

program
  .command(`extract-events`)
  .description("Initiate data extraction")
  .option(
    "-p --program <program>",
    "Program Id whose data needs to be fetched, if multiple use comma-separation"
  )
  .option("-s --startDate <startDate>", "Start date formatted as YYYY-MM-DD")
  .option("-e --endDate <endDate>", "End date formatted as YYYY-MM-DD")
  .action(async (args: any) => {
    let { startDate, endDate, program: programs } = args ?? {};
    logger.info("Started the extraction of events data");

    if (!programs) {
      logger.info(`There is no program specified for data extraction`);
      return;
    }

    for (const program of (programs ?? "").split(",") as string[]) {
      logger.info(`Extracting events from ${program}`);
      await initializeEventsDataExtraction({
        program: program.trim(),
        startDate,
        endDate,
      });
    }
  });
export default program;
