# LODIIS Raw Service Data Extractor

## Introduction

This is a node script that facilitates the extraction of LODIIS registration and service data from the DHIS2 instance.

## Getting started

### Requirements

To get started with the script, you need to have [node] (https://nodejs.org/en) downloaded.

### Installing packages

Packages can be installed using `npm` Or `yarn` using bellow commands:

```
npm install
```

Or

```
yarn install
```

### Setting environment variables

Environment variables can be set by creating `.env` file with contents similar as `.env.example` Or as shown below:

```
DHIS2_BASE_URL=<url-for-dhis2-instance>
DHIS2_USERNAME=<dhis2-username>
DHIS2_PASSWORD=<dhis2-password>
```

Note:

- Below is the definition of the above variables:
  - DHIS2_BASE_URL: This is the url to the DHIS2 instance.
  - DHIS2_USERNAME: This is the username for accessing the DHIS2 instance.
  - DHIS2_PASSWORD: This is the password for accessing the DHIS2 instance.

### Running the script

The script can be run using either `node` as show bellow with date format: YYYY-MM-DD:

```
node index.js extract-events extract-events --program=<program-id> --startDate=<start-date> --endDate=<end-date>
```

**NOTE**: The the `startDate` argument is mandatory, where as the `endDate` date is optional and set to default as the current date.
