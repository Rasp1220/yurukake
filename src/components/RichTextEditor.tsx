"use client";

import { Editor } from "@tinymce/tinymce-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

// APIキー不要で使えるよう、`public/tinymce`（node_modules/tinymceからの
// コピー、postinstallで生成）を自前で読み込むセルフホスト構成にしている。
export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  return (
    <Editor
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      licenseKey="gpl"
      value={value}
      onEditorChange={onChange}
      init={{
        height: 320,
        menubar: false,
        branding: false,
        language: "ja",
        language_url: "/tinymce/langs/ja.js",
        plugins: ["lists", "link", "autolink"],
        toolbar:
          "undo redo | blocks | bold italic underline | bullist numlist | link | removeformat",
        content_style:
          "body { font-family: system-ui, sans-serif; font-size: 14px; color: #292524; }",
      }}
    />
  );
}
