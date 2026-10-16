/**
 * 写作训练题库。
 *
 * 目标是「推一小步」，不是命题作文，也不带评判和成就机制。
 * 每条都尽量落到可感知的具体动作或感官上。
 */

export interface PromptItem {
  id: string;
  /** 训练指令正文。 */
  text: string;
  /** 一句克制的提示。 */
  hint: string;
}

/** 灵感抽卡。 */
export const CARD_PROMPTS: PromptItem[] = [
  { id: "card-1", text: "一个总在雨天出现的人，从来没有带伞。", hint: "不要解释他是谁。" },
  { id: "card-2", text: "一间房间里少了一件东西，但没人知道是什么。", hint: "让缺失自己说话。" },
  { id: "card-3", text: "有人把十年前写给自己的信寄了出去。", hint: "写收信的那一天。" },
  { id: "card-4", text: "一个人突然开始记得陌生人的梦。", hint: "从一个具体的梦开始。" },
  { id: "card-5", text: "你在旧书里发现了一张不是书主人的照片。", hint: "只写你能看见的细节。" },
  { id: "card-6", text: "一件旧衣服记得它的主人，却发现主人已经忘了它。", hint: "换个视角，不换语气。" },
  { id: "card-7", text: "一个人每天经过同一条街，直到有一天发现所有人都不认识他了。", hint: "不要写他的心理活动。" },
  { id: "card-8", text: "凌晨三点，你收到一封没有寄件人的信。", hint: "先写信封的样子。" },
  { id: "card-9", text: "写一个正在离开的人，但全文不要出现「离开」。", hint: "让动作替你说话。" },
  { id: "card-10", text: "一个人开始收集别人不要的东西。", hint: "写清楚他为什么留下第一件。" },
  { id: "card-11", text: "一场雨停在半空中，所有人在原地等了很久。", hint: "只写人们做了什么。" },
  { id: "card-12", text: "你搬走以后，那间房子还在替你做一件事。", hint: "这件事要具体。" },
];

/** 观察训练：从物件、空间、声音、气味、动作切入。 */
export const OBSERVATION_PROMPTS: PromptItem[] = [
  { id: "obs-1", text: "一把用了很多年的伞", hint: "只写能被看见、摸到、听见的东西，暂时不要解释它。" },
  { id: "obs-2", text: "一杯已经凉掉的咖啡", hint: "用五个感官写它，但不要写「好喝」或「难喝」。" },
  { id: "obs-3", text: "厨房水槽里的一只碗", hint: "写它的位置、水渍的形状、你伸手时的犹豫。" },
  { id: "obs-4", text: "傍晚六点的公交车厢", hint: "写声音和光线，不要写任何人的脸。" },
  { id: "obs-5", text: "楼道里的声控灯", hint: "写它亮起来和熄灭的节奏，以及那之间的黑暗。" },
  { id: "obs-6", text: "一件洗到褪色的衣服", hint: "写它最旧的地方在哪里。" },
  { id: "obs-7", text: "下雨前十分钟的空气", hint: "写气味、声音和皮肤的感觉。" },
  { id: "obs-8", text: "一个人系鞋带的动作", hint: "写动作的顺序，不写他在想什么。" },
];

/** 思维训练：换视角、隐藏信息、反常细节。 */
export const THINKING_PROMPTS: PromptItem[] = [
  {
    id: "think-1",
    text: "一个人坐在火车站等人。",
    hint: "第一次从正在等的人写；第二次从不会出现的那个人写。",
  },
  {
    id: "think-2",
    text: "两个人正在争吵，但你先写楼下听到这段争吵的人。",
    hint: "听不见的部分要留在外面。",
  },
  {
    id: "think-3",
    text: "同一顿饭，先写主人的视角，再写一个迟到的客人。",
    hint: "两个人必须留意到不同的东西。",
  },
  {
    id: "think-4",
    text: "写一个家庭聚会，但有一个在场的人你不知道是谁。",
    hint: "不要揭穿他，也不要暗示。",
  },
  {
    id: "think-5",
    text: "一件小事发生了两次，第二次少了一个细节。",
    hint: "让读者自己发现少了什么。",
  },
  {
    id: "think-6",
    text: "从一件物品的角度写它被搬走的那一天。",
    hint: "物品不能有情绪，只能有位置和状态。",
  },
  {
    id: "think-7",
    text: "写一段告别，但两个人始终在谈别的事。",
    hint: "真正的话放在留白里。",
  },
  {
    id: "think-8",
    text: "你最先写结尾，再倒着写它怎么走到这里。",
    hint: "倒叙也要有顺序。",
  },
];

/** 用固定输入保证「抽卡」结果可复现，避免同一页面刷新后跳变。 */
export function pickPrompt(list: PromptItem[], seed: number): PromptItem {
  const index = Math.abs(Math.floor(seed)) % list.length;
  return list[index]!;
}
