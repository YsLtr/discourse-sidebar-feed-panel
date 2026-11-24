export interface FeedQuerySnapshot {
  tab: string;
  categoryId: number | null;
  order: string;
  period: string;
  filter: string;
}

export interface TopicReadState {
  id: number;
  slug?: string;
  pinned?: boolean;
  pinned_globally?: boolean;
  last_read_post_number?: number | string | null;
  highest_post_number?: number | string | null;
  unread_posts?: number;
  new_posts?: number;
  unseen?: boolean;
  is_seen?: boolean;
  /** Discourse NotificationLevels：0 静音 / 1 常规 / 2 跟踪 / 3 关注 / 4 关注第一帖。 */
  notification_level?: number;
}

export interface CategoryPathEntry {
  id: number;
  slug?: string;
  parent_category_id?: number | null;
}

export interface TopicTag {
  id?: number | string;
  name?: string;
  slug?: string;
  text?: string;
}

export interface Topic extends TopicReadState {
  title?: string;
  fancy_title?: string;
  unicode_title?: string;
  /** 列表接口附带的纯文本摘要（`ListableTopicSerializer`），用于异常话题的回退内容。 */
  excerpt?: string;
  category_id?: number;
  archetype?: string;
  closed?: boolean;
  is_hot?: boolean;
  created_at?: string;
  bumped_at?: string;
  last_posted_at?: string;
  views?: number;
  posts_count?: number;
  like_count?: number;
  op_like_count?: number;
  posters?: Array<{ user_id: number }>;
  tags?: Array<string | TopicTag>;
  sfpUnavailable?: boolean;
  sfpUnavailablePushed?: number;
}

export interface TopicContentPost {
  postNumber?: number;
  username?: string;
  name?: string;
  createdAt?: string;
  /** Discourse 服务端已消毒的正文 HTML（`post_stream.posts[].cooked`）。 */
  cooked?: string;
}

/** 点击「话题异常」时弹窗展示的内容：来自 `/t/<id>.json` 或列表快照。 */
export interface TopicContent {
  id: number;
  title?: string;
  categoryId?: number;
  createdAt?: string;
  excerpt?: string;
  posts: TopicContentPost[];
}

export interface TopicUser {
  id: number;
  username?: string;
  name?: string;
  avatar_template?: string;
}

export interface TopicResponse {
  topic_list?: { topics?: Topic[]; more_topics_url?: string | null };
  users?: TopicUser[];
}

export interface TopicMessage {
  topic_id?: number | string;
  message_type?: string;
  payload?: Partial<Topic>;
}

export interface ScrollAnchor {
  topicId: string | null;
  offsetTop: number;
  scrollTop: number;
  scrollHeight: number;
}
