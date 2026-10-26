export function normalizePrefix(value) {
  if (value == null) return "/";
  const trimmed = String(value).trim();
  if (trimmed === "" || trimmed === "/") return "/";
  let prefix = trimmed;
  if (!prefix.startsWith("/")) prefix = `/${prefix}`;
  if (!prefix.endsWith("/")) prefix = `${prefix}/`;
  return prefix;
}

export const PATH_PREFIX = normalizePrefix(process.env.PATH_PREFIX || "/jiating-kuaibao/");
