# @amanda-mitchell/biblia-api

![Node.js CI](https://github.com/amanda-mitchell/biblia-api/workflows/Node.js%20CI/badge.svg)

This is a Javascript client for the [Biblia API](https://bibliaapi.com/docs/).

## Installation

```
yarn add @amanda-mitchell/biblia-api
```

## Usage

```js
const bibliaApi = require('@amanda-mitchell/biblia-api');

// This can be any method that is compatible with the Fetch interface.
const fetch = require('node-fetch');

const apiKey =
  'Go to https://bibliaapi.com/docs/API_Keys to generate an API key.';

const client = bibliaApi.createBibliaApiClient({ apiKey, fetch });

client
  .content({
    passage: 'Genesis 1:1',
    format: 'txt',
    bible: 'leb',
  })
  .then(console.log)
  .catch(console.error);
```

## Available methods

Each of these methods takes an `options` object containing the keys that are described in the official API docs.
Endpoints that return JSON are parsed into Javascript objects, plain text and html responses are returned as strings, and anything else is returned as a binary blob object.

- [`content`](https://bibliaapi.com/docs/Bible_Content): returns Bible content.
- [`tableOfContents`](https://bibliaapi.com/docs/Table_of_Contents): returns books and chapters of a given version.
- [`search`](https://bibliaapi.com/docs/Bible_Search): searches the text of a Bible version.
- [`findBible`](https://bibliaapi.com/docs/Bible_Find): return information about a specific version.
- [`find`](https://bibliaapi.com/docs/Bible_Find): return information about versions that match a query (or all available versions).
- [`image`](https://bibliaapi.com/docs/Bible_Image): return an image binary for the cover of a version.
- [`parse`](https://bibliaapi.com/docs/Bible_Parse): parse text into one or more Bible references.
- [`scan`](https://bibliaapi.com/docs/Bible_Scan): find Bible references contained within a larger block of text.
- [`tag`](https://bibliaapi.com/docs/Bible_Tag): add html tags around Bible references contained within a larger block of text.
- [`compare`](https://bibliaapi.com/docs/Bible_Compare): compare two Bible references.
