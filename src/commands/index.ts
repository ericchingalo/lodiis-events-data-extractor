import { Command } from "commander";
import Joi from "joi";
import logger from "../logging";
import { initializeEventsDataExtraction } from "../services";

const program = new Command();

const scriptParamsSchema = Joi.object({
  program: Joi.string().required().error(new Error("Program is required")),
  startDate: Joi.string()
    .required()
    .pattern(new RegExp("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))
    .error(
      new Error("Start date is mandatory and should be in YYYY-MM-DD format")
    ),
  endDate: Joi.string()
    .optional()
    .pattern(new RegExp("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))
    .error(
      new Error("End date is mandatory and should be in YYYY-MM-DD format")
    ),
});

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
    logger.info("Started the extraction of events data");

    const { error } = scriptParamsSchema.validate(args);

    if (error) {
      logger.warn(
        `Validation errors have occured while parsing the arguments. Check the logs below.`
      );
      logger.error(`Error: ${error.message}`);
      return;
    }

    const { startDate, endDate, program: programs } = args;

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
