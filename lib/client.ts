const baseUrl = 'https://api.biblia.com/v1/';

export const usageAcknowledgment = `<a href="https://biblia.com/"><img src="https://api.biblia.com/v1/PoweredByBiblia_small.png" alt="Powered by Biblia" /></a>
This site uses the <a href="https://biblia.com/">Biblia</a> web services from <a href="https://www.logos.com/">Logos Bible Software</a>.`;

// Different implementations of fetch have subtle incompatibilities with
// each other: in particular, node-fetch is missing a few bits that are
// described in the official spec. In order to be compatible with as many
// fetch implementations as possible, we declare the precise API surface
// that this library requires.
type FetchMethod<TBlob> = (
  input: string,
  init?: RequestInit
) => Promise<Response<TBlob>>;

type RequestInit = { method: string; headers: Record<string, string> };
type Response<TBlob> = {
  status: number;
  headers: {
    get: (header: string) => string | null;
  };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  blob: () => Promise<TBlob>;
};

type ClientOptions<TBlob> = {
  apiKey: string;
  fetch: FetchMethod<TBlob>;
};

type Validator<T> = (value: any) => value is T;
type ValidationFactory<T> = (optionName: string) => Validator<T>;

type OptionalValidationFactory<T> = ValidationFactory<T> & {
  optional: ValidationFactory<T | undefined>;
};

type ValidatorType<T> = T extends ValidationFactory<infer R> ? R : never;

function expectContentType(
  response: Response<any>,
  ...expectedTypes: string[]
) {
  const contentType = (response.headers.get('Content-Type') || '').split(
    ';',
    2
  )[0];

  if (!expectedTypes.includes(contentType)) {
    throw new Error(`Unexpected response Content-Type: ${contentType}`);
  }
}

async function expectJsonResult<TResult extends Record<string, unknown>>(
  response: Response<any>
) {
  expectContentType(response, 'application/json');

  return (await response.json()) as TResult;
}

function createJsonResultParser<TResult extends Record<string, unknown>>() {
  return (response: Response<any>) => expectJsonResult<TResult>(response);
}

async function expectTextResult(response: Response<any>) {
  expectContentType(response, 'text/html', 'text/plain');

  return await response.text();
}

async function expectImageResult<TBlob>(response: Response<TBlob>) {
  expectContentType(response, 'image/jpeg');

  return await response.blob();
}

function createEndpoint<TResult, TOptions, TBlob>(
  fetch: FetchMethod<TBlob>,
  validateOptions: Validator<TOptions>,
  renderUrl: (options: TOptions) => string,
  transformResponse: (response: Response<TBlob>) => Promise<TResult>
) {
  return async (options: TOptions) => {
    validateOptions(options);

    const response = await fetch(renderUrl(options));

    // TODO: Add a richer vocabulary of errors.
    if (response.status !== 200) {
      throw response;
    }

    return await transformResponse(response);
  };
}

type Validators = Record<string, ValidationFactory<any>>;

type OptionsBase = Record<string, unknown>;

type RecordEntries<T extends OptionsBase> = {
  [Key in keyof T]: [Key, T[Key]];
}[keyof T & string];

function smartEntries<T extends Record<string, unknown>>(value: T) {
  return Object.entries(value) as RecordEntries<T>[];
}

function createOptionsValidator<T extends Validators>(validators: T) {
  type OptionsValidators = {
    [Key in keyof T]: ReturnType<T[Key]>;
  };

  type UndefinedProperties<T> = {
    [P in keyof T]-?: undefined extends T[P] ? P : never;
  }[keyof T];

  type ToOptional<T> = Partial<Pick<T, UndefinedProperties<T>>> &
    Pick<T, Exclude<keyof T, UndefinedProperties<T>>>;

  type Recombine<T> = { [Key in keyof T]: T[Key] };

  type Options = Recombine<
    ToOptional<{
      [Key in keyof T & string]: ValidatorType<T[Key]>;
    }>
  >;

  const validateFunctions = Object.assign(
    {},
    ...smartEntries(validators).map(([key, createValidator]) => ({
      [key]: createValidator(key),
    }))
  ) as OptionsValidators;

  return function validate(options: Options): options is Options {
    if (!options) {
      throw new Error('Options is required.');
    }

    for (const key in options) {
      if (!validateFunctions[key]) {
        throw new Error(`Option ${key} is not supported.`);
      }
    }

    for (const [key, validate] of Object.entries(validateFunctions)) {
      const value = options[key as keyof Options];

      validate(value);
    }

    return true;
  };
}

function allowOptional<T>(fn: ValidationFactory<T>) {
  const result = fn as OptionalValidationFactory<T>;

  result.optional = optionName => {
    const validate = fn(optionName);

    return (value: any): value is T | undefined => {
      if (value === undefined) {
        return true;
      }

      return validate(value);
    };
  };

  return result;
}

function validateEnumMembership<T extends string[]>(...values: T) {
  const valuesHash = Object.assign(
    {},
    ...values.map(value => ({ [value.toLowerCase()]: true }))
  ) as { [Key: string]: boolean };

  return allowOptional(optionName => {
    const errorMessage = `Option ${optionName} must be one of ${values.join(
      ', '
    )}.`;

    return function validate(value): value is T[number] {
      if (typeof value !== 'string' || !valuesHash[value.toLowerCase()]) {
        throw new Error(errorMessage);
      }

      return true;
    };
  });
}

const validateIsString = allowOptional(optionName => {
  const errorMessage = `Option ${optionName} must be a string.`;

  return function validateString(value): value is string {
    if (typeof value !== 'string') {
      throw new Error(errorMessage);
    }

    return true;
  };
});

const validateIsBoolean = allowOptional(optionName => {
  const errorMessage = `Option ${optionName} must be a boolean.`;

  return function validateString(value): value is boolean {
    if (typeof value !== 'boolean') {
      throw new Error(errorMessage);
    }

    return true;
  };
});

const validateIsNumber = allowOptional(optionName => {
  const errorMessage = `Option ${optionName} must be a number.`;

  return function validateString(value): value is number {
    if (typeof value !== 'number') {
      throw new Error(errorMessage);
    }

    return true;
  };
});

const availableBibles = [
  'asv',
  'arvandyke',
  'kjv',
  'lsg',
  'byz',
  'darby',
  'elzevir',
  'itdiodati1649',
  'emphbbl',
  'kjv1900',
  'kjvapoc',
  'leb',
  'scrmorph',
  'fi-raamattu',
  'rvr60',
  'rva',
  'bb-sbb-rusbt',
  'eo-zamenbib',
  'tr1881',
  'tr1894mr',
  'svv',
  'stephens',
  'tanakh',
  'wbtc-ptbrnt',
  'wh1881mr',
  'ylt',
] as const;

export type AvailableBible = (typeof availableBibles)[number];

const bibleVersionValidator = validateEnumMembership(...availableBibles);

const validateBibleContentOptions = createOptionsValidator({
  bible: bibleVersionValidator,
  passage: validateIsString,
  format: validateEnumMembership('txt', 'html', 'txt', 'html'),
  style: validateEnumMembership(
    'fullyFormatted',
    'oneVersePerLine',
    'oneVersePerLineFullReference',
    'quotation',
    'simpleParagraphs',
    'bibleTextOnly',
    'orationOneParagraph',
    'orationOneVersePerLine',
    'orationBibleParagraphs',
    'fullyFormattedWithFootnotes'
  ).optional,
  formatting: validateIsString.optional,
  redLetter: validateIsBoolean.optional,
  footnotes: validateIsBoolean.optional,
  citation: validateIsBoolean.optional,
  paragraphs: validateIsBoolean.optional,
  fullText: validateIsBoolean.optional,
  header: validateIsString.optional,
  eachVerse: validateIsString.optional,
  footer: validateIsString.optional,
});

const pagingOptions = {
  start: validateIsNumber.optional,
  limit: validateIsNumber.optional,
};

const validateSearchOptions = createOptionsValidator({
  bible: bibleVersionValidator,
  query: validateIsString,
  mode: validateEnumMembership('verse', 'fuzzy').optional,
  passages: validateIsString.optional,
  preview: validateEnumMembership('none', 'text', 'html').optional,
  sort: validateEnumMembership('relevance', 'passage').optional,
  ...pagingOptions,
});

const validateSpecificBibleOptions = createOptionsValidator({
  bible: bibleVersionValidator,
});

const validateFindOptions = createOptionsValidator({
  query: validateIsString.optional,
  strictQuery: validateIsBoolean.optional,
  ...pagingOptions,
});

const validateParseOptions = createOptionsValidator({
  passage: validateIsString,
  style: validateEnumMembership('short', 'medium', 'long').optional,
});

const validateScanOptions = createOptionsValidator({
  text: validateIsString,
  tagChapters: validateIsBoolean.optional,
});

const validateTagOptions = createOptionsValidator({
  text: validateIsString.optional,
  url: validateIsString.optional,
  tagFormat: validateIsString.optional,
  tagChapters: validateIsBoolean.optional,
});

const validateCompareOptions = createOptionsValidator({
  first: validateIsString,
  second: validateIsString,
});

type BibleBook = string;
type FullBibleReference = string;

export function createBibliaApiClient<TBlob>({
  apiKey,
  fetch,
}: ClientOptions<TBlob>) {
  type BibleName =
    | (typeof bibleVersionValidator extends OptionalValidationFactory<infer T>
        ? T
        : never)
    | never;

  type TableOfContentsChapter = {
    passage: FullBibleReference;
  };

  type TableOfContentsBook = {
    passage: BibleBook;
    chapters: TableOfContentsChapter[];
  };

  type TableOfContentsResponse = {
    books: TableOfContentsBook[];
  };

  type BibleMetadata = {
    bible: BibleName;
    title: string;
    abbreviatedTitle: string;
    publicationDate: string;
    languages: string[];
    publishers: string[];
    imageUrl: string;
    description: string;
    searchFields: string[];
    copyright: string;
    extendedCopyright: string;
  };

  type FindBiblesResponse = {
    bibles: BibleMetadata[];
  };

  type SearchResult = {
    title: FullBibleReference;
    preview?: string;
  };

  type SearchResponse = {
    resultCount: number;
    hitCount: number;
    start: number;
    limit: number;
    results: SearchResult[];
  };

  type ParsedPassage = {
    passage: FullBibleReference;
    parts: {
      book: BibleBook;
      chapter?: number;
      verse?: number;
      endBook?: BibleBook;
      endChapter?: number;
      endVerse?: number;
    };
    index: number;
    length: number;
  };

  type ParseResponse = {
    passage: FullBibleReference;
    passages: ParsedPassage[];
  };

  type ScannedPassage = {
    passage: FullBibleReference;
    textIndex: number;
    textLength: number;
  };

  type ScanResponse = {
    results: ScannedPassage[];
  };

  type TagResponse = {
    text: string;
  };

  type CompareResponse = {
    equal: boolean;
    intersects: boolean;
    compare: number;
    startToStart: number;
    startToEnd: number;
    endToStart: number;
    endToEnd: number;
    after: boolean;
    before: boolean;
    subset: boolean;
    strictSubset: boolean;
    superset: boolean;
    strictSuperset: boolean;
  };

  function createUrlTemplate<TNames extends string[]>(
    urlParts: TemplateStringsArray,
    ...names: TNames
  ) {
    for (const name of names) {
      if (typeof name !== 'string') {
        throw new Error(`All names must be strings, but ${name} is not.`);
      }
    }

    const beginning = baseUrl + urlParts[0];
    const namesHash = Object.assign(
      {},
      ...names.map(name => ({ [name]: true }))
    ) as Record<string, boolean>;

    return function renderUrl(
      options: Record<string, number | boolean | string | undefined>
    ) {
      const path = names
        .map((name, index) => {
          const value = options[name];
          if (value === undefined) {
            throw new Error(`Parameter ${name} is required.`);
          }

          return encodeURIComponent(value) + urlParts[index + 1];
        })
        .join('');

      const queryParameters = smartEntries(options)
        .filter(
          (entry): entry is [string, number | string | boolean] =>
            !namesHash[entry[0]] && entry[1] !== undefined
        )
        .concat([['key', apiKey]])
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        )
        .join('&');

      return `${beginning}${path}?${queryParameters}`;
    };
  }

  return {
    content: createEndpoint(
      fetch,
      validateBibleContentOptions,
      createUrlTemplate`bible/content/${'bible'}.${'format'}`,
      expectTextResult
    ),
    tableOfContents: createEndpoint(
      fetch,
      validateSpecificBibleOptions,
      createUrlTemplate`bible/contents/${'bible'}`,
      createJsonResultParser<TableOfContentsResponse>()
    ),
    search: createEndpoint(
      fetch,
      validateSearchOptions,
      createUrlTemplate`bible/search/${'bible'}`,
      createJsonResultParser<SearchResponse>()
    ),
    findBible: createEndpoint(
      fetch,
      validateSpecificBibleOptions,
      createUrlTemplate`bible/find/${'bible'}`,
      createJsonResultParser<FindBiblesResponse>()
    ),
    find: createEndpoint(
      fetch,
      validateFindOptions,
      createUrlTemplate`bible/find`,
      createJsonResultParser<FindBiblesResponse>()
    ),
    image: createEndpoint(
      fetch,
      validateSpecificBibleOptions,
      createUrlTemplate`bible/image/${'bible'}`,
      expectImageResult
    ),
    parse: createEndpoint(
      fetch,
      validateParseOptions,
      createUrlTemplate`bible/parse`,
      createJsonResultParser<ParseResponse>()
    ),
    scan: createEndpoint(
      fetch,
      validateScanOptions,
      createUrlTemplate`bible/scan`,
      createJsonResultParser<ScanResponse>()
    ),
    tag: createEndpoint(
      fetch,
      validateTagOptions,
      createUrlTemplate`bible/tag`,
      createJsonResultParser<TagResponse>()
    ),
    compare: createEndpoint(
      fetch,
      validateCompareOptions,
      createUrlTemplate`bible/compare`,
      createJsonResultParser<CompareResponse>()
    ),
  };
}
