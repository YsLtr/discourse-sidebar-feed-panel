import { expect, it } from "vitest";
import { selectTopicTitle } from "../../src/ui/html";

// 译文优先;译文里的 :shortcode: 未展开时让位给原文的 unicode_title。
it.each([
  [
    "localized fancy_title wins",
    { title: "Original", fancy_title: "Translated" },
    "Translated",
  ],
  [
    "shortcode in fancy_title falls back to unicode_title",
    {
      title: "Resenha :studio_microphone:",
      fancy_title: "Review :studio_microphone:",
      unicode_title: "Resenha 🎙",
    },
    "Resenha 🎙",
  ],
  [
    "shortcode in fancy_title without unicode_title keeps fancy_title",
    { title: "Resenha :studio_microphone:", fancy_title: "Review :studio_microphone:" },
    "Review :studio_microphone:",
  ],
  ["unicode_title alone", { title: "Resenha", unicode_title: "Resenha 🎙" }, "Resenha 🎙"],
  ["title alone", { title: "Original" }, "Original"],
  ["blank values fall through", { title: "  Original  ", fancy_title: " ", unicode_title: "" }, "Original"],
  ["no title fields", {}, ""],
  // 实体解码属于渲染层(需要 DOM),这里只断言选择结果原样保留实体文本。
  [
    "entities are not decoded by the selector",
    { title: "Original", fancy_title: "Translated &#8220;Alpha&#8221;" },
    "Translated &#8220;Alpha&#8221;",
  ],
])("%s", (_name, topic, expected) => {
  expect(selectTopicTitle(topic)).toBe(expected);
});
