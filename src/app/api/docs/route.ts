import { NextResponse } from 'next/server';

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Scholarship Search API — Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>body { margin: 0; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis],
          layout: 'BaseLayout',
        });
      };
    </script>
  </body>
</html>`;

export async function GET() {
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
