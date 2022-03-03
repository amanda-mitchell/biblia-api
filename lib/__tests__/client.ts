import 'dotenv/config';
import fetch from 'node-fetch';
import type { RequestInfo, Response } from 'node-fetch';
import { createBibliaApiClient } from '../client';

type BibliaApiClient = ReturnType<typeof createBibliaApiClient>;
type ClientMethodNames = keyof BibliaApiClient & string;

type UrlTestRow = {
  [Key in ClientMethodNames]: {
    methodName: Key;
    options: Parameters<BibliaApiClient[Key]>[0];
    expectedUrl: string;
    contentType: 'application/json' | 'text/plain' | 'text/html' | 'image/jpeg';
  };
}[ClientMethodNames];

const renderUrlInputs: UrlTestRow[] = [
  {
    methodName: 'content',
    options: {
      bible: 'leb',
      passage: 'Genesis 1:1',
      format: 'html',
      style: 'fullyFormatted',
      formatting: 'abc',
      redLetter: true,
      footnotes: true,
      citation: true,
      paragraphs: true,
      fullText: true,
      header: 'header',
      eachVerse: 'eachVerse',
      footer: 'footer',
    },
    expectedUrl:
      'https://api.biblia.com/v1/bible/content/leb.html?passage=Genesis%201%3A1&style=fullyFormatted&formatting=abc&redLetter=true&footnotes=true&citation=true&paragraphs=true&fullText=true&header=header&eachVerse=eachVerse&footer=footer&key=baz',
    contentType: 'text/html',
  },
  {
    methodName: 'tableOfContents',
    options: { bible: 'leb' },
    expectedUrl: 'https://api.biblia.com/v1/bible/contents/leb?key=baz',
    contentType: 'application/json',
  },
  {
    methodName: 'search',
    options: {
      bible: 'leb',
      query: 'something',
      mode: 'fuzzy',
      passages: 'Genesis 1',
      preview: 'text',
      sort: 'passage',
      start: 0,
      limit: 20,
    },
    expectedUrl:
      'https://api.biblia.com/v1/bible/search/leb?query=something&mode=fuzzy&passages=Genesis%201&preview=text&sort=passage&start=0&limit=20&key=baz',
    contentType: 'application/json',
  },
  {
    methodName: 'findBible',
    options: { bible: 'leb' },
    expectedUrl: 'https://api.biblia.com/v1/bible/find/leb?key=baz',
    contentType: 'application/json',
  },
  {
    methodName: 'find',
    options: { query: 'hi', strictQuery: false, start: 0, limit: 10 },
    expectedUrl:
      'https://api.biblia.com/v1/bible/find?query=hi&strictQuery=false&start=0&limit=10&key=baz',
    contentType: 'application/json',
  },
  {
    methodName: 'image',
    options: { bible: 'leb' },
    expectedUrl: 'https://api.biblia.com/v1/bible/image/leb?key=baz',
    contentType: 'image/jpeg',
  },
  {
    methodName: 'parse',
    options: { passage: 'Genesis 1:1', style: 'long' },
    expectedUrl:
      'https://api.biblia.com/v1/bible/parse?passage=Genesis%201%3A1&style=long&key=baz',
    contentType: 'application/json',
  },
  {
    methodName: 'scan',
    options: { text: 'A sentence or two.', tagChapters: true },
    expectedUrl:
      'https://api.biblia.com/v1/bible/scan?text=A%20sentence%20or%20two.&tagChapters=true&key=baz',
    contentType: 'application/json',
  },
  {
    methodName: 'tag',
    options: { text: 'A sentence or two', tagFormat: 'abc', tagChapters: true },
    expectedUrl:
      'https://api.biblia.com/v1/bible/tag?text=A%20sentence%20or%20two&tagFormat=abc&tagChapters=true&key=baz',
    contentType: 'application/json',
  },
  {
    methodName: 'tag',
    options: {
      url: 'https://example.com/',
      tagFormat: 'abc',
      tagChapters: true,
    },
    expectedUrl:
      'https://api.biblia.com/v1/bible/tag?url=https%3A%2F%2Fexample.com%2F&tagFormat=abc&tagChapters=true&key=baz',
    contentType: 'application/json',
  },
  {
    methodName: 'compare',
    options: { first: 'Geneis 1:1', second: 'Genesis 1:2' },
    expectedUrl:
      'https://api.biblia.com/v1/bible/compare?first=Geneis%201%3A1&second=Genesis%201%3A2&key=baz',
    contentType: 'application/json',
  },
];

describe.each(renderUrlInputs)(
  'render url',
  ({ methodName, options, expectedUrl, contentType }: UrlTestRow) => {
    test(methodName, async () => {
      const apiKey = 'baz';

      let renderedUrl = null;

      const mockedFetch = async (url: RequestInfo) => {
        renderedUrl = url;

        return {
          status: 200,
          headers: {
            get() {
              return contentType;
            },
          },
          async text() {
            return '';
          },
          async json() {
            return {};
          },
          async blob() {
            return null;
          },
        } as unknown as Response;
      };

      mockedFetch.isRedirect = () => {
        throw new Error();
      };

      const api = createBibliaApiClient({ apiKey: apiKey, fetch: mockedFetch });

      await api[methodName](options as any);

      expect(renderedUrl).toBe(expectedUrl);
    });
  }
);

describe('integration tests', () => {
  const apiKey = process.env['BIBLIA_API_KEY']!;

  // We can't perform integration tests unless we have
  // an API key, which should not be stored in the repository.
  beforeAll(() => expect(apiKey).toBeDefined());

  describe('content', () => {
    test('txt', async () => {
      const api = createBibliaApiClient({ apiKey, fetch });

      expect(
        await api.content({
          passage: 'Genesis 1:1',
          format: 'txt',
          bible: 'leb',
        })
      ).toBe('In the beginning, God created the heavens and the earth—');
    });

    test('html', async () => {
      const api = createBibliaApiClient({ apiKey, fetch });

      expect(
        await api.content({
          passage: 'Genesis 1:1',
          format: 'html',
          bible: 'leb',
        })
      ).toContain('In the beginning, God created the heavens and the earth');
    });
  });

  test('image', async () => {
    const api = createBibliaApiClient({ apiKey, fetch });

    const result = await api.image({ bible: 'leb' });

    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBeGreaterThan(0);
  });

  test('search', async () => {
    const api = createBibliaApiClient({ apiKey, fetch });

    expect(
      await api.search({
        bible: 'leb',
        query: 'beginning',
        mode: 'verse',
        sort: 'passage',
        preview: 'none',
        start: 0,
        limit: 1,
      })
    ).toMatchObject({
      results: [{ title: 'Genesis 1:1' }],
    });
  });

  test('findBible', async () => {
    const api = createBibliaApiClient({ apiKey, fetch });

    expect(await api.findBible({ bible: 'leb' })).toMatchObject({
      bibles: [
        {
          abbreviatedTitle: 'LEB',
          bible: 'leb',
          copyright: 'Copyright 2012 Lexham Press',
          description:
            'The Lexham English Bible contains a translation of the original languages into smooth, readable English. It also contains copious footnotes which address translation issues, instances of Old Testament quotations in the New Testament, and various textual-critical issues. This translation also indicates the use of idioms in the Greek and Hebrew text. In cases where a literal rendering of Greek or Hebrew would prevent a smooth English translation, footnotes indicate the literal English translation, accompanied by explanatory notes as necessary.',
          extendedCopyright:
            'Copyright 2012 Lexham Press. All rights reserved.',
          imageUrl: 'https://covers.logoscdn.com/lls_leb/cover.jpg',
          languages: ['en'],
          publicationDate: '2012',
          publishers: ['Lexham Press'],
          searchFields: [
            'surface',
            'footnote',
            'bible',
            'largetext',
            'heading',
          ],
          title: 'The Lexham English Bible',
        },
      ],
    });
  });

  test('find', async () => {
    const api = createBibliaApiClient({ apiKey, fetch });

    expect(await api.find({ query: 'Lexham' })).toMatchObject({
      bibles: [
        {
          abbreviatedTitle: 'LEB',
          bible: 'leb',
          copyright: 'Copyright 2012 Lexham Press',
          description:
            'The Lexham English Bible contains a translation of the original languages into smooth, readable English. It also contains copious footnotes which address translation issues, instances of Old Testament quotations in the New Testament, and various textual-critical issues. This translation also indicates the use of idioms in the Greek and Hebrew text. In cases where a literal rendering of Greek or Hebrew would prevent a smooth English translation, footnotes indicate the literal English translation, accompanied by explanatory notes as necessary.',
          extendedCopyright:
            'Copyright 2012 Lexham Press. All rights reserved.',
          imageUrl: 'https://covers.logoscdn.com/lls_leb/cover.jpg',
          languages: ['en'],
          publicationDate: '2012',
          publishers: ['Lexham Press'],
          searchFields: [
            'surface',
            'footnote',
            'bible',
            'largetext',
            'heading',
          ],
          title: 'The Lexham English Bible',
        },
      ],
    });
  });

  test('parse', async () => {
    const api = createBibliaApiClient({ apiKey, fetch });

    expect(await api.parse({ passage: 'Genesis 1:1' })).toMatchObject({
      passage: 'Genesis 1:1',
      passages: [
        {
          index: 0,
          length: 11,
          parts: { book: 'Genesis', chapter: 1, verse: 1 },
          passage: 'Genesis 1:1',
        },
      ],
    });
  });

  test('scan', async () => {
    const api = createBibliaApiClient({ apiKey, fetch });

    expect(
      await api.scan({
        text: 'The quick brown Genesis 1:1 jumps over the lazy dog.',
      })
    ).toMatchObject({
      results: [{ passage: 'Genesis 1:1', textIndex: 16, textLength: 11 }],
    });
  });

  test('tag', async () => {
    const api = createBibliaApiClient({ apiKey, fetch });

    expect(
      await api.tag({
        text: 'The quick brown Genesis 1:1 jumps over the lazy dog.',
      })
    ).toEqual({
      text: 'The quick brown <a href="https://ref.ly/Gen1.1">Genesis 1:1</a> jumps over the lazy dog.',
    });
  });

  test('compare', async () => {
    const api = createBibliaApiClient({ apiKey, fetch });

    expect(
      await api.compare({ first: 'Genesis 1:2', second: 'Genesis 1:1-10' })
    ).toMatchObject({
      after: false,
      before: false,
      compare: 1,
      endToEnd: -1,
      endToStart: 1,
      equal: false,
      intersects: true,
      startToEnd: -1,
      startToStart: 1,
      strictSubset: true,
      strictSuperset: false,
      subset: true,
      superset: false,
    });
  });
});
