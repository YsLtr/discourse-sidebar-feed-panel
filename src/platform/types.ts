import type { TopicMessage } from "../feed/types";

export interface MessageBus {
  subscribe(
    channel: string,
    callback: (data: TopicMessage) => void,
    lastId?: number,
  ): void;
  unsubscribe(channel: string, callback: (data: TopicMessage) => void): void;
  lastId?(channel: string): number;
  lastIdForChannel?(channel: string): number;
  lastIds?: Record<string, number>;
  last_ids?: Record<string, number>;
  channels?: Record<string, { lastId?: number }>;
  lastMessageId?(channel: string): number;
  callbacks?: Array<{ channel: string; last_id?: number }>;
}
export interface DiscourseInstance {
  SiteSettings?: { default_locale?: string };
  __container__?: { lookup(name: string): unknown };
}
