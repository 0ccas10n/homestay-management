# Data hook pattern: useBookings as canonical example

**Date**: 2026-09-01
**Lesson**: [0001-data-hook-pattern.html](../lessons/0001-data-hook-pattern.html)
**Resources**: [React docs — Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)

## What changed

Trước đây tôi nghĩ custom hook là "một hàm dùng `useState`". Giờ tôi hiểu nó là một **hợp đồng trả về** — luôn luôn cùng hình dạng `{ data, loading, error, refetch, ...mutations }` — và hợp đồng này được áp dụng thống nhất cho mọi resource trong app. Component không cần biết hook đó fetch từ Google Sheets, REST, hay localStorage — nó chỉ destructure và dùng.

## What was non-obvious

1. **Optimistic update** trong `cancelBooking`: hook sửa đúng 1 dòng trong state qua `prev.map`, không gọi lại `refetch()`. UI cập nhật tức thì. Đánh đổi: nếu mutation fail, state đã sai — component phải `catch` và xử lý rollback (codebase hiện tại chưa rollback, chỉ toast lỗi).

2. **`useCallback([])` không phải để tăng tốc** — mà để **ổn định identity**. Khi component dùng `refetch` trong `useEffect([refetch])`, nếu identity đổi mỗi render, effect loop. Đây là pattern subtle mà tôi hay bỏ qua.

3. **Object return vs tuple return**: codebase chọn object có tên để dễ mở rộng. React chính `useState` lại dùng tuple — nhưng tuple có thứ tự cố định, dễ vỡ khi thêm field. Hook resource không có quy tắc bắt buộc; object là chọn lựa có chủ đích.

## What was hard

- Phân biệt được "optimistic" (sửa local trước) và "pessimistic" (chờ server confirm mới sửa). Codebase dùng optimistic cho cancel nhưng không rollback khi fail — đây có thể là bug tiềm ẩn.
- Hiểu tại sao `useCallback` cần empty deps `[]` (vì hàm không capture state ngoài — nó dùng `setBookings(prev => ...)`).

## What to do next

- Đọc `src/hooks/useRooms.ts` và so sánh với `useBookings.ts` — xem hook nào phá vỡ pattern (lesson exercise).
- Lesson 0002: Envelope pattern trong `services/api.ts` — tại sao mọi response đều là `{success, data} | {success: false, error}`.

## Open questions

- Khi nào codebase **nên** rollback optimistic update? Hiện tại `Bookings.tsx` chỉ toast lỗi — nhưng state đã hiển thị "cancelled" trong khi server chưa thật sự hủy. Có phải bug không, hay chấp nhận được?
- Có nên dùng TanStack Query thay vì tự viết hook? Trade-off là gì cho codebase này?
- `useRooms` có trả về `loading` không, hay cấu trúc khác? Cần verify.
