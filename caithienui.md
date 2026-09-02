Tôi đã xem qua code. Vấn đề chính là project đang dùng **inline styles** (style object) hoàn toàn, không có `className` Tailwind responsive, và không có logic detect mobile — nên layout "đông cứng" một chiều. Dưới đây là phân tích cụ thể và giải pháp.

---

## 🔍 Nguyên nhân gốc (đọc từ code)

| File | Vấn đề cụ thể |
|---|---|
| `src/AppShell.tsx:43-46` | Sidebar luôn `width: 228px` (hoặc 68px), không ẩn trên mobile. Container chỉ `flex: 1` nên content bị ép nhỏ. |
| `src/components/Sidebar.tsx:29-44` | `<aside>` không có `position: fixed`/`transform`, luôn chiếm chỗ ngang. |
| `src/pages/Settings.tsx:78` | `gridTemplateColumns: '1fr 1fr'` — ép 2 cột kể cả khi màn 430px → input bị tràn phải. |
| `src/pages/Settings.tsx:65` | Container `padding: 24` cố định — trên mobile tốn 48px chiều ngang chỉ cho padding. |
| `src/components/TopBar.tsx:35-53` | Search `maxWidth: 280` + dark toggle + bell + avatar + title — 5 thứ nằm 1 hàng, không co lại được. |
| `src/pages/Settings.tsx:117-150` | `<table>` không có wrapper `overflow-x: auto` — tràn ngang. |
| `src/components/Sidebar.tsx:155-179` | Nút "Sign out" bị ẩn khi sidebar collapsed — user không logout được khi đã thu gọn trên mobile. |

Viewport meta trong `index.html` đã OK (`width=device-width, initial-scale=1.0`).

---

## ✅ Kế hoạch cải thiện theo từng file

### 1. `src/AppShell.tsx` — thêm logic responsive cho shell

Cần detect mobile và chuyển Sidebar thành **drawer (overlay)** thay vì layout ngang:

- Thêm `useMediaQuery('(max-width: 768px)')` (hoặc `useState` cập nhật qua `resize` listener — vì đang không dùng thư viện hook).
- Khi mobile:
  - Sidebar thành `position: fixed; left: 0; top: 0; z-index: 50`
  - Khi đóng: `transform: translateX(-100%)` (ẩn hoàn toàn khỏi flow)
  - Khi mở: hiện + thêm **backdrop mờ** che phần content
- Khi desktop: giữ nguyên hành vi hiện tại (sticky bên trái).
- Auto-close drawer khi user chọn menu item (tránh drawer che màn khi đã navigate).

### 2. `src/components/Sidebar.tsx` — drawer cho mobile

- Thêm prop `mobileOpen?: boolean` và `onMobileClose?: () => void`.
- Thêm **hamburger button** đầu `Sidebar` chỉ hiển thị trên mobile (`@media` qua className hoặc state từ parent).
- Khi mobile: width = `min(80vw, 280px)`, không dùng `position: sticky`.
- Backdrop: 1 `<div>` absolute phủ màn, click vào đóng drawer.
- Đảm bảo **Sign out luôn hiển thị** (không phụ thuộc `collapsed`) — kéo nó ra khỏi khối `{!collapsed && ...}`.

### 3. `src/components/TopBar.tsx` — co lại trên mobile

- Padding `0 24px` → giảm còn `0 12px` trên mobile.
- Search bar `maxWidth: 280` → **ẩn trên mobile**, hiện icon 🔍 → click mở modal search hoặc mở rộng input.
- Nút dark mode + bell + avatar giữ lại, nhưng thu nhỏ gap.

### 4. `src/pages/Settings.tsx` — form responsive

- Container padding: `padding: 16` mobile, `24` desktop.
- Grid form Business Info: đổi sang className Tailwind `grid grid-cols-1 md:grid-cols-2 gap-4` thay vì inline `gridTemplateColumns: '1fr 1fr'`.
- Bảng Rooms: bọc trong `<div style={{ overflowX: 'auto' }}>` để scroll ngang trên mobile.
- Tab bar: giữ `flexWrap: 'wrap'` (đã có) nhưng giảm `padding` mỗi tab trên mobile.
- Room Types / Pricing row: chuyển `display: flex` sang `flex-col sm:flex-row` để input rớt xuống dòng dưới trên màn nhỏ.

### 5. `src/index.css` — bổ sung utility classes

Vì Tailwind đã load (`@import 'tailwindcss';`), có thể thêm:

- Class ẩn/hiện theo breakpoint: `.md-show { display: none } @media (min-width: 768px) { .md-show { display: block } }` — hoặc dùng thẳng Tailwind utilities.
- Class cho backdrop: `.drawer-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 40 }`.

---

## 🚀 Lộ trình đề xuất (ưu tiên từ trên xuống)

**Đợt 1 — fix ngay vấn đề trong ảnh (Settings):**
1. Sửa `Settings.tsx`: container padding responsive + grid 1 cột trên mobile.
2. Sửa `AppShell.tsx` + `Sidebar.tsx`: sidebar thành drawer trên mobile (giải quyết luôn "Sign out bị ẩn").

**Đợt 2 — polish:**
3. `TopBar.tsx`: ẩn search trên mobile.
4. Bảng Rooms + các list page khác: wrap trong `overflow-x: auto`.

**Đợt 3 — nền tảng lâu dài:**
5. Migrate dần từ inline style sang Tailwind classes để dễ maintain responsive hơn (toàn bộ project đang inline, sẽ tốn effort).
6. Cân nhắc thêm thư viện như `react-use` (có `useMediaQuery`) hoặc tự viết 1 hook `useMediaQuery` 10 dòng.

---

## 💡 Tip nhanh: thêm hook `useMediaQuery` (nếu muốn)

Vì project không có thư viện hook, có thể tạo `src/hooks/useMediaQuery.ts`:

```tsx
import { useEffect, useState } from 'react';
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
```

Sau đó trong `AppShell.tsx`:
```tsx
const isMobile = useMediaQuery('(max-width: 768px)');
```

---

## ⚠️ Lưu ý quan trọng

Tôi đang ở **Ask mode** nên không thể sửa code trực tiếp. Khi bạn chuyển sang **Agent mode**, tôi có thể implement theo đúng các bước trên. Bạn muốn tôi làm theo thứ tự nào (đợt 1 trước, hay làm tất cả một lần)? Và bạn có muốn migrate sang Tailwind className hay giữ inline style + thêm hook `useMediaQuery`?