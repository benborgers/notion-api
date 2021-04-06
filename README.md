# notion-api

This is a Notion API client for Node.js. Right now, it uses a reverse-engineered version of their private API (which _could_ break at any time — you have been warned).

## Installation

```bash
npm install @benborgers/notion-api
```

## Usage

The center of this package is the `NotionDoc` class, which represents a Notion document. To use it, the Notion page needs to be shared publicly to the web.

Use it like this:

```javascript
const { NotionDoc } = require('@benborgers/notion-api')

const doc = new NotionDoc('Projects-81896168267b2a9ba3988b1831897691')

console.log(await doc.title())
```

### Methods on `NotionDoc`

- `.title()` returns the document's title.
- `.createdAt()` and `.updatedAt()` return epoch timestamps of these respective times for the document.
- `.html()` returns fully-baked HTML for a Notion document.
    - Not all Notion blocks are supported yet, and the package will print console warnings for unsupported blocks and formatting options.

## HTML Considerations

The `NotionDoc.html()` method (documented above) returns pre-built markup from any public Notion page. Some notes about the HTML it outputs:

- Indented paragraphs are wrapped in a div with the class `.indented`.
- To-do lists / checklists are wrapped in a `.checklist` class.
- Callouts are wrapped in a `.callout` class, and contain an `img` and `p` tag.
- Page links are given the `data-page-id` property, which contains the Notion page ID they're linking to.
    - Block-level page links are additionally wrapped in a div with the class `.block-page-link`.

- Code blocks are highlighted with Prism.js. If the HTML contains a code block (you can detect this by the presence of the string `<pre><code`), you can add a [Prism.js theme of your choice](https://unpkg.com/browse/prism-themes@latest/themes/) to the HTML for syntax highlighting.
- Inline and block-level equations are rendered using KaTeX. If the HTML contains an equation (you can detect this by the presence of the string `katex-html`, which is a class name), you should add [this stylesheet](https://unpkg.com/katex@latest/dist/katex.min.css).
