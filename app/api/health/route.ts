export async function GET() {
  const version = process.env.npm_package_version || "unknown";
  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version,
  });
}

