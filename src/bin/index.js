#!/usr/bin/env node
const tui = require('../lib/tui');
const { purgeReportsAsOfDate } = require('../lib/purge');

const printUsage = () => {
  console.log(`
NAME
  cht-data-helper - Helper script for reviewing configuration when upgrading the CHT

SYNOPSIS
  cht-data-helper <action> <category> <flags>

ACTIONS
  purge - Purge data from the database

CATEGORIES
  reports - Perform action on reports
  
FLAGS
  -d, --date <date> - Date to use for the action  
`);
};

const getFlags = (args) => {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    console.log(args[i]);
    const flag = args[i];
    const value = args[i + 1];
    if (['-d', '--date'].includes(flag)) {
      flags.date = value;
    } else {
      throw new Error(`Unknown flag: ${flag}`);
    }
  }
  return flags;
};

const parseArgs = (args) => {
  if (args.length === 0) {
    return {};
  }
  if (args[0] === '--help') {
    return { help: true };
  }
  return {
    action: args[0],
    category: args[1],
    flags: getFlags(args.slice(2))
  };
};

(async () => {
  try {
    tui.init();
    const cmdArgs = parseArgs(process.argv.slice(2));
    if (cmdArgs.help) {
      printUsage();
      return;
    }
    if (cmdArgs.action === 'purge') {
      if (cmdArgs.category === 'reports') {
        await purgeReportsAsOfDate(cmdArgs.flags.date);
        return;
      }
    }
    console.error(`Unknown arguments: ${cmdArgs}`);
    process.exitCode = 1; // emit a non-zero exit code for scripting
  } catch (e) {
    console.error(e);
    process.exitCode = 1; // emit a non-zero exit code for scripting
  } finally {
    tui.close();
  }
})();
