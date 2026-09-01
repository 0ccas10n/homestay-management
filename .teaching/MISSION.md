# Mission: React Patterns trong Homestay Management

**Learner**: KhangNguyen
**Started**: 2026-09-01
**Last updated**: 2026-09-01
**Status**: Active

## Why this matters

Tôi đang maintain code base React lớn (Homestay Management — full-stack app với Google Sheets backend) và muốn **hiểu sâu các pattern đặc trưng** của nó thay vì chỉ sửa code cảm tính. Mục tiêu là có thể đọc 1 file `.tsx` mới trong dự án, hiểu ngay nó dùng pattern gì, và tự tin thêm/sửa mà không phá vỡ kiến trúc. Đây là nền tảng để tôi có thể refactor sau này hoặc onboard ai khác vào dự án.

## What I want to be able to do

1. Đọc 1 custom hook (`useBookings`, `useRooms`, ...) và giải thích nó return gì, tại sao có những method đó
2. Đọc 1 page (`.tsx`) và chỉ ra được luồng dữ liệu: hook → API → state → render
3. Tự viết 1 custom hook mới cho một resource chưa có (ví dụ `useLocations`) mà không copy-paste mù quáng
4. Hiểu khi nào dùng `useMemo` vs không, khi nào cần `useCallback`
5. Biết vì sao code base dùng envelope `{success, data}` và `ApiError` class
6. Đọc hiểu BookingFormModal (815 dòng) — file lớn nhất — và chỉ ra được pattern của nó

## What I already know

- React cơ bản: components, props, `useState`, `useEffect`
- Biết `useMemo`/`useCallback` tồn tại nhưng chưa thoải mái dùng
- Đã đọc qua code base nhưng hiểu mỗi file riêng lẻ, chưa thấy bức tranh chung

## Constraints

- **Time**: 15–20 phút mỗi session
- **Pace**: Slow & deep — một pattern mỗi lesson, không rush
- **Modality**: Đọc code → đọc giải thích → làm quiz/exercise
- **Background**: Code base đã chạy production, có backend Google Sheets, nhiều page lớn
- **Language**: Mixed Vietnamese/English trong code; giải thích bằng tiếng Việt

## Definition of success

Sau ~10 sessions, khi nhìn 1 file `.tsx` mới trong dự án, tôi có thể trong 2 phút:
- Chỉ ra nó dùng những hook nào
- Vẽ được luồng dữ liệu ra giấy
- Biết chính xác chỗ nào nên sửa và chỗ nào không nên động

Cột mốc đo được: Tôi tự viết được `useLocations` từ đầu mà không cần copy `useBookings`, pass type check, và integrate vào một page trong < 10 phút.
