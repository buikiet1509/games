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
    backgroundColor: C.paper,
    // Canvas lấp đầy khung theo kích thước thật; camera trong cảnh tự phóng to vừa khung và
    // bám theo nhân vật (xem AreaScene.fitCamera) — trên điện thoại dọc vẫn thấy mình và lối đi.
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || WORLD.width,
      height: parent.clientHeight || WORLD.height,
    },
    render: { antialias: true },
    banner: false,
    audio: { noAudio: true },
  });
  game.scene.add(areaId, SCENES[areaId], true, { room });
  return game;
}
