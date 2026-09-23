export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>Scholarship Search API</h1>
      <p>Public, read-only API for scholarship search.</p>
      <ul>
        <li>
          <a href="/api/docs">Interactive API docs (Swagger UI)</a>
        </li>
        <li>
          <a href="/api/openapi.json">Raw OpenAPI spec (JSON)</a>
        </li>
        <li>
          <a href="/api/v1/health">Health check</a>
        </li>
      </ul>
    </main>
  );
}
