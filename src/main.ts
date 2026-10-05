import { startFeedPanel } from "./app";

// Imports only declare modules; iframe visits must not migrate storage or mount UI.
if (window.top === window.self) startFeedPanel();
