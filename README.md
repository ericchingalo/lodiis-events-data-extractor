# LODIIS Raw Service Data Extractor

## Introduction

This script, written in Node.js with TypeScript, facilitates the extraction of LODIIS registration and service data from the DHIS2 instance.

## Tooling

This script uses the following basic packages as basic toolings:

- Commander: This is a tool to improve the script user experience when using the
  script. [Learn more](https://www.npmjs.com/package/commander)
- Winston: A tool for logging different information within the
  script. [Learn more](https://www.npmjs.com/package/winston)
- Axios: An HTTP client for accessing DHIS2 API resources Or any HTTP
  resources. [Learn more](https://www.npmjs.com/package/axios)
- Luxon: A javascript package for manipulating time. [Learn more](https://www.npmjs.com/package/luxon)
- Lodash: A javascript package for manipulating objects and arrays. [Learn more](https://www.npmjs.com/package/lodash)
- xlsx: A Javascript library for manipulating Excel and CSV files. [Learn more](https://www.npmjs.com/package/xlsx)
- Joi: A Javascript library for performing validations of objects. [Learn more](https://www.npmjs.com/package/joi)

## Getting started

### Cloning the project

The source code can be cloned from [github](https://github.com/hisptz/lodiis-raw-service-data-extractor) using:

```
git clone https://github.com/hisptz/lodiis-raw-service-data-extractor
```

### Installing packages

Packages can be installed using `npm` Or `yarn` using below commands:

```
npm install
```

Or

```
yarn install
```

### Setting environment variables

Environment variables can be set by creating `.env` file with contents similar to `.env.example` Or as shown below:

```
DHIS2_BASE_URL=<url-for-dhis2-instance>
DHIS2_USERNAME=<dhis2-username>
DHIS2_PASSWORD=<dhis2-password>
```

Note:

- Below is the definition of the above variables:
  - DHIS2_BASE_URL: This is the URL to the DHIS2 instance.
  - DHIS2_USERNAME: This is the username for accessing the DHIS2 instance.
  - DHIS2_PASSWORD: This is the password for accessing the DHIS2 instance.

### Running the script

The script can be run using either `npm` Or `yarn` as shown below with the date format: YYYY-MM-DD:

```
npm run extract-events --program=<program-id> --startDate=<start-date> --endDate=<end-date>
```

Or

```
yarn extract-events --program=<program-id> --startDate=<start-date> --endDate=<end-date>
```

**NOTE**: 
- The `startDate` argument is mandatory, whereas the `endDate` date is optional and set to default as the current date.
- The `program` key allows single or multiple comma-separated program IDs.

## Building

The script can be built using `npm` Or `yarn` as shown below:

```
npm run build
```

Or

```
yarn build
```

## Updating the Template column mapping.

The mapping for the template of the data files is configurable. The configurations can be found on the `src/config/columns.ts`. The structure of the program mapping can be seen tomorrow:
```
import { ProgramConfig } from "../types";

export const columnMappings: ProgramConfig = {
  <program-id> : {
    attributeColumns: [
         {
          attribute: "<attribute-id>",
          column: "<column-name>",
        },
        ...
    ],
   eventColumns: [
         {
          column: "<column-name>",
          dataElement: "<data-element-id>",
          programStage: "<program-stage-id>",
        },
        ...
    ],
  },
  ...
};

```

From the above `attributeColumns` represents the bio details of the beneficiaries where as `eventColumns` represents the services that these beneficiaries have received. These mapping takes the DHIS2 events data or bio-data and converts them into the Excel template columns.
