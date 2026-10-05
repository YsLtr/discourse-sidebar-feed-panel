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
  unicode_title?: string;
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
