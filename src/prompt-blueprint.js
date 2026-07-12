/**
 * PromptBlueprint domain registry.
 * The UI should read these registries instead of hard-coding task types or dimensions.
 */

export const TASK_TYPES = [
  {
    id: "poster",
    name: "海报",
    description: "活动、品牌或传播用途的视觉海报",
    defaultRatio: "3:4",
    requiredFields: ["intent", "subject", "technical"],
    supportedDimensionIds: [
      "visual_style",
      "character_style",
      "color_style",
      "layout_style",
      "composition",
      "material",
      "information_density",
      "brand_tone"
    ],
    promptProfile: "poster"
  },
  {
    id: "landing_page",
    name: "Landing Page",
    description: "品牌、产品或活动的页面视觉方向板",
    defaultRatio: "16:9",
    requiredFields: ["intent", "audience", "subject"],
    supportedDimensionIds: [
      "visual_style",
      "color_style",
      "layout_style",
      "composition",
      "information_density",
      "brand_tone"
    ],
    promptProfile: "landing-page"
  },
  {
    id: "dashboard",
    name: "Dashboard 方向板",
    description: "B 端数据产品的界面风格与信息层级方向板",
    defaultRatio: "16:9",
    requiredFields: ["intent", "audience"],
    supportedDimensionIds: [
      "visual_style",
      "color_style",
      "layout_style",
      "information_density",
      "data_hierarchy",
      "brand_tone"
    ],
    promptProfile: "dashboard"
  },
  {
    id: "character_ip",
    name: "卡通 / IP 形象",
    description: "角色、吉祥物或个人 IP 的视觉方向板",
    defaultRatio: "3:4",
    requiredFields: ["intent", "subject"],
    supportedDimensionIds: [
      "character_style",
      "color_style",
      "composition",
      "material",
      "character_proportion",
      "brand_tone"
    ],
    promptProfile: "character-ip"
  }
];

export const EXPLORATION_DIMENSIONS = [
  {
    id: "visual_style",
    name: "设计风格",
    description: "改变整体视觉语言，不改变主体、用途和信息结构",
    applicableTaskTypeIds: ["poster", "landing_page", "dashboard"],
    defaultOptions: ["极简编辑感", "复古印刷感", "未来科技感", "生活方式摄影感"],
    lockFields: ["subject", "intent", "technical", "textLayout"]
  },
  {
    id: "character_style",
    name: "卡通 / 角色风格",
    description: "改变角色的绘制、渲染或卡通表达方式",
    applicableTaskTypeIds: ["poster", "character_ip"],
    defaultOptions: ["2D 扁平插画", "3D 潮玩", "黏土软质感", "绘本卡通"],
    lockFields: ["subject", "character_proportion", "composition", "technical"]
  },
  {
    id: "color_style",
    name: "色彩风格",
    description: "改变色彩系统和情绪，不改变主体与构图",
    applicableTaskTypeIds: ["poster", "landing_page", "dashboard", "character_ip"],
    defaultOptions: ["低饱和奶油色", "高对比黑白", "暖橙蓝", "冷色霓虹"],
    lockFields: ["subject", "composition", "layout", "technical"]
  },
  {
    id: "layout_style",
    name: "版式风格",
    description: "改变信息和主体的页面组织方式",
    applicableTaskTypeIds: ["poster", "landing_page", "dashboard"],
    defaultOptions: ["大标题单主体", "杂志网格", "左右分栏", "卡片化布局"],
    lockFields: ["subject", "visualLanguage", "technical"]
  },
  {
    id: "composition",
    name: "构图与镜头",
    description: "改变主体距离、视角、空间轴线和镜头关系",
    applicableTaskTypeIds: ["poster", "landing_page", "character_ip"],
    defaultOptions: ["主体特写", "平视中景", "俯视构图", "开放式偏轴"],
    lockFields: ["subject", "visualLanguage", "technical"]
  },
  {
    id: "material",
    name: "材质与质感",
    description: "改变表面、渲染和触感表达",
    applicableTaskTypeIds: ["poster", "character_ip"],
    defaultOptions: ["纸张印刷", "金属玻璃", "毛绒软质", "胶片颗粒"],
    lockFields: ["subject", "composition", "technical"]
  },
  {
    id: "information_density",
    name: "信息密度",
    description: "改变画面或界面的信息量与留白关系",
    applicableTaskTypeIds: ["poster", "landing_page", "dashboard"],
    defaultOptions: ["极简留白", "平衡信息", "高密度信息", "模块化分区"],
    lockFields: ["subject", "color_style", "technical"]
  },
  {
    id: "brand_tone",
    name: "品牌气质",
    description: "改变品牌表达的性格和情绪",
    applicableTaskTypeIds: ["poster", "landing_page", "dashboard", "character_ip"],
    defaultOptions: ["高端克制", "亲和轻松", "专业理性", "年轻潮流"],
    lockFields: ["subject", "technical"]
  },
  {
    id: "data_hierarchy",
    name: "数据层级",
    description: "改变 Dashboard 中关键指标、趋势和明细的视觉优先级",
    applicableTaskTypeIds: ["dashboard"],
    defaultOptions: ["核心指标优先", "趋势分析优先", "异常监控优先", "明细操作优先"],
    lockFields: ["subject", "color_style", "technical"]
  },
  {
    id: "character_proportion",
    name: "角色比例",
    description: "改变角色头身、五官和年龄感关系",
    applicableTaskTypeIds: ["character_ip"],
    defaultOptions: ["2 头身", "3 头身", "5 头身", "7 头身"],
    lockFields: ["subject", "character_style", "composition", "technical"]
  }
];

export function createEmptyPromptBlueprint() {
  return {
    schemaVersion: 1,
    source: {
      prompt: "",
      referenceImages: [],
      referenceRole: "inspiration"
    },
    taskTypeId: "poster",
    locked: {
      intent: "",
      subject: "",
      context: "",
      audience: "",
      composition: "",
      visualLanguage: "",
      palette: "",
      lighting: "",
      material: "",
      textLayout: "",
      technical: { ratio: "3:4" },
      constraints: []
    },
    dimensions: {},
    exploration: {
      dimensionIds: [],
      optionCount: 3,
      selectedOptions: []
    },
    variants: []
  };
}
