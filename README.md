# cht-data-helper

Requires NodeJS `18+`.

## Installation

```shell
npm i -g git+https://github.com/jkuester/cht-data-helper.git
```

## Usage

```shell
❯ cht-data-helper --help

NAME
  cht-data-helper - Helper utility for managing data in a CHT instance.

SYNOPSIS
  cht-data-helper <action> <category> <flags>

ACTIONS
  purge - Purge data from the database

CATEGORIES
  reports - Perform action on reports
  
FLAGS
  -d, --date <date> - Date to use for the action  
```

Requires a `COUCH_URL` environment variable to be set. This can be done globally, in an `.env` file, or by setting it as a part of the command.

### Example execution

```shell
COUCH_URL=https://medic:password@192-168-1-248.my.local-ip.co:8443/medic cht-data-helper purge reports -d 2021-01-01
```

