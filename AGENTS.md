# VisPath Agent Rules

## UI work

VisPath is a dense, desktop-first visual workbench. Before any broad UI change, read:

1. `DESIGN_SYSTEM.md` for executable tokens and component contracts.
2. `UI_STYLE_GUIDE.md` for product language and visual direction.
3. Invoke `xiaobai-coding` and load its `references/design-system-routing.md` and `references/config-workbench-ui.md` references when the change affects repeated controls, dialogs, layout, states, or visual acceptance.

Broad UI work includes page-wide spacing, navigation, panels, cards, forms, dialogs, buttons, icon buttons, tabs, toasts, responsive rules, and any repeated component family.

The following user requests are explicit UI-system triggers, even when they do not mention implementation details: `设计规范`, `视觉统一`, `设计系统`, `组件系统`, `组件规范`, `控件规范`, `布局规范`, `状态统一`, `全站统一`, `全页面同步调整`, or `梳理当前应用的设计系统`. For these requests, load `DESIGN_SYSTEM.md`, `UI_STYLE_GUIDE.md`, `xiaobai-coding/references/design-system-routing.md`, and `xiaobai-coding/references/config-workbench-ui.md` before editing; treat the project files as the source of truth and verify the rendered result afterward.

## Implementation rules

- Prefer the shared CSS tokens and classes in `styles.css`; do not add one-off sizes for a repeated component.
- Preserve the existing information architecture, product copy, local-first data model, and desktop-only boundary unless the user explicitly changes them.
- Every repeated control must define its default, hover, active, focus, disabled, selected, loading, error, and destructive states when applicable.
- Icon buttons must have a stable icon box, `aria-label`, and `title`. Dialog close buttons use the `dialog-close` contract.
- Do not edit `app.bundle.js` by hand. Run `npm run build:browser` after changing `app.js` or `src/`.

## Validation

Run the smallest relevant checks, then perform rendered verification for UI work:

```text
npm run test:design-system
npm run test:file-open
npm run test:experience        # page-wide component or layout work
npm run build:browser       # only when app.js or src/ changed
```

For page-wide UI changes, inspect at least one normal desktop viewport and the 901px desktop breakpoint. Record screenshots or DOM measurements, console errors, horizontal overflow, and the states that were not reachable.

Do not call a visual pass complete based on source inspection alone. Report product-experience evidence separately from build or test evidence.
