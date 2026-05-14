# Nebulum

Nebulum is an interactive 3D star graph built with Vite and Three.js.

The graph is generated deterministically from a seed. Stars, links, names, star classes, masks, sky gradients, and ambient effects are all driven by seeded randomness.

## Features

- Seeded 3D star graph with glowing stars and links.
- Mouse drag rotation with inertial slowdown.
- Hover labels and animated star tooltips.
- Procedural sky gradient and distant star field.
- Clickable colored masks for connected star regions.
- Custom color picker for mask and sky gradient colors.
- Seeded star names, types, planets, and external fading links.

## Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## GitHub Pages

The repository includes a GitHub Pages workflow. After pushing to GitHub, enable Pages with **GitHub Actions** as the source in repository settings.
