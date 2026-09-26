import path from 'node:path';

function importSpecifiers(source) {
  const result = new Set();
  const fromPatterns = [
    /\bimport\s+(type\s+)?([^'";]*?)\s+from\s*['"]([^'"]+)['"]/g,
    /\bexport\s+(type\s+)?([^'";]*?)\s+from\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of fromPatterns) {
    for (const match of source.matchAll(pattern)) {
      if (!match[1]) result.add(match[3]);
    }
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) result.add(match[1]);
  for (const match of source.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) result.add(match[1]);
  return [...result];
}

function resolveRelative(from, specifier, modules) {
  let base;
  if (specifier.startsWith('.')) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  } else if (specifier.startsWith('@/')) {
    base = path.posix.normalize(path.posix.join('src', specifier.slice(2)));
  } else {
    return null;
  }
  const candidates = [base];
  for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
    candidates.push(`${base}${extension}`);
  }
  for (const extension of ['.ts', '.tsx', '.js', '.jsx', '.mjs']) {
    candidates.push(`${base}/index${extension}`);
  }
  return candidates.find((candidate) => modules.has(candidate)) ?? null;
}

/** Return reachable source files that read/write Group collections through Firestore. */
export function findGroupFirestoreModules(modules, entry) {
  const visited = new Set();
  const firestoreModules = new Set();
  const visit = (file) => {
    if (visited.has(file) || !modules.has(file)) return;
    visited.add(file);
    const source = modules.get(file);
    for (const specifier of importSpecifiers(source)) {
      const dependency = resolveRelative(file, specifier, modules);
      if (dependency) visit(dependency);
    }
    const usesFirestore = importSpecifiers(source).some(
      (specifier) => specifier === 'firebase/firestore' || specifier.startsWith('firebase/firestore/'),
    );
    const touchesGroupCollection = /['"](?:groups|groupMembers)['"]/.test(source);
    if (usesFirestore && touchesGroupCollection) firestoreModules.add(file);
  };
  visit(entry);
  return [...firestoreModules].sort();
}
