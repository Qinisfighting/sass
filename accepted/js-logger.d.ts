/**
 * # JavaScript Logger API: Draft 2
 *
 * *([Issue](https://github.com/sass/sass/issues/2979),
 * [Changelog](js-logger.changes.md))*
 *
 * ## Background
 *
 * > This section is non-normative.
 *
 * Currently, when Sass compilers in JS need to convey a message to the user
 * (whether from a `@warn` or `@debug` rule or from a Sass-internal warning),
 * they do so by printing that warning directly to the standard error stream.
 * This is a good default in that it's likely to surface the warnings to the end
 * user, but it's not adequate for all use-cases.
 *
 * For example, a build system might want to integrate Sass's messages into its
 * own messaging infrastructure. An IDE that's driving Sass through the JS API
 * might want to highlight warnings in the file the user is editing. If Sass is
 * ever run in the browser, the web page might want to surface warnings as
 * components on the page. As such, there's need for an API to provide users
 * with programmatic access to these messages.
 *
 * ## Summary
 *
 * > This section is non-normative.
 *
 * This proposal adds a `logger` option to Sass's JS API. This option takes an
 * object that can contain a `warn` callback and/or a `debug` callback. The
 * `warn` callback is called for both `@warn` rules and warnings generated by
 * Sass itself, and the `debug` callback is called for `@debug` rules.
 *
 * In addition to being passed the text of the messages, these callbacks receive
 * `SourceSpan` objects that indicate where in the Sass file the message was
 * generated. The `warn` callback may also receive a Sass stack trace and a flag
 * indicating whether the warning is specifically a deprecation warning.
 *
 * ### Design Decisions
 *
 * #### Separate Logger Object
 *
 * This proposal defines a `Logger` interface that has its own `warn` and
 * `debug` fields. Another alternative would have been to add both `warn` and
 * `debug` to the `Options` interface directly. We chose to define a separate
 * interface to open the possibility for libraries to expose re-usable `Logger`
 * objects, or even to wrap `Logger`s with decorator functions.
 */

/* ## API */

import {URL} from 'url';

import '../spec/js-api';
import './new-js-api';

declare module '../spec/js-api/legacy/options' {
  interface _Options {
    /**
     * An object that provides callbacks for the compiler to use in lieu of its
     * default messaging behavior.
     *
     * The compiler must treat an `undefined` logger identically to an object
     * that doesn't have `warn` or `debug` fields.
     */
    logger?: Logger;
  }
}

declare module '../new-js-api' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Options<sync extends 'sync' | 'async'> {
    /**
     * An object that provides callbacks for the compiler to use in lieu of its
     * default messaging behavior.
     *
     * The compiler must treat an `undefined` logger identically to an object
     * that doesn't have `warn` or `debug` fields.
     */
    logger?: Logger;
  }
}

/**
 * An object that provides callbacks for handling messages from the
 * compiler.
 */
export interface Logger {
  /**
   * If this field is defined, the compiler must invoke it under the following
   * circumstances:
   *
   * * When it encounters a `@warn` rule:
   *   * Let `value` be the result of evaluating the rule's expression.
   *   * Let `message` be `value`'s text if it's a string, or the result of
   *     serializing `value` if it's not.
   *   * Invoke `warn` with `message` and an object with `deprecation` set to
   *     `false` and `stack` set to a string representation of the current Sass
   *     stack trace.
   *
   *     > The specific format of the stack trace may vary from implementation
   *     > to implementation.
   *
   * * When it encounters anything else that the user needs to be warned about:
   *
   *   > This is intentionally vague about what counts as a warning.
   *   > Implementations have a considerable degree of flexibility in defining
   *   > this for themselves, although in some cases warnings are mandated by
   *   > the specification (such as in preparation for a breaking change).
   *
   *   * Let `options` be an empty object.
   *   * If this warning is caused by behavior that used to be allowed but will
   *     be disallowed in the future, set `options.deprecation` to `true`.
   *     Otherwise, set `options.deprecation` to `false`.
   *   * If this warning is associated with a specific span of a Sass
   *     stylesheet, set `options.span` to a `SourceSpan` that covers that span.
   *   * If this warning occurred during execution of a stylesheet, set
   *     `options.stack` to a string representation of the current Sass stack
   *     trace.
   *   * Invoke `warn` with a string describing the warning and `options`.
   *
   * If this field is defined, the compiler must not surface warnings in any way
   * other than inkoving `warn`.
   */
  warn?(
    message: string,
    options: {
      deprecation: boolean;
      span?: SourceSpan;
      stack?: string;
    }
  ): void;

  /**
   * If this field is defined, the compiler must invoke it when it encounters a
   * `@debug` rule using the following procedure:
   *
   * * Let `value` be the result of evaluating the rule's expression.
   * * Let `message` be `value`'s text if it's a string, or the result of
   *   serializing `value` if it's not.
   * * Invoke `debug` with `message` and an object with `span` set to the span
   *   covering the `@debug` rule and its expression.
   *
   * If this field is defined, the compiler must not surface debug messages in
   * any way other than invoking `debug`.
   */
  debug?(message: string, options: {span: SourceSpan}): void;
}

export namespace Logger {
  /** A Logger that does nothing when it warn or debug methods are called. */
  export const silent: Logger;
}

/**
 * An interface that represents a contiguous section ("span") of a text file.
 * This section may be empty if the `start` and `end` are the same location,
 * in which case it indicates a single position in the file.
 */
export interface SourceSpan {
  /**
   * The location of the first character of this span, unless `end` points to
   * the same character, in which case the span is empty and refers to the point
   * between this character and the one before it.
   */
  start: SourceLocation;

  /**
   * The location of the first character after this span. This must point to a
   * location after `start`.
   */
  end: SourceLocation;

  /**
   * The absolute URL of the file that this span refers to. For files on disk,
   * this must be a `file://` URL.
   *
   * This must be `undefined` for files that are passed to the compiler without
   * a URL. It must not be `undefined` for any files that are importable.
   */
  url?: URL;

  /**
   * The text covered by the span. This must be the text between `start.offset`
   * (inclusive) and `end.offset` (exclusive) of the file referred by this
   * span. Its length must be `end.offset - start.offset`.
   */
  text: string;

  /**
   * Additional source text surrounding this span.
   *
   * The compiler may choose to omit this. If it's not `undefined`, it must
   * contain `text`. Furthermore, `text` must begin at column `start.column` of
   * a line in `context`.
   *
   * > This usually contains the full lines the span begins and ends on if the
   * > span itself doesn't cover the full lines, but the specific scope is up to
   * > the compiler.
   */
  context?: string;
}

/**
 * An interface that represents a location in a text file.
 */
export interface SourceLocation {
  /**
   * The 0-based offset of this location within the file it refers to, in terms
   * of UTF-16 code units.
   */
  offset: number;

  /**
   * The number of U+000A LINE FEED characters between the beginning of the file
   * and `offset`, exclusive.
   *
   * > In other words, this location's 0-based line.
   */
  line: number;

  /**
   * The number of UTF-16 code points between the last U+000A LINE FEED
   * character before `offset` and `offset`, exclusive.
   *
   * > In other words, this location's 0-based column.
   */
  column: number;
}
