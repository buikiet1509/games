import Phaser from 'phaser';
import { WORLD } from '@chua/shared';
import { CourtyardScene } from './CourtyardScene';
import { HallScene } from './HallScene';
import type { TempleRoom } from '../net/game';
import { C } from './palette';

export function createGame(parent: HTMLElement, room: TempleRoom, areaId: string) {
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
  const Scene = areaId === 'chinh-dien' ? HallScene : CourtyardScene;
  game.scene.add(areaId, Scene, true, { room });
  return game;
}
