import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSafeUrl,
  parseMarkdownBlocks,
  parseMarkdownInline
} from "./markdownParser.js";

test("parseMarkdownBlocks keeps headings, quotes, mixed lists and fenced code", () => {
  const source = [
    "## Заголовок",
    "",
    "Первая строка",
    "вторая строка",
    "",
    "- alpha",
    "- **beta**",
    "",
    "1. first",
    "2. second",
    "",
    "> цитата",
    "",
    "```js",
    "const x = 1;",
    "```"
  ].join("\r\n");

  assert.deepEqual(parseMarkdownBlocks(source), [
    { type: "heading", level: 2, text: "Заголовок" },
    { type: "paragraph", text: "Первая строка вторая строка" },
    { type: "unordered-list", items: ["alpha", "**beta**"] },
    { type: "ordered-list", items: ["first", "second"] },
    { type: "blockquote", text: "цитата" },
    { type: "code", language: "js", text: "const x = 1;" }
  ]);
});

test("parseMarkdownInline parses code, emphasis, links and images", () => {
  assert.deepEqual(
    parseMarkdownInline("Текст **жирный *em*** `code` [ref](/docs) ![img](/x.png)"),
    [
      "Текст ",
      {
        type: "strong",
        children: [
          "жирный ",
          { type: "em", children: ["em"] }
        ]
      },
      " ",
      { type: "code", text: "code" },
      " ",
      { type: "link", href: "/docs", children: ["ref"] },
      " ",
      { type: "image", src: "/x.png", alt: "img" }
    ]
  );
});

test("parseMarkdownInline strips unsafe javascript URLs to plain text", () => {
  assert.deepEqual(
    parseMarkdownInline("[safe](https://example.test) [bad](javascript:alert(1)) ![img](javascript:alert(1))"),
    [
      {
        type: "link",
        href: "https://example.test/",
        children: ["safe"]
      },
      " bad img"
    ]
  );
});

test("normalizeSafeUrl accepts safe URLs and rejects executable schemes", () => {
  assert.equal(normalizeSafeUrl("/docs/a.md"), "/docs/a.md");
  assert.equal(normalizeSafeUrl("#anchor"), "#anchor");
  assert.equal(normalizeSafeUrl("https://example.test/p"), "https://example.test/p");
  assert.equal(normalizeSafeUrl("mailto:test@example.test"), "mailto:test@example.test");
  assert.equal(normalizeSafeUrl("javascript:alert(1)"), "");
  assert.equal(normalizeSafeUrl(""), "");
});
