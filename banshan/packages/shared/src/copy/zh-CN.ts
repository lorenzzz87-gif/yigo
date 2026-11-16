/**
 * 简体中文文案（§8）。语气：短、安静、不说教、不用感叹号。
 * v1.1 的繁体和英文按同样的结构另建文件，并满足 `Copy` 类型。
 */
export const zhCN = {
  brand: { name: '半山', subtitle: '云上禅寺' },
  footer: '半山是一个中式静心空间，不是宗教机构，与任何寺院无关。',
  loading: '山门已开，稍候。',
  firstHint: '点地面走动，拖动看看四周。这里不用说话。',
  rename: '换个名字',
  bellSoon: '钟声将至。',
  incenseDone: '一炷香尽了。',
  actions: { hezi: '合十', bai: '礼拜', muyu: '木鱼', nianzhu: '念珠' },
  interact: { sit: '坐下', incense: '上一炷香', donate: '随喜' },
  seatTaken: '这个蒲团有人了。',
  lamp: {
    panel: '写一句话，点一盏灯。这句话只留在你自己手里。',
    already: '今天的灯已经亮着了，明天再来。',
    mine: '我的灯',
  },
  donate: { panel: '随喜，不换任何东西。' },
  leave: '下山',
  /** {time} 由调用方替换，例如「明早 7:00」 */
  farewell: '下山了。下次钟声：{time}。',
  names: [
    '慢步的人',
    '听雨的人',
    '看云的人',
    '晚归的人',
    '煮茶的人',
    '发呆的人',
    '等风的人',
    '扫叶的人',
    '数星的人',
    '早起的人',
    '晒书的人',
    '听钟的人',
    '走累的人',
    '路过的人',
    '看山的人',
    '闻香的人',
  ],
} as const;

type Widen<T> = T extends string
  ? string
  : T extends readonly string[]
    ? readonly string[]
    : { readonly [K in keyof T]: Widen<T[K]> };

/** 其他语言的文案文件需满足的结构 */
export type Copy = Widen<typeof zhCN>;
