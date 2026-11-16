# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-11-16

Initial experimental release.

### Added

- `A2uiSession`, wrapping `@a2ui/web_core`'s `MessageProcessor` with tracked
  `surfaces`, `onAction` envelopes and `getClientMetadata()`.
- `A2uiSurfaces`, `A2uiSurface` and `A2uiNode` Glimmer components rendering the
  A2UI basic catalog (18 components).
- Protocol support for v1.0, v0.9 and v0.9.1 messages (v0.8 is not supported).
- `defineEmberComponent` and `extendBasicCatalog` for custom Glimmer catalog
  entries.
- A2UI Explorer demo app and QUnit integration tests.
