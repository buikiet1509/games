import { z } from 'zod';

const coord = z.number().finite();

/** Tin nhắn client → server trong room. Server luôn validate trước khi dùng. */
export const clientMessageSchemas = {
  move_to: z.object({ x: coord, y: coord }),
  dir: z.object({ x: z.number().int().min(-1).max(1), y: z.number().int().min(-1).max(1) }),
} as const;

export type ClientMessageType = keyof typeof clientMessageSchemas;
export type ClientMessage<T extends ClientMessageType> = z.infer<(typeof clientMessageSchemas)[T]>;
