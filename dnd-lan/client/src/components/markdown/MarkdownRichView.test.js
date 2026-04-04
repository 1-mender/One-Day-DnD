import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MarkdownRichView from "./MarkdownRichView.js";

test("MarkdownRichView renders GFM tables and safe links", () => {
  const html = renderToStaticMarkup(
    React.createElement(MarkdownRichView, {
      source: [
        "| a | b |",
        "| - | - |",
        "| 1 | **two** |",
        "",
        "[docs](/notes)",
        "[bad](javascript:alert(1))"
      ].join("\n")
    })
  );

  assert.match(html, /<table>/);
  assert.match(html, /<strong>two<\/strong>/);
  assert.match(html, /<a href="\/notes">docs<\/a>/);
  assert.match(html, /bad<\/p>/);
  assert.doesNotMatch(html, /javascript:alert/);
});

test("MarkdownRichView renders images and strips unsafe image URLs", () => {
  const html = renderToStaticMarkup(
    React.createElement(MarkdownRichView, {
      source: "![safe](/img/x.png) ![bad](javascript:alert(1))"
    })
  );

  assert.match(html, /<img src="\/img\/x.png" alt="safe" loading="lazy"\/>/);
  assert.match(html, /bad/);
  assert.doesNotMatch(html, /javascript:alert/);
});
