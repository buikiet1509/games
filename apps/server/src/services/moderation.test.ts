import { describe, expect, it } from 'vitest';
import { createProfanityFilter } from './moderation';

const filter = createProfanityFilter(['tu cam them']);

describe('lọc từ ngữ thô tục', () => {
  it('giữ nguyên lời nguyện bình thường (kể cả từ dễ nhầm khi bỏ dấu)', () => {
    for (const text of [
      'Nguyện cho gia đình bình an, mẹ mau khoẻ.',
      'Các con đeo vòng, mua lon nước, dì út khoẻ.',
      'Nam mô Bổn Sư Thích Ca Mâu Ni Phật',
    ]) {
      expect(filter(text)).toEqual({ text, flagged: false });
    }
  });

  it('che từ có dấu, giữ nguyên phần còn lại và khoảng trắng', () => {
    expect(filter('Đồ  đéo ra gì!')).toEqual({ text: 'Đồ  *** ra gì!', flagged: true });
  });

  it('bắt viết tắt, không dấu, chữ lặp và leetspeak', () => {
    expect(filter('vcl thật').text).toBe('*** thật');
    expect(filter('DM nhé').text).toBe('** nhé');
    expect(filter('fuuuuck').flagged).toBe(true);
    expect(filter('sh1t').flagged).toBe(true);
  });

  it('bắt cụm nhiều từ', () => {
    expect(filter('đụ má mày').text).toBe('** ** mày'); // khớp cả cụm "du ma"
    expect(filter('dit me no').text).toBe('*** ** no');
  });

  it('dùng được danh sách bổ sung từ cấu hình', () => {
    expect(filter('đây là từ cấm thêm').text).toBe('đây là ** *** ****');
  });
});
