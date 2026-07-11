## Description: <br>
得到大脑（Get笔记） helps an agent save, search, view, update, delete, share, and organize a user's GetNote notes and knowledge bases through the GetNote cloud API. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[iswalle](https://clawhub.ai/user/iswalle) <br>

### License/Terms of Use: <br>
MIT-0 <br>


## Use Case: <br>
External users use this skill to let an agent capture text, links, images, and source material into GetNote, recall existing notes with semantic search, and manage notes, tags, knowledge bases, and sharing actions. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: The skill can read, modify, delete, and share private notes through broad natural-language triggers. <br>
Mitigation: Use explicit user commands, configure owner checking where possible, and require confirmation before destructive changes or share-link generation. <br>
Risk: Public share links can expose private note content outside the user's account. <br>
Mitigation: Generate share links only after the user clearly asks to share a note, and distinguish private internal note links from public share links. <br>
Risk: Note queries, links, images, and management actions are handled by GetNote's cloud API. <br>
Mitigation: Install only when cloud processing by GetNote is acceptable for the user's note content and account. <br>
Risk: Incorrect note IDs or unverified API outcomes could lead to wrong edits, deletions, or misleading success messages. <br>
Mitigation: Use note IDs returned by the API, preserve large IDs as strings, check API success fields, and poll asynchronous save tasks until a final status is returned. <br>


## Reference(s): <br>
- [GetNote homepage](https://biji.com) <br>
- [GetNote OpenAPI base URL](https://openapi.biji.com) <br>
- [GetNote Open Platform](https://www.biji.com/openapi) <br>
- [API details](references/api-details.md) <br>
- [OAuth configuration](references/oauth.md) <br>
- [Save notes](references/save.md) <br>
- [Search notes](references/search.md) <br>
- [List, update, delete, and share notes](references/list.md) <br>
- [Knowledge base management](references/knowledge.md) <br>
- [Tag management](references/tags.md) <br>


## Skill Output: <br>
**Output Type(s):** [text, markdown, shell commands, configuration, guidance] <br>
**Output Format:** [Markdown responses with API results, inline shell commands, configuration snippets, and status guidance] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [May include GetNote note IDs, search results, task progress, authorization status, and share links returned by the GetNote API.] <br>

## Skill Version(s): <br>
1.8.9 (source: server release evidence and package.json) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
