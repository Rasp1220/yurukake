import sanitizeHtml from "sanitize-html";

// ブログ本文はTinyMCE（lists/link/autolinkプラグインのみ）で作成されるため、
// それらが出力しうるタグ・属性だけを許可する。
export function sanitizeBlogContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "a"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}
