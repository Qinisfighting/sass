import {PluginThis} from './plugin_this';

/**
 * The interface for the `this` keyword for custom importers. The implementation
 * must invoke importers with an appropriate `this`.
 */
interface ImporterThis extends PluginThis {
  /**
   * `true` if this importer invocation was caused by an `@import` statement and
   * `false` otherwise.
   *
   * > This allows importers to look for `.import.scss` stylesheets if and only
   * > if an `@import` is being resolved.
   */
  fromImport: boolean;
}

type _SyncImporter = (
  this: ImporterThis,
  url: string,
  prev: string
) => {file: string} | {contents: string};

type _AsyncImporter = (
  this: ImporterThis,
  url: string,
  prev: string,
  done: (data: {file: string} | {contents: string} | Error) => void
) => void;

export type LegacyImporter<sync = 'sync' | 'async'> =
  | _SyncImporter
  | (sync extends 'async' ? _AsyncImporter : never);
