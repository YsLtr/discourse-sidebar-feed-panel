import type { TopicTag } from "../feed/types";

export interface CategoryRecord {
  id?: number;
  name?: string;
  slug?: string;
  color?: string;
  text_color?: string;
  icon?: string;
  style_type?: string;
  parent_category_id?: number | null;
  read_restricted?: boolean;
  description_text?: string;
  description_excerpt?: string;
  description?: string;
  topic_count?: number;
}
export interface NavigationRecord extends CategoryRecord {
  category_id?: number;
  categoryId?: number;
  category?: { id?: number };
  type?: string;
  section_type?: string;
  value?: string;
  url?: string;
  href?: string;
  path?: string;
  link?: string;
  route?: string;
  links?: NavigationEntry[];
}
export type NavigationEntry = number | string | NavigationRecord;
export interface SitePayload {
  categories?: CategoryRecord[];
  filters?: string[];
  periods?: string[];
  top_menu_items?: string[];
  anonymous_top_menu_items?: string[];
  top_tags?: Array<string | TopicTag>;
  can_tag_topics?: boolean;
  navigation_menu_categories?: NavigationEntry[];
  navigation_menu_site_categories?: NavigationEntry[];
  default_navigation_menu_categories?: NavigationEntry[];
  anonymous_default_navigation_menu_categories?: NavigationEntry[];
  anonymous_sidebar_sections?: NavigationRecord[];
  sidebar_sections?: NavigationRecord[];
  navigation_menu_sections?: NavigationRecord[];
}
export interface CategoryListPayload {
  category_list?: { categories?: CategoryRecord[] };
}
export interface CategorySource {
  site: SitePayload;
  navigationCategories: CategoryRecord[];
}
export interface CategoryCache {
  version: number;
  source: CategorySource;
}
export interface CategoryTab {
  id: number;
  tabId: string;
  legacyTabIds: string[];
  name: string;
  icon: string;
  color: string;
  slug: string;
}
export interface TagStyle {
  icon: string;
  cssText: string;
  hasIcon: boolean;
}
export interface TagStyleCache {
  version: number;
  entries: Array<[string, TagStyle]>;
}
