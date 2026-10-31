import { MapSchema, Schema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') name = '';
  @type('string') robeColor = '';
  // Làm tròn về số nguyên: đủ mịn khi client nội suy, tiết kiệm băng thông.
  @type('int16') x = 0;
  @type('int16') y = 0;
  @type('boolean') moving = false;
  /**
   * Tư thế người khác cần thấy: '' (đứng) | 'kneeling' (quỳ trên thảm) | 'bowing' (đang cúi lạy,
   * bắt đầu đúng lúc người đó nhấn giữ nút).
   */
  @type('string') action = '';
}

export class TempleState extends Schema {
  @type('string') areaId = '';
  @type({ map: Player }) players = new MapSchema<Player>();
}
