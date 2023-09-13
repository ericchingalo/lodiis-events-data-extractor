import { Command } from "commander";
import appDetails from "../../package.json";
import logger from "../logging";

const program = new Command();

program
  .command(`extract`)
  .description("Initiate data extraction")
  .action(async () => {
    logger.info("Started the extration of events data");
    //    TODO start data evaluation
  });
export default program;
