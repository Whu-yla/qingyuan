/* 青元剑诀 · 剑阵守山 —— 关卡与数值配置
 * 塔防模式的全部可调参数（塔、敌人、法术、关卡波次与 Boss）。
 * 依赖：无。挂载 window.QYTD_CONFIG，供 world.js / game.js 读取。
 */
(function () {
  'use strict';

  // 九曲石道：从北侧魔门蜿蜒到东南青云阵眼（坐标为 x,z；y=0 地面）
  var PATH = [
    [-19, -22], [-13, -17], [-7, -19], [-1, -15], [3, -9],
    [-1, -3], [3, 3], [-1, 9], [5, 12], [10, 9], [11, 3], [10, 0]
  ];

  var TOWERS = {
    lianhua: {
      key: 'lianhua', name: '莲花剑阵', glyph: '莲', cost: 55, color: 0x7cf6c8,
      range: 4.6, damage: 16, interval: 0.7, kind: 'aoe', desc: '范围剑光'
    },
    dageng: {
      key: 'dageng', name: '大庚剑阵', glyph: '庚', cost: 75, color: 0xffd57a,
      range: 7.6, damage: 34, interval: 0.55, kind: 'beam', desc: '远距剑气'
    },
    qingyuan: {
      key: 'qingyuan', name: '青元剑盾', glyph: '盾', cost: 50, color: 0x6fd6ff,
      range: 4.8, damage: 7, interval: 0.9, kind: 'slow', slow: 0.42, desc: '剑域减速'
    },
    pixie: {
      key: 'pixie', name: '辟邪神雷', glyph: '雷', cost: 85, color: 0xb28bff,
      range: 7.2, damage: 30, interval: 1.15, kind: 'chain', chain: 3, chainRange: 4.5, desc: '连跳三敌'
    },
    jujian: {
      key: 'jujian', name: '巨剑术', glyph: '巨', cost: 110, color: 0xff9a62,
      range: 8.4, damage: 130, interval: 2.3, kind: 'heavy', splash: 1.8, desc: '巨剑天降'
    }
  };

  var ENEMIES = {
    wolf: {
      key: 'wolf', name: '风狼', hp: 46, speed: 3.3, reward: 7, leak: 1,
      color: 0xa9c7ff, scale: 0.72, shape: 'wolf', radius: 0.34, height: 1.1
    },
    cultivator: {
      key: 'cultivator', name: '魔修', hp: 70, speed: 2.2, reward: 8, leak: 1,
      color: 0x9a7bff, scale: 0.86, shape: 'human', radius: 0.35, height: 1.6
    },
    ghost: {
      key: 'ghost', name: '阴魂', hp: 100, speed: 2.5, reward: 10, leak: 1,
      color: 0x66ffd0, scale: 0.82, shape: 'ghost', radius: 0.36, height: 1.5, slowResist: 0.55
    },
    puppet: {
      key: 'puppet', name: '炼尸傀儡', hp: 190, speed: 1.6, reward: 14, leak: 2,
      color: 0xd8a668, scale: 0.98, shape: 'puppet', radius: 0.42, height: 1.8
    },
    elite: {
      key: 'elite', name: '魔将', hp: 430, speed: 1.7, reward: 30, leak: 3,
      color: 0xff6a6a, scale: 1.12, shape: 'elite', radius: 0.46, height: 2.0
    }
  };

  // 玩家法术：键位 1-5 / 手势五式。cd 秒，damage 单次基础伤害。
  var SPELLS = {
    pixie: {
      key: 'pixie', name: '辟邪神雷', keyLabel: '1', gesture: 'DRAGON', cd: 9,
      radius: 4.6, damage: 115, chain: 4, type: 'chain', color: 0xb28bff,
      desc: '剑指引雷，连轰四敌'
    },
    lotus: {
      key: 'lotus', name: '莲花剑阵', keyLabel: '2', gesture: 'LOTUS', cd: 15,
      radius: 5.2, damage: 175, slow: 0.4, slowDuration: 3, type: 'aoe', color: 0x7cf6c8,
      desc: '五指绽放，剑莲爆发'
    },
    dageng: {
      key: 'dageng', name: '大庚剑阵', keyLabel: '3', gesture: 'DAGENG', cd: 13,
      radius: 2.4, damage: 390, stun: 2, type: 'heavy', color: 0xffd57a,
      desc: '庚金剑气，单体重创'
    },
    giant: {
      key: 'giant', name: '巨剑术', keyLabel: '4', gesture: 'GIANT', cd: 28,
      radius: 6.0, damage: 200, hits: 3, type: 'meteor', color: 0xff9a62,
      desc: '八字引剑，巨剑天降'
    },
    shield: {
      key: 'shield', name: '青元剑盾', keyLabel: '5', gesture: 'SHIELD', cd: 35,
      type: 'shield', heal: 4, slow: 0.55, slowDuration: 4, color: 0x6fd6ff,
      desc: '握拳护阵，回血减速'
    }
  };

  var LEVELS = [
    {
      index: 1, name: '慕兰风起', bossName: '慕兰圣女', realm: '元婴中期 · 慕兰族',
      desc: '慕兰圣女驱使风狼与炼尸叩山，九曲石道上狼烟骤起。',
      tip: '风狼脚快，先在弯道内侧布莲花剑阵与大庚剑阵，别让它们冲过阵眼。',
      startSpirit: 175, baseHp: 20, spiritPerSec: 3,
      waves: [
        { groups: [{ type: 'wolf', count: 8, gap: 0.85, delay: 0 }] },
        { groups: [{ type: 'cultivator', count: 6, gap: 1.0, delay: 0 }, { type: 'wolf', count: 6, gap: 1.2, delay: 2.5 }] },
        { groups: [{ type: 'puppet', count: 4, gap: 1.6, delay: 0 }, { type: 'wolf', count: 8, gap: 0.8, delay: 2 }] },
        { groups: [{ type: 'elite', count: 2, gap: 2.4, delay: 0 }, { type: 'cultivator', count: 10, gap: 0.9, delay: 1.5 }] },
        { groups: [{ type: 'elite', count: 3, gap: 2.2, delay: 0 }, { type: 'puppet', count: 6, gap: 1.4, delay: 2 }] }
      ],
      boss: {
        name: '慕兰圣女', realm: '元婴中期 · 慕兰族', title: '风起大漠 · 万狼听令',
        hp: 1500, speed: 1.3, scale: 1.35, color: 0x8fd0ff, leak: 8,
        abilities: [
          { type: 'summon', interval: 8, unit: 'wolf', count: 2, label: '风狼召来' },
          { type: 'slowTowers', interval: 12, duration: 3, mult: 0.65, label: '风刃乱阵' }
        ]
      }
    },
    {
      index: 2, name: '阴罗哭魂', bossName: '天哭上人', realm: '元婴后期 · 阴罗宗',
      desc: '阴罗宗天哭上人携阴魂压境，哭魂魔音一起，剑阵迟滞。',
      tip: '辟邪神雷专克阴邪功法；青元剑盾减速可拖住阴魂，集中火力先杀魔将。',
      startSpirit: 185, baseHp: 20, spiritPerSec: 3,
      waves: [
        { groups: [{ type: 'ghost', count: 8, gap: 0.9, delay: 0 }] },
        { groups: [{ type: 'cultivator', count: 8, gap: 0.9, delay: 0 }, { type: 'ghost', count: 6, gap: 1.1, delay: 2 }] },
        { groups: [{ type: 'puppet', count: 5, gap: 1.5, delay: 0 }, { type: 'ghost', count: 8, gap: 0.9, delay: 2 }] },
        { groups: [{ type: 'elite', count: 3, gap: 2.2, delay: 0 }, { type: 'cultivator', count: 10, gap: 0.8, delay: 1.5 }] },
        { groups: [{ type: 'puppet', count: 4, gap: 1.5, delay: 0 }, { type: 'ghost', count: 8, gap: 0.8, delay: 1.5 }] }
      ],
      boss: {
        name: '天哭上人', realm: '元婴后期 · 阴罗宗', title: '哭魂魔音 · 万鬼哭山',
        hp: 2700, speed: 1.2, scale: 1.4, color: 0x7de2c8, leak: 9,
        abilities: [
          { type: 'summon', interval: 8, unit: 'ghost', count: 2, label: '阴魂不散' },
          { type: 'slowTowers', interval: 10, duration: 3, mult: 0.55, label: '哭魂魔音' },
          { type: 'shield', interval: 11, amount: 260, label: '阴罗鬼甲' }
        ]
      }
    },
    {
      index: 3, name: '乱星六道', bossName: '六道极圣', realm: '元婴后期 · 乱星海',
      desc: '六道极圣以炼尸傀儡开路，六道轮回间身形倏忽，直逼阵眼。',
      tip: '傀儡皮厚，巨剑术与辟邪神雷优先；他会瞬移抢道，留好莲花剑阵的爆发。',
      startSpirit: 195, baseHp: 20, spiritPerSec: 3,
      waves: [
        { groups: [{ type: 'wolf', count: 10, gap: 0.7, delay: 0 }, { type: 'puppet', count: 4, gap: 1.6, delay: 2 }] },
        { groups: [{ type: 'ghost', count: 8, gap: 0.9, delay: 0 }, { type: 'puppet', count: 8, gap: 1.3, delay: 2 }] },
        { groups: [{ type: 'elite', count: 4, gap: 2.0, delay: 0 }, { type: 'cultivator', count: 10, gap: 0.8, delay: 1.5 }] },
        { groups: [{ type: 'puppet', count: 6, gap: 1.3, delay: 0 }, { type: 'ghost', count: 8, gap: 0.8, delay: 2 }] },
        { groups: [{ type: 'elite', count: 3, gap: 2.0, delay: 0 }, { type: 'puppet', count: 6, gap: 1.2, delay: 2 }] }
      ],
      boss: {
        name: '六道极圣', realm: '元婴后期 · 乱星海', title: '六道轮回 · 炼尸成军',
        hp: 3900, speed: 1.25, scale: 1.5, color: 0xc9a2ff, leak: 9,
        abilities: [
          { type: 'summon', interval: 9, unit: 'puppet', count: 2, label: '炼尸出土' },
          { type: 'teleport', interval: 10, advance: 0.05, label: '六道轮回' },
          { type: 'shield', interval: 8, amount: 320, label: '极圣魔甲' }
        ]
      }
    },
    {
      index: 4, name: '元刹临世', bossName: '元刹圣祖', realm: '化神后期 · 魔界圣祖分身',
      desc: '魔界元刹圣祖分身临世，血魔护体、召魔将，青云山门存亡在此一战。',
      tip: '血魔护体会回盾，攒着巨剑术与神雷打爆发；魔将漏过去会重创阵眼。',
      startSpirit: 215, baseHp: 20, spiritPerSec: 3.2,
      waves: [
        { groups: [{ type: 'ghost', count: 10, gap: 0.8, delay: 0 }, { type: 'puppet', count: 6, gap: 1.4, delay: 2 }] },
        { groups: [{ type: 'cultivator', count: 8, gap: 0.9, delay: 0 }, { type: 'wolf', count: 8, gap: 1.0, delay: 2 }] },
        { groups: [{ type: 'elite', count: 5, gap: 1.9, delay: 0 }, { type: 'puppet', count: 10, gap: 1.2, delay: 1.5 }] },
        { groups: [{ type: 'ghost', count: 10, gap: 0.75, delay: 0 }, { type: 'elite', count: 6, gap: 1.8, delay: 2 }] },
        { groups: [{ type: 'puppet', count: 6, gap: 1.2, delay: 0 }, { type: 'ghost', count: 10, gap: 0.7, delay: 1 }, { type: 'elite', count: 4, gap: 1.8, delay: 2 }] }
      ],
      boss: {
        name: '元刹圣祖', realm: '化神后期 · 魔界圣祖分身', title: '血魔护体 · 万魔朝宗',
        hp: 5600, speed: 1.2, scale: 1.65, color: 0xff7a7a, leak: 10,
        abilities: [
          { type: 'summon', interval: 9, unit: 'elite', count: 2, label: '魔将听令' },
          { type: 'shield', interval: 8, amount: 420, label: '血魔护体' },
          { type: 'slowTowers', interval: 11, duration: 3, mult: 0.5, label: '魔威压阵' },
          { type: 'enrage', at: 0.4, speedMult: 1.5, label: '圣祖真怒' }
        ]
      }
    }
  ];

  window.QYTD_CONFIG = {
    VERSION: '1.0.0',
    STORAGE_KEY: 'qy-td-progress-v1',
    PATH: PATH,
    BASE_POSITION: [10, 0],
    TOWERS: TOWERS,
    ENEMIES: ENEMIES,
    SPELLS: SPELLS,
    LEVELS: LEVELS
  };
})();
