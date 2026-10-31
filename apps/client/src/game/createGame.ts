import Phaser from 'phaser';
import { WORLD } from '@chua/shared';
import { TempleScene } from './TempleScene';
import type { TempleRoom } from '../net/game';
import { C } from './palette';

export function createGame(parent: HTMLElement, room: TempleRoom) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD.width,
    height: WORLD.height,
    backgroundColor: C.paper,
    // ENVELOP: phủ kín khung (cắt bớt mép nếu khác tỉ lệ), giống ảnh nền trong thiết kế.
    scale: { mode: Phaser.Scale.ENVELOP, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    banner: false,
    audio: { noAudio: true },
  });
  game.scene.add('temple', TempleScene, true, { room });
  return game;
}
