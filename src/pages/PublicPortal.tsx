// ─── PublicPortal.tsx ─────────────────────────────────────────────────────────────
// Trang công khai dành cho khách vãng lai tra cứu phòng, xem ảnh, tiện ích,
// kiểm tra lịch trống và kết nối đặt phòng qua Zalo / Hotline mà không cần đăng nhập.
// Được thiết kế 100% chuẩn theo Brand Guidelines của Hiên Homestay:
//   - 60% Warm Cream (#F7F0E7) làm nền chủ đạo
//   - 30% Warm Charcoal (#4D3322) cho typography & đường nét
//   - 10% Warm Terracotta (#C17A5A) cho CTA & Soft Sage (#8AAAA2) cho điểm nhấn tự nhiên
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomsApi, locationsApi, availabilityApi } from '@/services/api';
import type { Room, Location } from '@/types/index';
import { DEFAULT_BIZ_INFO } from '@/pages/Settings';

// ─── Hiên Homestay Brand Palette ──────────────────────────────────────────────
const BRAND = {
  // Màu chính (60%) - Nền lớn ấm áp, nhẹ nhàng
  warmCream: '#F7F0E7',
  warmCreamLight: '#FAF5EE',
  warmCreamBorder: '#E5D9C8',
  warmCreamTonal: '#D4C4AE',

  // Màu phụ (30%) - Điểm nhấn chữ, đường nét, chắc chắn, tin cậy
  warmCharcoal: '#4D3322',
  charcoalDark: '#3F291B',
  charcoalDeep: '#25180F',
  charcoalMuted: '#7D6858',

  // Màu bổ trợ (10%)
  // Warm Terracotta: Điểm nhấn chính, dùng cho CTA
  terracotta: '#C17A5A',
  terracottaHover: '#A86446',
  terracottaLight: '#FBECE6',
  terracottaBorder: '#E4BDB0',

  // Soft Sage: Điểm nhấn thiên nhiên, bình yên, tươi mới
  softSage: '#8AAAA2',
  softSageLight: '#EDF5F3',
  softSageDark: '#2D534C',
  softSageBorder: '#B9D5CF',

  // Soft Beige: Màu đệm tạo chiều sâu
  softBeige: '#8A9A7B',
  softBeigeLight: '#F3F6F1',
};

// Ảnh phòng mặc định chất lượng cao cho homestay nếu phòng chưa có imageUrl
const FALLBACK_ROOM_IMAGES = [
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1000&q=80',
];

const DEFAULT_AMENITIES = [
  '📶 Wifi tốc độ cao',
  '❄️ Máy lạnh 2 chiều',
  '🚿 Nước nóng năng lượng',
  '🌿 Cửa sổ thoáng mát',
  '🍳 Bếp & Tủ lạnh',
  '🧴 Khăn tắm & Dầu gội',
];

function getTodayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatLocationList(names: string[]): string {
  const clean = names.filter(Boolean);
  if (!clean.length) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} & ${clean[clean.length - 1]}`;
}

export default function PublicPortal() {
  const navigate = useNavigate();

  // Đọc thông tin thương hiệu & liên hệ (từ Settings / localStorage)
  const [bizInfo] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bizInfo');
        if (saved) return { ...DEFAULT_BIZ_INFO, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_BIZ_INFO;
  });

  // Dữ liệu chính
  const [rooms, setRooms] = useState<Room[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc tìm kiếm lịch trống
  const [checkInDate, setCheckInDate] = useState<string>(getTodayStr());
  const [checkOutDate, setCheckOutDate] = useState<string>(getTomorrowStr());
  const [guestCount, setGuestCount] = useState<number>(2);
  const [isFiltering, setIsFiltering] = useState(false);
  const [availableRoomIds, setAvailableRoomIds] = useState<string[] | null>(null);

  // Modal lịch trống chi tiết cho từng phòng
  const [calendarRoom, setCalendarRoom] = useState<Room | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [bookedRanges, setBookedRanges] = useState<{ checkInAt: string; expectedCheckOutAt: string }[]>([]);
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());

  // Số Hotline, Zalo & Mạng xã hội homestay
  const rawPhone1 = bizInfo.phone || '0899 884 470';
  const rawPhone2 = (bizInfo as any).phoneSecondary || '0356 593 184';
  const cleanPhone1 = rawPhone1.replace(/[^\d]/g, '');
  const cleanPhone2 = rawPhone2.replace(/[^\d]/g, '');
  const zalo1 = cleanPhone1.startsWith('84') ? '0' + cleanPhone1.slice(2) : cleanPhone1;
  const zalo2 = cleanPhone2.startsWith('84') ? '0' + cleanPhone2.slice(2) : cleanPhone2;
  const instagramUrl = (bizInfo as any).instagram || 'https://www.instagram.com/hien.home/';
  const tiktokUrl = (bizInfo as any).tiktok || 'https://www.tiktok.com/@hien.homestaysg';
  const homestayName = bizInfo.name || 'Hiên Homestay';

  // Modal chọn kênh liên hệ / Zalo
  const [contactModalRoom, setContactModalRoom] = useState<Room | null>(null);

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach(l => map.set(l.locationId, l.name));
    return map;
  }, [locations]);

  const homestayAddress = locations.length > 1
    ? `${locations.length} cơ sở: ${formatLocationList(locations.map(l => l.name))} · Bình Thạnh, TP.HCM`
    : (locations[0]?.publicAddress || bizInfo.address || 'Bình Thạnh, TP.HCM');

  // Fetch danh sách phòng và vị trí
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        const [roomsData, locsData] = await Promise.all([
          roomsApi.getPublic().catch(() => []),
          locationsApi.getAll().catch(() => []),
        ]);
        if (cancelled) return;
        const activeRooms = (roomsData || []).filter(
          r => r && r.active !== false && String(r.active).toLowerCase() !== 'false' && r.status !== 'inactive'
        );
        setRooms(activeRooms);
        setLocations(locsData || []);
      } catch (err: any) {
        if (!cancelled) setError('Không thể tải danh sách phòng. Vui lòng thử lại sau.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  // Xử lý kiểm tra phòng trống theo ngày
  const handleSearchAvailability = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!checkInDate || !checkOutDate) return;
    if (new Date(checkInDate) >= new Date(checkOutDate)) {
      alert('Ngày trả phòng phải sau ngày nhận phòng!');
      return;
    }

    try {
      setIsFiltering(true);
      const ciIso = `${checkInDate}T14:00:00+07:00`;
      const coIso = `${checkOutDate}T12:00:00+07:00`;
      const res = await availabilityApi.getAvailableRoomIds(ciIso, coIso);
      setAvailableRoomIds(res.availableRoomIds);
    } catch (err) {
      console.error('Lỗi khi tra cứu lịch trống:', err);
    } finally {
      setIsFiltering(false);
    }
  };

  const handleClearFilter = () => {
    setAvailableRoomIds(null);
  };

  // Mở modal lịch tháng chi tiết cho phòng
  const handleOpenCalendar = async (room: Room) => {
    setCalendarRoom(room);
    setCalMonth(new Date().getMonth());
    setCalYear(new Date().getFullYear());
    try {
      setCalendarLoading(true);
      const res = await availabilityApi.getBookedRanges(room.roomId);
      setBookedRanges(res.bookedRanges || []);
    } catch (err) {
      console.error('Lỗi tải lịch phòng:', err);
      setBookedRanges([]);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Tính số đêm giữa check-in và check-out
  const stayNights = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const diff = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
    const n = Math.round(diff / (1000 * 3600 * 24));
    return n > 0 ? n : 1;
  }, [checkInDate, checkOutDate]);

  // Lọc danh sách phòng hiển thị
  const displayRooms = useMemo(() => {
    return rooms.filter(r => {
      if (selectedLocationId !== 'all' && r.locationId !== selectedLocationId) return false;
      if (guestCount > 0 && r.capacity && r.capacity < guestCount) return false;
      return true;
    });
  }, [rooms, guestCount, selectedLocationId]);

  // Tạo tin nhắn Zalo soạn sẵn
  const makeZaloLink = (roomName: string, targetZalo?: string, ci?: string, co?: string, guests?: number) => {
    const ciText = formatDateDisplay(ci || checkInDate);
    const coText = formatDateDisplay(co || checkOutDate);
    const text = `Chào ${homestayName}, mình muốn hỏi đặt phòng [${roomName}] từ ngày ${ciText} đến ${coText} (${stayNights} đêm) cho ${guests || guestCount} khách (theo giờ / qua đêm / cả ngày). Nhờ bạn kiểm tra phòng trống và báo giá giúp mình nhé!`;
    const zNum = targetZalo || zalo1;
    return `https://zalo.me/${zNum}?text=${encodeURIComponent(text)}`;
  };

  // Render Calendar Grid cho Modal
  const renderMonthCalendar = () => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = CN, 1 = T2
    // Đổi về chuẩn T2 = 0, CN = 6
    const startOffset = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 12 }}>
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(wd => (
          <div key={wd} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: BRAND.charcoalMuted, padding: '6px 0' }}>
            {wd}
          </div>
        ))}
        {days.map((d, idx) => {
          if (d === null) {
            return <div key={`empty-${idx}`} style={{ minHeight: 48 }} />;
          }

          const curDate = new Date(calYear, calMonth, d);
          const isPast = curDate.getTime() < today.getTime();

          // Kiểm tra ngày này có nằm trong khoảng đặt phòng nào không
          const isBooked = bookedRanges.some(b => {
            const start = new Date(b.checkInAt);
            start.setHours(0, 0, 0, 0);
            const end = new Date(b.expectedCheckOutAt);
            end.setHours(0, 0, 0, 0);
            return curDate.getTime() >= start.getTime() && curDate.getTime() < end.getTime();
          });

          let bg = BRAND.softSageLight;
          let border = BRAND.softSageBorder;
          let textColor = BRAND.softSageDark;
          let statusLabel = 'Trống';

          if (isPast) {
            bg = '#EDE7DE';
            border = '#E0D4C5';
            textColor = '#A69888';
            statusLabel = 'Qua ngày';
          } else if (isBooked) {
            bg = BRAND.terracottaLight;
            border = BRAND.terracottaBorder;
            textColor = BRAND.terracottaHover;
            statusLabel = 'Đã kín';
          }

          return (
            <div
              key={`day-${d}`}
              style={{
                borderRadius: 8,
                border: `1px solid ${border}`,
                background: bg,
                padding: '6px 4px',
                textAlign: 'center',
                minHeight: 52,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: (!isPast && !isBooked) ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              }}
              title={isBooked ? 'Ngày này đã có khách' : (isPast ? 'Ngày đã qua' : 'Ngày còn trống')}
              onClick={() => {
                if (!isPast && !isBooked) {
                  const yStr = calYear;
                  const mStr = String(calMonth + 1).padStart(2, '0');
                  const dStr = String(d).padStart(2, '0');
                  setCheckInDate(`${yStr}-${mStr}-${dStr}`);
                  // Next day
                  const nextD = new Date(calYear, calMonth, d + 1);
                  const nextY = nextD.getFullYear();
                  const nextM = String(nextD.getMonth() + 1).padStart(2, '0');
                  const nextDayStr = String(nextD.getDate()).padStart(2, '0');
                  setCheckOutDate(`${nextY}-${nextM}-${nextDayStr}`);
                }
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{d}</span>
              <span style={{ fontSize: 9.5, fontWeight: 600, color: textColor, marginTop: 2 }}>
                {statusLabel}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BRAND.warmCream,
        color: BRAND.warmCharcoal,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ─── Top Bar / Navigation ────────────────────────────────────────── */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: `1px solid ${BRAND.warmCreamBorder}`,
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 4px rgba(77, 51, 34, 0.04)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Logo HIÊN mộc mạc & thanh lịch */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: BRAND.charcoalDark,
                color: BRAND.warmCream,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '1px',
                boxShadow: '0 2px 5px rgba(63, 41, 27, 0.2)',
              }}
            >
              HIÊN
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: BRAND.warmCharcoal, letterSpacing: '-0.3px' }}>
                {homestayName}
              </div>
              <div style={{ fontSize: 11.5, color: BRAND.charcoalMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>📍 {homestayAddress}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* 2 số Hotline / Zalo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: BRAND.softSageLight,
                border: `1px solid ${BRAND.softSageBorder}`,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span style={{ color: BRAND.softSageDark }}>📞 Hotline / Zalo:</span>
              <a
                href={`tel:${cleanPhone1}`}
                title="Bấm để gọi số 1"
                style={{ color: BRAND.softSageDark, fontWeight: 700, textDecoration: 'none' }}
              >
                {rawPhone1}
              </a>
              <span style={{ color: BRAND.softSageBorder }}>·</span>
              <a
                href={`tel:${cleanPhone2}`}
                title="Bấm để gọi số 2"
                style={{ color: BRAND.softSageDark, fontWeight: 700, textDecoration: 'none' }}
              >
                {rawPhone2}
              </a>
            </div>

            {/* Instagram */}
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Xem Instagram @hien.home"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 8,
                background: BRAND.warmCreamLight,
                border: `1px solid ${BRAND.warmCreamTonal}`,
                color: BRAND.warmCharcoal,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              📸 Instagram
            </a>

            {/* TikTok */}
            <a
              href={tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Xem TikTok @hien.homestaysg"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 8,
                background: BRAND.warmCreamLight,
                border: `1px solid ${BRAND.warmCreamTonal}`,
                color: BRAND.warmCharcoal,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              🎵 TikTok
            </a>

            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                background: BRAND.warmCharcoal,
                color: BRAND.warmCream,
                fontSize: 12.5,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              Đăng nhập
            </button>
          </div>
        </div>
      </header>

      {/* ─── Manifesto Box: Quên Luật "14h nhận – 12h trả" ───────────── */}
      <section style={{ maxWidth: 1160, margin: '0 auto', padding: '32px 20px 24px' }}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: 22,
            padding: '36px 32px',
            border: `1.5px solid ${BRAND.warmCreamTonal}`,
            boxShadow: '0 10px 30px -5px rgba(77, 51, 34, 0.07)',
            position: 'relative',
          }}
        >
          {/* Header & Manifesto */}
          <div style={{ textAlign: 'center', maxWidth: 840, margin: '0 auto 30px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 14px',
                borderRadius: 20,
                background: BRAND.warmCreamLight,
                border: `1px solid ${BRAND.warmCreamTonal}`,
                color: BRAND.warmCharcoal,
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 10,
                letterSpacing: '0.4px',
              }}
            >
              🌿 ĐẶC QUYỀN LƯU TRÚ TỰ DO TẠI HIÊN
            </span>
            <h2
              style={{
                fontSize: 'clamp(21px, 3.2vw, 27px)',
                fontWeight: 800,
                color: BRAND.warmCharcoal,
                margin: '8px 0 14px',
                letterSpacing: '-0.3px',
                lineHeight: 1.35,
              }}
            >
              ⏳ Quên luật "14h nhận – 12h trả" đi, giờ giấc ở Hiên là do bạn chọn!
            </h2>
            <p
              style={{
                fontSize: 14.5,
                color: BRAND.charcoalMuted,
                lineHeight: 1.7,
                margin: '0 0 10px',
              }}
            >
              Tụi mình hiểu rằng cảm giác muốn đi "trốn" thường không đến theo giờ hành chính. Có khi đó là một buổi trưa cần góc yên tĩnh để chạy deadline, một đêm lang thang Sài Gòn về khuya, hay một ngày lười biếng chỉ muốn ngủ nướng đến tận chiều.
            </p>
            <p
              style={{
                fontSize: 14,
                color: BRAND.warmCharcoal,
                fontWeight: 600,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Đừng lo lắng nhìn đồng hồ, Hiên thiết kế các khung giờ lưu trú linh hoạt để khớp đúng với nhịp điệu của riêng bạn:
            </p>
          </div>

          {/* 4 Flexible Stay Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 26,
            }}
          >
            {/* Card 1: Theo giờ */}
            <div
              style={{
                background: BRAND.warmCreamLight,
                borderRadius: 14,
                padding: '20px 18px',
                border: `1px solid ${BRAND.warmCreamBorder}`,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>⏳</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: '#ffffff',
                    border: `1px solid ${BRAND.warmCreamTonal}`,
                    color: BRAND.warmCharcoal,
                    padding: '3px 8px',
                    borderRadius: 6,
                  }}
                >
                  Theo giờ
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: BRAND.warmCharcoal, margin: '0 0 6px' }}>
                Tạt qua vài tiếng
              </h3>
              <p style={{ fontSize: 13, color: BRAND.charcoalMuted, lineHeight: 1.55, margin: 0 }}>
                Rảnh lúc nào, ghé lúc đó. Trạm sạc năng lượng lý tưởng giữa ngày dài.
              </p>
            </div>

            {/* Card 2: Qua đêm */}
            <div
              style={{
                background: BRAND.warmCreamLight,
                borderRadius: 14,
                padding: '20px 18px',
                border: `1px solid ${BRAND.warmCreamBorder}`,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>🌙</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: BRAND.softSageLight,
                    border: `1px solid ${BRAND.softSageBorder}`,
                    color: BRAND.softSageDark,
                    padding: '3px 8px',
                    borderRadius: 6,
                  }}
                >
                  Qua đêm
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: BRAND.warmCharcoal, margin: '0 0 6px' }}>
                Đi sớm về khuya
              </h3>
              <p style={{ fontSize: 13, color: BRAND.charcoalMuted, lineHeight: 1.55, margin: 0 }}>
                Check-in muộn sau khi tan ca hoặc đi chơi về, có chỗ êm ái ngủ một giấc thật sâu.
              </p>
            </div>

            {/* Card 3: Cả ngày */}
            <div
              style={{
                background: BRAND.warmCreamLight,
                borderRadius: 14,
                padding: '20px 18px',
                border: `1px solid ${BRAND.warmCreamBorder}`,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>☀️</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: BRAND.terracottaLight,
                    border: `1px solid ${BRAND.terracottaBorder}`,
                    color: BRAND.terracottaHover,
                    padding: '3px 8px',
                    borderRadius: 6,
                  }}
                >
                  Cả ngày
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: BRAND.warmCharcoal, margin: '0 0 6px' }}>
                Lười biếng trọn vẹn
              </h3>
              <p style={{ fontSize: 13, color: BRAND.charcoalMuted, lineHeight: 1.55, margin: 0 }}>
                Tha hồ nhận phòng sớm, ngủ nướng, nấu ăn và thong thả trả phòng không cập rập.
              </p>
            </div>

            {/* Card 4: Gia hạn linh hoạt */}
            <div
              style={{
                background: BRAND.warmCreamLight,
                borderRadius: 14,
                padding: '20px 18px',
                border: `1px solid ${BRAND.warmCreamBorder}`,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>🔄</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: '#ffffff',
                    border: `1px solid ${BRAND.warmCreamTonal}`,
                    color: BRAND.warmCharcoal,
                    padding: '3px 8px',
                    borderRadius: 6,
                  }}
                >
                  Gia hạn linh hoạt
                </span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: BRAND.warmCharcoal, margin: '0 0 6px' }}>
                Ở lâu thêm một chút
              </h3>
              <p style={{ fontSize: 13, color: BRAND.charcoalMuted, lineHeight: 1.55, margin: 0 }}>
                Đang ở mà thấy "cuốn" quá? Chỉ cần phòng trống, bạn có thể báo Hiên để kéo dài thời gian lưu trú bất cứ lúc nào.
              </p>
            </div>
          </div>

          {/* Làm sao Hiên có thể linh hoạt đến vậy? (Self Check-in Highlight Box) */}
          <div
            style={{
              background: BRAND.softSageLight,
              border: `1px solid ${BRAND.softSageBorder}`,
              borderRadius: 14,
              padding: '18px 22px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <span style={{ fontSize: 26, lineHeight: 1, marginTop: 2 }}>🔑</span>
            <div>
              <h4
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: BRAND.softSageDark,
                  margin: '0 0 5px',
                }}
              >
                Làm sao Hiên có thể linh hoạt đến vậy?
              </h4>
              <p style={{ fontSize: 13, color: BRAND.warmCharcoal, lineHeight: 1.6, margin: 0 }}>
                Vì Hiên áp dụng quy trình <strong>Self Check-in (Nhận phòng tự động)</strong> thông minh. Không ai hối thúc, không cần lễ tân đứng đợi. Bất kể bạn đến vào rạng sáng hay giữa đêm, chỉ cần vài thao tác trên điện thoại là có thể tự mở cửa bước vào không gian của riêng mình.
              </p>
            </div>
          </div>

          {/* Call to Action Bar */}
          <div
            style={{
              background: BRAND.warmCream,
              border: `1px solid ${BRAND.warmCreamBorder}`,
              borderRadius: 14,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: BRAND.warmCharcoal }}>
                Bạn định ghé Hiên vào khung giờ nào? Báo để tụi mình giữ phòng nhé!
              </div>
              <div style={{ fontSize: 12, color: BRAND.charcoalMuted, marginTop: 2 }}>
                Nhận trả phòng bất cứ lúc nào phù hợp nhất với bạn
              </div>
            </div>

            <a
              href={`https://zalo.me/${zalo1}?text=${encodeURIComponent('Chào Hiên Homestay, mình muốn tư vấn sắp xếp giờ giấc nhận - trả phòng linh hoạt theo lịch trình riêng của mình nhé!')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '11px 22px',
                borderRadius: 10,
                background: BRAND.terracotta,
                color: '#ffffff',
                fontSize: 13.5,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 3px 8px rgba(193, 122, 90, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>👉 Nhắn Zalo để Hiên sắp xếp giờ giấc cho bạn</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── Hero Section & Fast Filter ──────────────────────────────────── */}
      <section
        style={{
          background: `linear-gradient(145deg, ${BRAND.charcoalDark} 0%, ${BRAND.charcoalDeep} 100%)`,
          color: BRAND.warmCream,
          padding: '52px 20px 68px',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '5px 14px',
              borderRadius: 20,
              background: 'rgba(138, 170, 162, 0.18)',
              border: '1px solid rgba(138, 170, 162, 0.35)',
              color: '#D1EBE5',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 16,
              letterSpacing: '0.2px',
            }}
          >
            🌿 Không gian nghỉ dưỡng ấm cúng · Bình yên & Thư thái
          </span>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, lineHeight: 1.25, marginBottom: 12, color: BRAND.warmCream }}>
            Tìm & Đặt Phòng Tại {homestayName}
          </h1>
          <p style={{ fontSize: 14.5, color: '#D4C4AE', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Trải nghiệm không gian ấm áp như căn nhà thứ hai. Xem ảnh thực tế, tiện ích, kiểm tra các ngày còn trống và liên hệ đặt phòng trực tiếp.
          </p>

          {/* ─── Date Picker Search Bar ──────────────────────────────────── */}
          <form
            onSubmit={handleSearchAvailability}
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '20px 24px',
              boxShadow: '0 12px 30px -5px rgba(37, 24, 15, 0.35)',
              color: BRAND.warmCharcoal,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              alignItems: 'flex-end',
              textAlign: 'left',
              border: `1px solid ${BRAND.warmCreamBorder}`,
            }}
          >
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: BRAND.charcoalMuted, display: 'block', marginBottom: 6 }}>
                📅 Ngày nhận phòng (Check-in)
              </label>
              <input
                type="date"
                value={checkInDate}
                min={getTodayStr()}
                onChange={e => setCheckInDate(e.target.value)}
                style={{
                  width: '100%',
                  height: 44,
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${BRAND.warmCreamTonal}`,
                  fontSize: 13,
                  fontWeight: 600,
                  outline: 'none',
                  color: BRAND.warmCharcoal,
                  background: BRAND.warmCreamLight,
                }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: BRAND.charcoalMuted, display: 'block', marginBottom: 6 }}>
                📅 Ngày trả phòng (Check-out)
              </label>
              <input
                type="date"
                value={checkOutDate}
                min={checkInDate || getTodayStr()}
                onChange={e => setCheckOutDate(e.target.value)}
                style={{
                  width: '100%',
                  height: 44,
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${BRAND.warmCreamTonal}`,
                  fontSize: 13,
                  fontWeight: 600,
                  outline: 'none',
                  color: BRAND.warmCharcoal,
                  background: BRAND.warmCreamLight,
                }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: BRAND.charcoalMuted, display: 'block', marginBottom: 6 }}>
                👥 Số lượng khách
              </label>
              <select
                value={guestCount}
                onChange={e => setGuestCount(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: 44,
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${BRAND.warmCreamTonal}`,
                  fontSize: 13,
                  fontWeight: 600,
                  outline: 'none',
                  background: BRAND.warmCreamLight,
                  color: BRAND.warmCharcoal,
                }}
              >
                <option value={1}>1 khách</option>
                <option value={2}>2 khách</option>
                <option value={3}>3 khách</option>
                <option value={4}>4 khách</option>
                <option value={6}>5 - 6 khách</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={isFiltering}
                style={{
                  width: '100%',
                  height: 44,
                  boxSizing: 'border-box',
                  padding: '0 18px',
                  borderRadius: 8,
                  background: BRAND.terracotta,
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 3px 6px rgba(193, 122, 90, 0.35)',
                  transition: 'background 0.2s',
                }}
              >
                {isFiltering ? 'Đang kiểm tra…' : '🔍 Kiểm tra lịch trống'}
              </button>
            </div>
          </form>

          {/* Banner thông báo kết quả lọc */}
          {availableRoomIds !== null && (
            <div
              style={{
                marginTop: 18,
                padding: '11px 18px',
                borderRadius: 10,
                background: 'rgba(138, 170, 162, 0.22)',
                border: `1px solid ${BRAND.softSage}`,
                color: '#E8F5F2',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🌿</span>
                <span>
                  Tìm thấy <strong>{availableRoomIds.length}</strong> phòng còn trống từ ngày{' '}
                  <strong>{formatDateDisplay(checkInDate)}</strong> đến{' '}
                  <strong>{formatDateDisplay(checkOutDate)}</strong> ({stayNights} đêm)
                </span>
              </div>

              <button
                type="button"
                onClick={handleClearFilter}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.18)',
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.2s',
                }}
              >
                ✕ Xem tất cả phòng
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ─── Room Showcase Grid ─────────────────────────────────────────── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '42px 20px 52px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: BRAND.warmCharcoal, margin: 0, letterSpacing: '-0.3px' }}>
              Danh Sách Phòng Nghỉ
            </h2>
            <p style={{ fontSize: 13.5, color: BRAND.charcoalMuted, marginTop: 4 }}>
              {rooms.length || 6} không gian nhỏ ở {locations.length > 0 ? formatLocationList(locations.map(l => l.name)) : 'Bình Thạnh'} đều được chuẩn bị tươm tất, sạch sẽ, chỉ chờ bạn ghé chơi.
            </p>
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: BRAND.charcoalMuted,
              background: '#fff',
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${BRAND.warmCreamBorder}`,
            }}
          >
            Hiển thị <strong>{displayRooms.length}</strong> phòng
          </div>
        </div>

        {/* ─── Location Filter Tabs ──────────────────────────────────────── */}
        {locations.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedLocationId('all')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                border: selectedLocationId === 'all' ? `1px solid ${BRAND.warmCharcoal}` : `1px solid ${BRAND.warmCreamTonal}`,
                background: selectedLocationId === 'all' ? BRAND.warmCharcoal : '#ffffff',
                color: selectedLocationId === 'all' ? BRAND.warmCream : BRAND.warmCharcoal,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              🏢 Tất cả cơ sở ({rooms.length})
            </button>
            {locations.map(loc => {
              const count = rooms.filter(r => r.locationId === loc.locationId).length;
              const isSelected = selectedLocationId === loc.locationId;
              return (
                <button
                  key={loc.locationId}
                  type="button"
                  onClick={() => setSelectedLocationId(loc.locationId)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    border: isSelected ? `1px solid ${BRAND.warmCharcoal}` : `1px solid ${BRAND.warmCreamTonal}`,
                    background: isSelected ? BRAND.warmCharcoal : '#ffffff',
                    color: isSelected ? BRAND.warmCream : BRAND.warmCharcoal,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📍 Cơ sở {loc.name} ({count})
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: BRAND.charcoalMuted }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
            <div>Đang tải danh sách phòng...</div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: BRAND.terracotta }}>
            <div>{error}</div>
          </div>
        ) : displayRooms.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 0',
              background: '#fff',
              borderRadius: 14,
              border: `1px solid ${BRAND.warmCreamBorder}`,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.warmCharcoal }}>Chưa tìm thấy phòng phù hợp</div>
            <div style={{ fontSize: 13, color: BRAND.charcoalMuted, marginTop: 6 }}>
              Thử giảm số lượng khách hoặc đổi khoảng ngày khác bạn nhé.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 24,
            }}
          >
            {displayRooms.map((room, idx) => {
              const photo = room.imageUrl || FALLBACK_ROOM_IMAGES[idx % FALLBACK_ROOM_IMAGES.length];
              const isAvailableForSelectedDates =
                availableRoomIds === null || availableRoomIds.includes(room.roomId);
              const branchName = locationMap.get(room.locationId);

              return (
                <div
                  key={room.roomId}
                  style={{
                    background: '#ffffff',
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: `1px solid ${BRAND.warmCreamBorder}`,
                    boxShadow: '0 4px 14px rgba(77, 51, 34, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                >
                  {/* Photo with Overlay Badge */}
                  <div style={{ position: 'relative', height: 215, background: BRAND.warmCreamBorder }}>
                    <img
                      src={photo}
                      alt={room.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {branchName && (
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: 'rgba(37, 24, 15, 0.8)',
                            color: BRAND.warmCream,
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          📍 {branchName}
                        </span>
                      )}
                      {availableRoomIds !== null && (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: isAvailableForSelectedDates ? BRAND.softSage : BRAND.terracotta,
                            color: '#fff',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          }}
                        >
                          {isAvailableForSelectedDates ? '✓ Còn trống ngày này' : '✕ Đã kín ngày này'}
                        </span>
                      )}
                    </div>
                    {room.floor && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 10,
                          right: 12,
                          background: 'rgba(37, 24, 15, 0.75)',
                          color: BRAND.warmCream,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 10.5,
                          fontWeight: 600,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        Tầng {room.floor}
                      </div>
                    )}
                  </div>

                  {/* Room Body */}
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: BRAND.warmCharcoal, margin: 0 }}>
                        {room.name}
                      </h3>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.terracotta }}>
                          Giá linh hoạt
                        </div>
                        <div style={{ fontSize: 11, color: BRAND.charcoalMuted, fontWeight: 500 }}>
                          Theo giờ · Qua đêm · Cả ngày · Dài ngày
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 12.5, color: BRAND.charcoalMuted, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>👥 Sức chứa:</span>
                      <strong style={{ color: BRAND.warmCharcoal }}>{room.capacity ? `Tối đa ${room.capacity} khách` : '2 khách tiêu chuẩn'}</strong>
                    </div>

                    {/* Lời nhắn báo giá linh hoạt */}
                    <div
                      style={{
                        margin: '10px 0 6px',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: BRAND.warmCreamLight,
                        border: `1px dashed ${BRAND.warmCreamTonal}`,
                        fontSize: 11.5,
                        color: BRAND.warmCharcoal,
                        lineHeight: 1.45,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>👉</span>
                      <span>Nhắn Hiên để nhận <strong>báo giá chi tiết</strong> theo lịch trình của bạn nhé!</span>
                    </div>

                    {room.description && (
                      <p style={{ fontSize: 12.5, color: BRAND.charcoalMuted, marginTop: 8, lineHeight: 1.5, margin: '8px 0 12px' }}>
                        {room.description}
                      </p>
                    )}

                    {/* Amenities Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto', paddingTop: 10 }}>
                      {(() => {
                        const rawAm = room.amenities;
                        const list = Array.isArray(rawAm)
                          ? rawAm
                          : typeof rawAm === 'string'
                          ? (rawAm as string).split(/[,|\s]+/).map(s => s.trim()).filter(Boolean)
                          : [];
                        const displayList = list.length > 0 ? list.slice(0, 4) : DEFAULT_AMENITIES.slice(0, 4);

                        return displayList.map((am, aIdx) => (
                          <span
                            key={aIdx}
                            style={{
                              fontSize: 11,
                              background: BRAND.warmCream,
                              color: BRAND.warmCharcoal,
                              border: `1px solid ${BRAND.warmCreamBorder}`,
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontWeight: 500,
                            }}
                          >
                            {am}
                          </span>
                        ));
                      })()}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${BRAND.warmCreamBorder}` }}>
                      <button
                        onClick={() => handleOpenCalendar(room)}
                        style={{
                          padding: '9px 10px',
                          borderRadius: 8,
                          background: BRAND.warmCreamLight,
                          color: BRAND.warmCharcoal,
                          fontSize: 12,
                          fontWeight: 700,
                          border: `1px solid ${BRAND.warmCreamTonal}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        📅 Xem lịch trống
                      </button>

                      <button
                        onClick={() => setContactModalRoom(room)}
                        style={{
                          padding: '9px 10px',
                          borderRadius: 8,
                          background: BRAND.terracotta,
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 700,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          boxShadow: '0 2px 4px rgba(193, 122, 90, 0.3)',
                        }}
                      >
                        💬 Đặt phòng
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── Modal: Lịch Trống Chi Tiết Cho Phòng ────────────────────────── */}
      {calendarRoom && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(37, 24, 15, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setCalendarRoom(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              width: '100%',
              maxWidth: 520,
              padding: 26,
              boxShadow: '0 20px 30px -5px rgba(37, 24, 15, 0.3)',
              position: 'relative',
              border: `1px solid ${BRAND.warmCreamBorder}`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 19, fontWeight: 800, color: BRAND.warmCharcoal, margin: 0 }}>
                  Lịch Phòng: {calendarRoom.name}
                </h3>
                <div style={{ fontSize: 12.5, color: BRAND.charcoalMuted, marginTop: 2 }}>
                  Giá: <strong style={{ color: BRAND.terracotta }}>{calendarRoom.priceDisplay || '550.000 ₫ / đêm'}</strong> · Sức chứa: {calendarRoom.capacity || 2} khách
                </div>
              </div>
              <button
                onClick={() => setCalendarRoom(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, color: BRAND.charcoalMuted, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Chú thích màu sắc */}
            <div style={{ display: 'flex', gap: 14, padding: '9px 14px', background: BRAND.warmCream, borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: BRAND.softSageLight, border: `1px solid ${BRAND.softSageBorder}` }} />
                <span style={{ color: BRAND.warmCharcoal }}>Còn trống (Bấm để chọn)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: BRAND.terracottaLight, border: `1px solid ${BRAND.terracottaBorder}` }} />
                <span style={{ color: BRAND.warmCharcoal }}>Đã kín lịch</span>
              </div>
            </div>

            {/* Tháng điều hướng */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <button
                onClick={() => {
                  if (calMonth === 0) {
                    setCalMonth(11);
                    setCalYear(y => y - 1);
                  } else {
                    setCalMonth(m => m - 1);
                  }
                }}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${BRAND.warmCreamTonal}`, background: BRAND.warmCreamLight, color: BRAND.warmCharcoal, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                ‹ Tháng trước
              </button>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: BRAND.warmCharcoal }}>
                Tháng {calMonth + 1} / {calYear}
              </span>
              <button
                onClick={() => {
                  if (calMonth === 11) {
                    setCalMonth(0);
                    setCalYear(y => y + 1);
                  } else {
                    setCalMonth(m => m + 1);
                  }
                }}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${BRAND.warmCreamTonal}`, background: BRAND.warmCreamLight, color: BRAND.warmCharcoal, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Tháng sau ›
              </button>
            </div>

            {calendarLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: BRAND.charcoalMuted, fontSize: 13 }}>
                Đang tải dữ liệu lịch phòng…
              </div>
            ) : (
              renderMonthCalendar()
            )}

            {/* Footer Modal */}
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${BRAND.warmCreamBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: BRAND.charcoalMuted }}>
                Đang chọn: <strong style={{ color: BRAND.warmCharcoal }}>{formatDateDisplay(checkInDate)}</strong> ➔ <strong style={{ color: BRAND.warmCharcoal }}>{formatDateDisplay(checkOutDate)}</strong>
              </div>
              <button
                onClick={() => setContactModalRoom(calendarRoom)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  background: BRAND.terracotta,
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 3px 6px rgba(193, 122, 90, 0.35)',
                }}
              >
                💬 Chốt đặt phòng này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Chọn Kênh Liên Hệ / Zalo Đặt Phòng ────────────────── */}
      {contactModalRoom && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(37, 24, 15, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: 16,
          }}
          onClick={() => setContactModalRoom(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              width: '100%',
              maxWidth: 460,
              padding: 24,
              boxShadow: '0 20px 30px -5px rgba(37, 24, 15, 0.3)',
              position: 'relative',
              border: `1px solid ${BRAND.warmCreamBorder}`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: BRAND.warmCharcoal, margin: 0 }}>
                  Liên Hệ Đặt Phòng
                </h3>
                <div style={{ fontSize: 13, color: BRAND.terracotta, fontWeight: 700, marginTop: 3 }}>
                  {contactModalRoom.name} · Giá linh hoạt theo lịch trình
                </div>
              </div>
              <button
                onClick={() => setContactModalRoom(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, color: BRAND.charcoalMuted, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: BRAND.charcoalMuted, margin: '0 0 16px', lineHeight: 1.5 }}>
              Bạn muốn liên hệ tư vấn và giữ phòng qua kênh nào? Hệ thống đã soạn sẵn nội dung ngày đi ({stayNights} đêm):
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Zalo 1 */}
              <a
                href={makeZaloLink(contactModalRoom.name, zalo1)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: BRAND.softSageLight,
                  border: `1px solid ${BRAND.softSageBorder}`,
                  color: BRAND.softSageDark,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>💬</span>
                  <div>
                    <div>Chat Zalo 1: {rawPhone1}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: BRAND.charcoalMuted }}>Tư vấn & Nhận báo giá nhanh</div>
                  </div>
                </div>
                <span style={{ fontSize: 16 }}>➔</span>
              </a>

              {/* Zalo 2 */}
              <a
                href={makeZaloLink(contactModalRoom.name, zalo2)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: BRAND.warmCreamLight,
                  border: `1px solid ${BRAND.warmCreamTonal}`,
                  color: BRAND.warmCharcoal,
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: 13.5,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>💬</span>
                  <div>
                    <div>Chat Zalo 2: {rawPhone2}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: BRAND.charcoalMuted }}>Hotline giữ phòng 24/7</div>
                  </div>
                </div>
                <span style={{ fontSize: 16 }}>➔</span>
              </a>

              {/* Instagram */}
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#FAF5EE',
                  border: `1px solid ${BRAND.warmCreamBorder}`,
                  color: BRAND.warmCharcoal,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📸</span>
                  <div>
                    <div>Instagram: @hien.home</div>
                    <div style={{ fontSize: 11, color: BRAND.charcoalMuted }}>Nhắn tin Direct Message trực tiếp</div>
                  </div>
                </div>
                <span style={{ fontSize: 16 }}>➔</span>
              </a>

              {/* TikTok */}
              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#FAF5EE',
                  border: `1px solid ${BRAND.warmCreamBorder}`,
                  color: BRAND.warmCharcoal,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🎵</span>
                  <div>
                    <div>TikTok: @hien.homestaysg</div>
                    <div style={{ fontSize: 11, color: BRAND.charcoalMuted }}>Xem video review phòng thực tế</div>
                  </div>
                </div>
                <span style={{ fontSize: 16 }}>➔</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── Footer Section: Thông tin & Hướng dẫn ─────────────────────── */}
      <footer
        style={{
          background: BRAND.charcoalDeep,
          color: BRAND.warmCreamTonal,
          padding: '52px 20px 28px',
          borderTop: `1px solid ${BRAND.charcoalDark}`,
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 36, marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, color: BRAND.warmCream, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏡</span> {homestayName}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: '#C2B09A' }}>
              Không gian nghỉ dưỡng bình yên, vị trí thuận tiện di chuyển, cam kết vệ sinh sạch sẽ và dịch vụ tận tâm.
            </p>
          </div>

          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: BRAND.warmCream, marginBottom: 12 }}>
              ⏰ Khung Giờ Lưu Trú (Xê dịch thoải mái theo lịch của bạn)
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.85, color: '#C2B09A' }}>
              <div style={{ marginBottom: 6 }}>• <strong>Tạt qua (Theo giờ):</strong> Rảnh lúc nào ghé lúc đó, chỉ cần nhắn trước để Hiên check lịch trống.</div>
              <div style={{ marginBottom: 6 }}>• <strong>Ngủ một giấc (Qua đêm):</strong> Trọn vẹn một đêm êm ái. Khung giờ phổ biến là 21:00 — 10:00 hôm sau, nhưng bạn hoàn toàn có thể đẩy lịch đến sớm hơn hoặc lùi giờ trả lại tùy ý.</div>
              <div style={{ marginBottom: 6 }}>• <strong>Lười biếng trọn vẹn (Cả ngày):</strong> Trải nghiệm nguyên ngày thảnh thơi (thường từ 14:00 — 12:00). Cần nhận phòng sớm cất đồ hay ngủ nướng thêm vài tiếng? Cứ báo, Hiên sắp xếp được hết!</div>
              <div style={{ marginTop: 10, color: '#E5D9C8', fontWeight: 600 }}>
                🔑 Quy trình Self check-in 100% tự động, nhanh gọn và riêng tư.
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: BRAND.warmCream, marginBottom: 12 }}>
              📞 Kênh Liên Hệ & Mạng Xã Hội
            </div>
            <div style={{ fontSize: 13, lineHeight: 2, color: '#C2B09A' }}>
              <div>📍 <strong>Địa chỉ:</strong> {homestayAddress}</div>
              <div>💬 <strong>Zalo 1:</strong> <a href={`https://zalo.me/${zalo1}`} target="_blank" rel="noreferrer" style={{ color: BRAND.warmCream, textDecoration: 'underline' }}>{rawPhone1}</a></div>
              <div>💬 <strong>Zalo 2:</strong> <a href={`https://zalo.me/${zalo2}`} target="_blank" rel="noreferrer" style={{ color: BRAND.warmCream, textDecoration: 'underline' }}>{rawPhone2}</a></div>
              <div>📸 <strong>Instagram:</strong> <a href={instagramUrl} target="_blank" rel="noreferrer" style={{ color: BRAND.warmCream, textDecoration: 'underline' }}>@hien.home</a></div>
              <div>🎵 <strong>TikTok:</strong> <a href={tiktokUrl} target="_blank" rel="noreferrer" style={{ color: BRAND.warmCream, textDecoration: 'underline' }}>@hien.homestaysg</a></div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', paddingTop: 24, borderTop: '1px solid rgba(229, 217, 200, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ color: '#A69888' }}>© {new Date().getFullYear()} {homestayName}. All rights reserved.</div>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#C2B09A',
              cursor: 'pointer',
              fontSize: 12,
              textDecoration: 'underline',
            }}
          >
            Đăng nhập
          </button>
        </div>
      </footer>
    </div>
  );
}
