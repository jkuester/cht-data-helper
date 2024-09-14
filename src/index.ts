#!/usr/bin/env node
import { Command } from '@effect/cli';
import { NodeContext, NodeRuntime } from '@effect/platform-node';
import { Console, Effect, pipe } from 'effect';
import packageJson from '../package.json';

const chtx = Command.make('chtx', {}, () => pipe(
  'Hello world!',
  Console.log,
));

const cli = Command.run(chtx, {
  name: 'CHT Toolbox',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
  version: packageJson.version
});

// Prepare and run the CLI application
cli(process.argv)
  .pipe(
    Effect.provide(NodeContext.layer),
    NodeRuntime.runMain
  );
