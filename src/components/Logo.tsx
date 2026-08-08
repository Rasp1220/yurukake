export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 300"
      role="img"
      aria-label="ゆるかけ"
      className={className}
    >
      <ellipse cx="410" cy="70" rx="55" ry="26" fill="#bfe0f2" />
      <circle cx="380" cy="60" r="22" fill="#bfe0f2" />
      <circle cx="420" cy="50" r="26" fill="#bfe0f2" />

      <g>
        <path
          d="M60 200 L150 90 Q160 78 172 90 L215 140 L245 108 Q255 97 265 108 L340 200 Z"
          fill="#7fb08a"
        />
        <path
          d="M150 90 L172 116"
          stroke="#f3fbf5"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d="M245 108 L258 124"
          stroke="#f3fbf5"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>

      <g>
        <path
          d="M42 150 Q22 190 42 205 Q30 218 46 222 L78 222 Q94 218 82 205 Q102 190 82 150 Q75 138 62 138 Q49 138 42 150 Z"
          fill="#8bbf7f"
        />
        <rect x="59" y="220" width="6" height="26" fill="#7a5a3a" />

        <path
          d="M90 175 Q74 205 90 218 Q80 228 93 231 L119 231 Q132 228 122 218 Q138 205 122 175 Q116 165 106 165 Q96 165 90 175 Z"
          fill="#9ecb8f"
        />
        <rect x="103" y="229" width="5" height="20" fill="#7a5a3a" />
      </g>

      <text
        x="270"
        y="215"
        textAnchor="middle"
        fontFamily="'Hiragino Maru Gothic ProN','M PLUS Rounded 1c','Yu Gothic',sans-serif"
        fontWeight="700"
        fontSize="92"
        fill="#3d4b5c"
      >
        ゆるかけ
      </text>

      <path
        d="M30 258 Q120 235 220 258 T420 258 T470 250"
        fill="none"
        stroke="#a9d1a4"
        strokeWidth="6"
        strokeLinecap="round"
      />

      <g>
        <path
          d="M470 220 Q492 220 492 244 Q492 262 470 282 Q448 262 448 244 Q448 220 470 220 Z"
          fill="#e2664f"
        />
        <circle cx="470" cy="243" r="9" fill="#fff" />
      </g>

      <g>
        <rect x="20" y="8" width="4" height="16" fill="#f0b23e" transform="rotate(-20 22 16)" />
        <rect x="20" y="8" width="4" height="16" fill="#f0b23e" transform="rotate(20 22 16)" />
        <rect x="20" y="8" width="4" height="16" fill="#f0b23e" transform="rotate(60 22 16)" />
      </g>
      <g transform="translate(430,30)">
        <rect x="0" y="0" width="4" height="14" fill="#f0b23e" transform="rotate(-18 2 7)" />
        <rect x="0" y="0" width="4" height="14" fill="#f0b23e" transform="rotate(18 2 7)" />
        <rect x="0" y="0" width="4" height="14" fill="#f0b23e" transform="rotate(55 2 7)" />
      </g>

      <g transform="translate(492,238)">
        <rect x="34" y="0" width="46" height="34" rx="6" fill="#5f7f9b" />
        <rect x="46" y="-10" width="18" height="10" rx="3" fill="#5f7f9b" />
        <circle cx="57" cy="17" r="11" fill="#eef4f7" />
        <circle cx="57" cy="17" r="6" fill="#5f7f9b" />
        <rect x="0" y="-6" width="4" height="16" fill="#7fb3d9" transform="rotate(-20 2 2)" />
        <rect x="0" y="-6" width="4" height="16" fill="#7fb3d9" transform="rotate(20 2 2)" />
        <rect x="0" y="-6" width="4" height="16" fill="#7fb3d9" transform="rotate(60 2 2)" />
      </g>
    </svg>
  );
}
