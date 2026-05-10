export function parseRouteInput(schema, input, error = "invalid_request") {
  const parsed = schema.safeParse(input || {});
  if (!parsed.success) return { ok: false, error };
  return { ok: true, data: parsed.data };
}

export function createRouteInputReader(parseInput, { status = 400, error = "invalid_request" } = {}) {
  return (res, schema, input, options = {}) => {
    const parsed = parseInput(schema, input, options.error ?? error);
    if (parsed.ok) return parsed.data;
    res.status(options.status ?? status).json({ error: parsed.error });
    return null;
  };
}
