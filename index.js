const baseUrl = 'https://api.biblia.com/v1/';

module.exports.usageAcknowledgment = `<a href="https://biblia.com/"><img src="https://api.biblia.com/v1/PoweredByBiblia_small.png" alt="Powered by Biblia" /></a>
This site uses the <a href="https://biblia.com/">Biblia</a> web services from <a href="https://www.logos.com/">Logos Bible Software</a>.`;

function createEndpoint(fetch, validateOptions, renderUrl) {
  return async options => {
    validateOptions(options);

    const response = await fetch(renderUrl(options));

    // TODO: Add a richer vocabulary of errors.
    if (response.status !== 200) {
      throw response;
    }

    const contentType = (response.headers.get('Content-Type') || '').split(
      ';',
      2
    )[0];

    switch (contentType) {
      case 'application/json':
        return await response.json();
      case 'text/html':
      case 'text/plain':
        return await response.text();
      case 'image/jpeg':
        return await response.blob();
      default:
        throw new Error(`Unexpected response Content-Type: ${contentType}`);
    }
  };
}

function createOptionsValidator(validators) {
  const validateFunctions = Object.assign(
    {},
    ...Object.entries(validators).map(([key, createValidator]) => ({
      [key]: createValidator(key),
    }))
  );

  return function validate(options) {
    if (!options) {
      throw new Error('Options is required.');
    }

    for (const key in options) {
      if (!validateFunctions[key]) {
        throw new Error(`Option ${key} is not supported.`);
      }
    }

    for (const [key, validate] of Object.entries(validateFunctions)) {
      const value = options[key];

      validate(value);
    }
  };
}

function allowOptional(fn) {
  fn.optional = optionName => {
    const validate = fn(optionName);

    return value => {
      if (value !== undefined) {
        validate(value);
      }
    };
  };

  return fn;
}

function validateEnumMembership(...values) {
  const valuesHash = Object.assign(
    {},
    ...values.map(value => ({ [value.toLowerCase()]: true }))
  );

  return allowOptional(optionName => {
    const errorMessage = `Option ${optionName} must be one of ${values.join(
      ', '
    )}.`;

    return function validate(value) {
      if (!valuesHash[value.toLowerCase()]) {
        throw new Error(errorMessage);
      }
    };
  });
}

function validateTypeOf(expectedType) {
  return allowOptional(optionName => {
    const errorMessage = `Option ${optionName} must be a ${expectedType}.`;

    return function validate(value) {
      if (typeof value !== expectedType) {
        throw new Error(errorMessage);
      }
    };
  });
}

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
];

const bibleVersionValidator = validateEnumMembership(...availableBibles);

const validateBibleContentOptions = createOptionsValidator({
  bible: bibleVersionValidator,
  passage: validateTypeOf('string'),
  format: validateEnumMembership('txt', 'html', 'txt.json', 'html.json'),
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
  formatting: validateTypeOf('string').optional,
  redLetter: validateTypeOf('boolean').optional,
  footnotes: validateTypeOf('boolean').optional,
  citation: validateTypeOf('boolean').optional,
  paragraphs: validateTypeOf('boolean').optional,
  fullText: validateTypeOf('boolean').optional,
  header: validateTypeOf('string').optional,
  eachVerse: validateTypeOf('string').optional,
  footer: validateTypeOf('string').optional,
});

const pagingOptions = {
  start: validateTypeOf('number').optional,
  limit: validateTypeOf('number').optional,
};

const validateSearchOptions = createOptionsValidator({
  bible: bibleVersionValidator,
  query: validateTypeOf('string'),
  mode: validateEnumMembership('verse', 'fuzzy').optional,
  passages: validateTypeOf('string').optional,
  preview: validateEnumMembership('none', 'text', 'html').optional,
  sort: validateEnumMembership('relevance', 'passage').optional,
  ...pagingOptions,
});

const validateSpecificBibleOptions = createOptionsValidator({
  bible: bibleVersionValidator,
});

const validateFindOptions = createOptionsValidator({
  query: validateTypeOf('string').optional,
  strictQuery: validateTypeOf('boolean').optional,
  ...pagingOptions,
});

const validateParseOptions = createOptionsValidator({
  passage: validateTypeOf('string'),
  style: validateEnumMembership('short', 'medium', 'long').optional,
});

const validateScanOptions = createOptionsValidator({
  text: validateTypeOf('string'),
  tagChapters: validateTypeOf('boolean').optional,
});

const validateTagOptions = createOptionsValidator({
  text: validateTypeOf('string').optional,
  url: validateTypeOf('string').optional,
  tagFormat: validateTypeOf('string').optional,
  tagChapters: validateTypeOf('boolean').optional,
});

const validateCompareOptions = createOptionsValidator({
  first: validateTypeOf('string'),
  second: validateTypeOf('string'),
});

module.exports.createBibliaApiClient = ({ apiKey, fetch }) => {
  function createUrlTemplate(urlParts, ...names) {
    for (const name of names) {
      if (typeof name !== 'string') {
        throw new Error(`All names must be strings, but ${name} is not.`);
      }
    }

    const beginning = baseUrl + urlParts[0];
    const namesHash = Object.assign(
      {},
      ...names.map(name => ({ [name]: true }))
    );

    return function renderUrl(options) {
      const path = names
        .map(
          (name, index) =>
            encodeURIComponent(options[name]) + urlParts[index + 1]
        )
        .join('');

      const queryParameters = Object.entries(options)
        .filter(([key]) => !namesHash[key])
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
      createUrlTemplate`bible/content/${'bible'}.${'format'}`
    ),
    tableOfContents: createEndpoint(
      fetch,
      validateSpecificBibleOptions,
      createUrlTemplate`bible/contents/${'bible'}`
    ),
    search: createEndpoint(
      fetch,
      validateSearchOptions,
      createUrlTemplate`bible/search/${'bible'}`
    ),
    findBible: createEndpoint(
      fetch,
      validateSpecificBibleOptions,
      createUrlTemplate`bible/find/${'bible'}`
    ),
    find: createEndpoint(
      fetch,
      validateFindOptions,
      createUrlTemplate`bible/find`
    ),
    image: createEndpoint(
      fetch,
      validateSpecificBibleOptions,
      createUrlTemplate`bible/image/${'bible'}`
    ),
    parse: createEndpoint(
      fetch,
      validateParseOptions,
      createUrlTemplate`bible/parse`
    ),
    scan: createEndpoint(
      fetch,
      validateScanOptions,
      createUrlTemplate`bible/scan`
    ),
    tag: createEndpoint(
      fetch,
      validateTagOptions,
      createUrlTemplate`bible/tag`
    ),
    compare: createEndpoint(
      fetch,
      validateCompareOptions,
      createUrlTemplate`bible/compare`
    ),
  };
};
