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
        // 非エンジニアには「太字」「見出し」「URLを貼るとリンクになる」だけ
        // 分かれば十分なため、装飾はあえて最小限にしている（autolinkでURLの
        // 貼り付けは自動的にリンク化される）。
        plugins: ["link", "autolink"],
        toolbar: "undo redo | bold | h2 | link removeformat",
        setup: (editor) => {
          editor.ui.registry.addToggleButton("h2", {
            icon: "header-2",
            tooltip: "見出し",
            onAction: () => editor.execCommand("mceToggleFormat", false, "h2"),
            onSetup: (api) => {
              const update = () => api.setActive(editor.formatter.match("h2"));
              editor.on("NodeChange", update);
              return () => editor.off("NodeChange", update);
            },
          });
        },
        content_style:
          "body { font-family: system-ui, sans-serif; font-size: 14px; color: #292524; } h2 { font-size: 1.15em; font-weight: 700; }",
      }}
    />
  );
}
