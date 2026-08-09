// TinyMCE をAPIキー無しでセルフホストするため、node_modules/tinymce の配布物を
// public/tinymce にコピーする。`npm install` 後（postinstall）に毎回実行される。
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "tinymce");
const dest = path.join(__dirname, "..", "public", "tinymce");

if (!fs.existsSync(src)) {
  console.warn("[copy-tinymce] node_modules/tinymce not found, skipping copy.");
  process.exit(0);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log("[copy-tinymce] copied node_modules/tinymce -> public/tinymce");

// 日本語UI用の言語パック（tinymceパッケージ本体には同梱されていない）。
const jaLangSrc = path.join(__dirname, "..", "node_modules", "tinymce-i18n", "langs8", "ja.js");
const langsDest = path.join(dest, "langs");
if (fs.existsSync(jaLangSrc)) {
  fs.mkdirSync(langsDest, { recursive: true });
  fs.copyFileSync(jaLangSrc, path.join(langsDest, "ja.js"));
  console.log("[copy-tinymce] copied tinymce-i18n ja langpack -> public/tinymce/langs/ja.js");
} else {
  console.warn("[copy-tinymce] tinymce-i18n ja langpack not found, skipping.");
}
