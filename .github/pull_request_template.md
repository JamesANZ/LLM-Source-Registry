<!--
Thanks for contributing! A few quick checks before you submit:
-->

## Summary

<!-- One line: what are you adding, changing, or fixing? -->

## Type of change

- [ ] New source (added a YAML under `sources/<topic>/`)
- [ ] Updated an existing source
- [ ] Removed / retired a source
- [ ] Code / tooling change

## If you're adding or updating a source

- [ ] `type` is one of: `api`, `scrapable_page`, `dataset`, `rss`, `mcp`, `llms_txt`, `pdf`, `document`
- [ ] `auth: none` if at all possible — the registry defaults to no-credentials sources
- [ ] `why_better` is specific and explains what an LLM gets wrong by using web search instead
- [ ] For `pdf` / `document` entries, the `document:` block is filled in (publisher, issued date, canonical flag)
- [ ] Ran `npm run validate` locally and it passed

## Notes for the reviewer

<!-- Anything unusual? Flaky source? Contention about the `why_better` framing? -->
