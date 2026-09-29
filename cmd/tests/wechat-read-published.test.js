"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const script = resolve(__dirname, "../platforms/wechat/read-published-article.mjs");

test("published article lookup distinguishes URL and title-only candidates", async () => {
  const { selectArticle, titleCandidates } = await import(script);
  const item = { article_id: "article-1", content: { news_item: [{
    title: "目标文章", url: "https://mp.weixin.qq.com/s/abc?b=2&a=1", content: "<p>正文</p>",
  }] } };
  assert.equal(selectArticle([item], "https://mp.weixin.qq.com/s/abc?a=1&b=2#read").matchedBy, "url");
  assert.equal(selectArticle([item], "https://mp.weixin.qq.com/s/other"), null);
  assert.equal(titleCandidates([item], "目标文章")[0].matchedBy, "title-only");
});

test("read-published command rejects invalid input before obtaining a token", () => {
  const cli = resolve(__dirname, "../cli.js");
  const result = spawnSync(process.execPath, [cli, "wechat", "read-published", "--url", "https://example.com/s/abc"],
    { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mp\.weixin\.qq\.com/);
});
