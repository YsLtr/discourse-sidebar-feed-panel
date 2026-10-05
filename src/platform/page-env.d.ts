// Discourse is supplied by the forum, not bundled from npm.
declare const Discourse: {
  SiteSettings?: { default_locale?: string };
  __container__?: { lookup(name: string): unknown };
};

interface Window {
  Discourse?: typeof Discourse;
  SFPFeedPanel?: { clearCaches(): void; dispose(): void; start(): void };
}
