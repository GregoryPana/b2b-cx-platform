# Packaging And Sharing

This guide explains how to package and share the skills folder with other developers.

## 1. What to share

The main shareable folder is:

```text
skills/
```

If the developer also uses OpenCode and wants the local presentation skill, also share:

```text
.opencode/skills/academic-pptx/
```

## 2. Minimum files to include

For the agent-agnostic pack, include:

- `skills/README.md`
- `skills/SKILL_OVERVIEW.md`
- `skills/INSTALL_AND_USE.md`
- `skills/EXAMPLE_PROMPTS.md`
- all individual skill files
- `skills/support/`

## 3. Manual packaging

From the repository root, a developer can create a zip file manually using their preferred tool.

### Linux / macOS example

```bash
zip -r dto-agent-skills.zip skills .opencode/skills/academic-pptx
```

### Windows PowerShell example

```powershell
Compress-Archive -Path skills, .opencode/skills/academic-pptx -DestinationPath dto-agent-skills.zip
```

## 4. How another developer can use the pack

### Any coding agent

1. extract the package
2. open `skills/README.md`
3. read `skills/SKILL_OVERVIEW.md`
4. use `skills/INSTALL_AND_USE.md`
5. either paste the skill content into the agent or point the agent to the folder if supported

### OpenCode project-local use

1. copy `.opencode/skills/academic-pptx/` into the target repository's `.opencode/skills/`
2. restart OpenCode

## 5. Good practice for teams

- keep the skill pack versioned in git
- treat the pack like engineering standards, not personal notes
- update the pack when new repeated patterns emerge
- prefer adding one clear new skill over letting troubleshooting knowledge stay only in chat logs
