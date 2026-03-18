# HTML Viewer Engine

The HTML Viewer Engine is a powerful, local-storage-based web application designed to render, beautifully format, and flawlessly print your raw HTML documents. It is specifically built for handling clinical summaries, precise reporting, and raw HTML previews natively in the browser without CSS leakage.

Live Deployment: [https://html.entix.org](https://html.entix.org)

## Incredible Features

- **Perfect A4 Pagination & Printing:** Prints HTML strings through an isolated invisible sandbox that automatically overrides broken line spacing. It intelligently injects native CSS (`break-inside: avoid`) to prevent block elements, images, grids, and headings from being physically chopped in half over two pages when printed.
- **Displays Exact Document Names:** The generated printouts accurately output the name of the document to the PDF header instead of generic system names.
- **Monaco Code Editor:** A fully-fledged VS Code environment physically embedded in the browser featuring beautiful syntax highlighting.
- **Prettier Auto-Formatting:** Automatically formats messy, minified, or disorganized inline HTML via Prettier's standalone engine with the click of a button.
- **World-Class UI & Dark Mode:** Uses highly polished Ant Design React layout elements beautifully mixed with Tailwind CSS. Seamlessly toggles between a vibrant Emerald/Purple Light state and a hyper-readable Dark Mode.

## Technology Stack

- **Framework:** React 19 + Vite (Optimized for V8 Isolates & Cloudflare)
- **Routing:** React Router v7 (HashRouter for serverless edge deployments)
- **Styling:** Tailwind CSS v4 + Ant Design (ConfigProvider Themed)
- **Code Engine:** `@monaco-editor/react` + `prettier`
