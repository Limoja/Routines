# Routines

Autonomous development team routines. Each project has its own folder with configs, specs, and handoff files.

## Structure

```
{project}/
├── configs/         ← Trigger configs (one per role)
├── specs/           ← Role specifications (what each agent does)
├── handoff/         ← Inter-role handoff files (the pipeline)
├── runs/{role}/     ← Per-role run logs and reports
├── shared-context.md ← Project info all roles reference
└── iteration.md     ← Current iteration tracker
```

## Roles

| Role | Purpose | Input | Output |
|------|---------|-------|--------|
| PO | Reviews product, writes acceptance criteria | Test report | PO review |
| Designer | Plans implementation from PO criteria | PO review | Design plan |
| Developer | Implements features, fixes bugs | Design plan + bugs | Dev report |
| Tester | Runs Playwright + API tests | Dev report | Test report |
| Reviewer | Oversees pipeline, can intervene | All files | Reviewer report |

## Usage

```bash
# Trigger a single routine
node trigger.js ai-instructor/team-po

# Set up cron (crontab -e)
7  */2 * * *  cd ~/Routines && node trigger.js ai-instructor/team-po
27 */2 * * *  cd ~/Routines && node trigger.js ai-instructor/team-designer
17 *   * * *  cd ~/Routines && node trigger.js ai-instructor/team-developer
37 *   * * *  cd ~/Routines && node trigger.js ai-instructor/team-tester
47 *   * * *  cd ~/Routines && node trigger.js ai-instructor/team-reviewer
```
