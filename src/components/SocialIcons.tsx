import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export type ZaloVariant = 'crescent' | 'app' | 'bubble' | 'classic';

interface ZaloIconProps extends IconProps {
  variant?: ZaloVariant;
}

/**
 * Official Zalo Vector Icon with designs matched from official brand guidelines
 * - 'crescent': Top-Left icon (Blue crescent chat bubble with crisp blue Zalo wordmark)
 * - 'app': Top-Right icon (Squircle app icon with 3D drop shadow bubble)
 * - 'bubble': Bottom-Right icon (Blue chat bubble with bold white Z)
 * - 'classic': Solid blue badge with Zalo text
 */
export function ZaloIcon({ size = 20, variant = 'crescent', className, style }: ZaloIconProps) {
  if (variant === 'app') {
    // Mẫu 2: App tile với bong bóng chat trắng & bóng xanh (Top-Right)
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      >
        {/* Nền xanh viền bo góc kiểu App icon */}
        <rect width="100" height="100" rx="22" fill="#0068FF" />
        {/* Bong bóng trắng bên trong */}
        <path
          d="M20 32C20 23.1634 27.1634 16 36 16H64C72.8366 16 80 23.1634 80 32V58C80 66.8366 72.8366 74 64 74H36L22 84V72.5C20.7 70.8 20 68.5 20 66V32Z"
          fill="#FFFFFF"
        />
        {/* Chữ Zalo màu xanh thương hiệu */}
        <text
          x="49"
          y="56"
          fill="#0068FF"
          fontFamily="'Nunito', 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
          fontWeight="900"
          fontSize="27"
          letterSpacing="-0.5px"
          textAnchor="middle"
        >
          Zalo
        </text>
      </svg>
    );
  }

  if (variant === 'bubble') {
    // Mẫu 4: Bong bóng chat xanh với chữ Z trắng (Bottom-Right)
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      >
        <path
          d="M16 32C16 21 25 12 36 12H64C75 12 84 21 84 32V60C84 71 75 80 64 80H34L18 92V78C16.8 76 16 73 16 70V32Z"
          fill="#0068FF"
        />
        <text
          x="50"
          y="64"
          fill="#FFFFFF"
          fontFamily="'Nunito', 'SF Pro Rounded', system-ui, sans-serif"
          fontWeight="900"
          fontSize="48"
          textAnchor="middle"
        >
          Z
        </text>
      </svg>
    );
  }

  // Mẫu 1 (Mặc định - Top-Left trong ảnh):
  // Vòng tròn khuyết xanh ôm chữ Zalo tròn trịa trên nền trắng
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {/* Nền tròn trắng bo viền sạch sẽ */}
      <circle cx="50" cy="50" r="48" fill="#FFFFFF" />
      
      {/* Vòng cung khuyết hình bong bóng chat màu xanh Zalo chuẩn thương hiệu */}
      <path
        d="M 50 4 C 24.2 4 3.5 24.6 3.5 50 C 3.5 61.3 7.8 71.6 15 79.8 L 8 96 L 27.8 89.6 C 34.5 93.7 42 96 50 96 C 75.8 96 96.5 75.4 96.5 50 C 96.5 24.6 75.8 4 50 4 Z"
        fill="#0068FF"
      />
      {/* Vùng lòng trắng mở rộng tạo viền khuyết mặt trăng ôm trọn chữ */}
      <circle cx="57" cy="48" r="39.5" fill="#FFFFFF" />

      {/* Typography Zalo bo tròn mềm mại chuẩn font Zalo */}
      <text
        x="57"
        y="49.5"
        fill="#0068FF"
        fontFamily="'Nunito', 'SF Pro Rounded', 'Arial Rounded MT Bold', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontWeight="900"
        fontSize="26"
        letterSpacing="-0.6px"
        textAnchor="middle"
        dominantBaseline="central"
      >
        Zalo
      </text>
    </svg>
  );
}

/**
 * Official Instagram Vector Icon with Multi-color Gradient
 */
export function InstagramIcon({ size = 20, className, style }: IconProps) {
  const gradientId = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <defs>
        <radialGradient id={gradientId} cx="20%" cy="105%" r="130%">
          <stop offset="0%" stopColor="#ffb140" />
          <stop offset="25%" stopColor="#ff543e" />
          <stop offset="60%" stopColor="#fd1d1d" />
          <stop offset="100%" stopColor="#d6249f" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill={`url(#${gradientId})`} />
      <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="4" stroke="#ffffff" strokeWidth="1.6" fill="none" />
      <circle cx="12" cy="12" r="3.4" stroke="#ffffff" strokeWidth="1.6" fill="none" />
      <circle cx="15.8" cy="8.2" r="0.95" fill="#ffffff" />
    </svg>
  );
}

/**
 * Official TikTok Vector Icon
 */
export function TikTokIcon({ size = 20, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <rect width="24" height="24" rx="6" fill="#010101" />
      <path
        d="M16.6 8.2c-.85-.54-1.44-1.42-1.6-2.45h-2.3v10.15c0 1.25-1.02 2.27-2.27 2.27-1.25 0-2.27-1.02-2.27-2.27 0-1.25 1.02-2.27 2.27-2.27.24 0 .47.04.68.11v-2.36c-.22-.03-.45-.05-.68-.05-2.54 0-4.6 2.06-4.6 4.6 0 2.54 2.06 4.6 4.6 4.6 2.54 0 4.6-2.06 4.6-4.6V10.2c1.02.73 2.27 1.17 3.63 1.2v-2.32c-.75-.02-1.47-.33-2.06-.88z"
        fill="#ffffff"
      />
    </svg>
  );
}

/**
 * Brand Emblem for Hiên Homestay
 */
export function HienEmblem({ size = 24, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      <circle cx="18" cy="18" r="18" fill="#3D2817" />
      <text
        x="18"
        y="23"
        fill="#F7F0E7"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="11.5"
        textAnchor="middle"
        letterSpacing="0.8px"
      >
        HIÊN
      </text>
    </svg>
  );
}
