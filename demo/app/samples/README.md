# Sample message sequences

Most `*.ts` files here are adapted from the example message files in the
[google/A2UI](https://github.com/google/A2UI) repository
(`catalogs/basic/v1/examples/*.json` for v1.0 and
`specification/v0_9/catalogs/basic/examples/*.json` for v0.9). Each wraps the
original `name`, `description` and `messages` in a typed module.

Those upstream files are licensed under the Apache License, Version 2.0
(<https://www.apache.org/licenses/LICENSE-2.0>). They have been reformatted
and wrapped as TypeScript modules. The message content is otherwise unchanged, except that
`advanced-form-validator.ts` uses the v1.0 `checks` key (upstream still says
`@checks`, which the v1.0 validator rejects) and `music-player.ts` adds action context and a scripted `respond`
turn so its buttons get an answer from the mock agent.

`cabin-booking.ts` and `component-gallery.ts` are original to this demo.

Each sample also carries demo-only metadata: a sidebar `group`, an optional
`prompt` (the user request shown as the opening chat bubble) and an optional
`respond(action)` that returns the messages the mock agent streams back.
