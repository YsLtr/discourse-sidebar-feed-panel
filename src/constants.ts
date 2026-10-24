export const DEFAULT_WIDTH = 272;
export const MIN_WIDTH = DEFAULT_WIDTH;
export const MAX_WIDTH = 500;
export const DEFAULT_AUTO_SILENT_REFRESH_INTERVAL = 0;
export const DEFAULT_AUTO_REFRESH_INTERVAL = 10;
export const AUTO_REFRESH_IDLE_LIMIT_MS = 10 * 60 * 1000;
export const AUTO_LOAD_RATE_WINDOW_MS = 5000;
export const AUTO_LOAD_MAX_REQUESTS_PER_WINDOW = 3;
export const AUTO_LOAD_MAX_EMPTY_FILTER_RESULTS = 3;
export const SETTINGS_BUTTON_SIZE = 28;
export const CATEGORY_DATA_CACHE_VERSION = 1;
export const TAG_STYLE_CACHE_VERSION = 1;

// 稍后再读：列表上限与分批同步的粒度与 /latest.json 的单次承载量对齐。
// 两个高度是布局兜底值：条目还没渲染出来时用它算钳制边界。
export const READ_LATER_LIMIT = 200;
export const READ_LATER_SYNC_CHUNK = 50;
export const READ_LATER_ITEM_FALLBACK_HEIGHT = 64;
export const READ_LATER_MIN_SECTION_HEIGHT = 56;
// 与编辑器同一个端点的客户端节奏：150ms 间隔、429 后 2s 重试一次。
export const READ_LATER_ONBOX_GAP_MS = 150;
export const READ_LATER_ONBOX_RETRY_MS = 2000;
export const READ_LATER_EXCERPT_MAX = 200;
