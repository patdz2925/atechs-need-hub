/* ============================================================
   Media folder tree helpers — PURE (no imports, no I/O).
   Usable from server queries, API routes, and plain node tests.
   A "subtree" is a folder plus ALL of its descendants: folder
   views, counts and visibility cascades all operate on subtrees
   so clicking a parent never leaks sibling trees.
   ============================================================ */

export interface FolderNode {
  id: string;
  parent_id: string | null;
}

/** All ids in the subtree rooted at rootId, root included.
 *  Unknown ids yield just themselves (safe no-op scope). Cycle-safe
 *  via a visited set. */
export function getSubtreeIds<T extends FolderNode>(all: T[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const f of all) {
    if (f.parent_id === null || f.parent_id === undefined) continue;
    const list = children.get(f.parent_id) ?? [];
    list.push(f.id);
    children.set(f.parent_id, list);
  }

  const out: string[] = [];
  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  // The root always scopes to at least itself; unknown ids therefore
  // scope to themselves and can never match the whole archive.
  out.push(rootId);
  while (queue.length) {
    const current = queue.shift()!;
    for (const child of children.get(current) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push(child);
      queue.push(child);
    }
  }
  return out;
}
