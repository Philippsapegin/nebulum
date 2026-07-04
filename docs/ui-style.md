# Nebulum UI Style

Use this as the baseline for Nebulum UI work. The goal is quiet, thin, system-like game UI over dark space visuals.

## Typography

- Titles use `"Wire One"` with normal weight, uppercase, no letter spacing.
- Compact controls use `"Albert Sans"` at `10px` or `11px`, normal letter spacing, uppercase labels.
- Do not stretch text horizontally. Do not fake weight with text stroke.
- Main readable text uses low-contrast white, usually `rgba(255, 255, 255, 0.5-0.7)`.

## Surfaces

- Modal surfaces use transparent dark glass:
  `background: rgba(10, 10, 11, 0.48)` and `backdrop-filter: blur(18px)`.
- Corners are small, usually `3px`.
- Do not add visible decorative borders or stroke outlines.
- Repeated item cards use `rgba(255, 255, 255, 0.045)` backgrounds.

## Buttons

- Standard menu buttons are flat translucent rectangles with no border.
- Hover state only raises background opacity and text opacity.
- Disabled buttons lower text opacity and keep the same flat language.
- Button text is white, not semi-transparent when it represents a primary readable command.

## Inputs

- Compact text/number inputs are `20px` tall with no border and small horizontal padding.
- Seed inputs must preserve case visually and in value; do not apply `text-transform: uppercase` to seed fields.
- User-entered names must preserve case visually and in value.
- Labels should sit in the same row as compact controls when vertical space matters.

## Color Controls

- Use the in-game border swatch style for color choices: circular swatch, `currentColor`, radial fill, inset ring, and glow.
- Reuse the shared `openColorPicker` popover for changing colors.
- When a card represents a colored side/faction/border, drive both fill and stroke from the same CSS variable color.
- Colored cards should keep the Nebulum translucent style: subtle tinted fill, 1px tinted border, and restrained glow.

## Dropdowns

- Use the music-player pattern for custom dropdowns:
  current value button + narrow arrow button + floating list + blurred backdrop + thin custom scrollbar.
- Floating dropdown lists must always have background blur under the list items. This is required when a list opens over text or other readable UI.
- Apply blur defensively to both the list surface and its backdrop when possible:
  `background: rgba(10, 10, 11, 0.48)` plus `backdrop-filter: blur(18px)`.
- Dropdown items are `20px` tall, transparent by default, and use the same hover/active background as music track items.
- Hide native scrollbars and show the custom 1px-line scrollbar with a `3px` white thumb when scrolling is needed.

## Dialog Layouts

- Keep bottom action buttons in a dedicated final row so content never overlaps them.
- For `NEW GAME`, keep media/configuration in the left column and scenario text plus faction setup in the right column.
- Align related section labels across columns where possible.

## Avoid

- No CSS/SVG strokes around menu text or modal controls.
- No random grid backgrounds or decorative frames.
- No nested cards unless the inner card is a repeated data item.
- No large marketing-style UI panels inside gameplay menus.
