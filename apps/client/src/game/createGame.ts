import Phaser from 'phaser';
import { WORLD } from '@chua/shared';
import type { AreaId } from '@chua/shared';
import { BellTowerScene } from './BellTowerScene';
import { CourtyardScene } from './CourtyardScene';
import { GateScene } from './GateScene';
import { HallScene } from './HallScene';
import { PondScene } from './PondScene';

const SCENES: Record<AreaId, new () => Phaser.Scene> = {
  'cong-tam-quan': GateScene,
  'san-chua': CourtyardScene,
  'chinh-dien': HallScene,
  'ho-sen': PondScene,
  'gac-chuong': BellTowerScene,
};
import type { TempleRoom } from '../net/game';
import { C } from './palette';

export function createGame(parent: HTMLElement, room: TempleRoom, areaId: AreaId) {
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
  game.scene.add(areaId, SCENES[areaId], true, { room });
  return game;
}
