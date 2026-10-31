import { AREAS } from '@chua/shared';

// Màn tạm cho mốc 1 — sẽ thay bằng màn đăng nhập (mốc 3) và cảnh Phaser (mốc 4).
export function App() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Chùa An Lạc Online</h1>
      <p>Khung dự án đã sẵn sàng. Các khu vực:</p>
      <ul>
        {AREAS.map((a) => (
          <li key={a.id}>{a.name}</li>
        ))}
      </ul>
    </main>
  );
}
