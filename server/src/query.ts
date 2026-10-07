type QueryRow = { id: string; data: Record<string, any>; version?: number };
type QueryConstraint = { type: string; field?: string; op?: string; value?: any; direction?: 'asc' | 'desc'; count?: number; id?: string };

function deep(data: any, path = ''): any {
  return path.split('.').filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], data);
}

function compare(left: any, right: any): number {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  return left < right ? -1 : 1;
}

function matches(value: any, op: string, expected: any): boolean {
  switch (op) {
    case '==': return value === expected;
    case '!=': return value !== expected;
    case '<': return value < expected;
    case '<=': return value <= expected;
    case '>': return value > expected;
    case '>=': return value >= expected;
    case 'in': return Array.isArray(expected) && expected.includes(value);
    default: return false;
  }
}

/** Apply the supported Firestore-shaped query constraints consistently before paging. */
export function applyQuery(items: QueryRow[], constraints: QueryConstraint[] = []): QueryRow[] {
  const clauses = constraints || [];
  let rows = items.filter(row => clauses.filter(item => item.type === 'where')
    .every(item => matches(deep(row.data, item.field), String(item.op || ''), item.value)));

  const orders = clauses.filter(item => item.type === 'orderBy');
  if (orders.length) {
    rows = rows.filter(row => orders.every(item => deep(row.data, item.field) !== undefined));
    rows.sort((left, right) => {
      for (const item of orders) {
        const result = compare(deep(left.data, item.field), deep(right.data, item.field));
        if (result) return result * (item.direction === 'desc' ? -1 : 1);
      }
      return left.id.localeCompare(right.id);
    });
  } else {
    rows = [...rows].sort((left, right) => left.id.localeCompare(right.id));
  }

  const primary = orders[0];
  if (primary) {
    const direction = primary.direction === 'desc' ? -1 : 1;
    for (const item of clauses) {
      if (item.type === 'startAt') rows = rows.filter(row => compare(deep(row.data, primary.field), item.value) * direction >= 0);
      if (item.type === 'endAt') rows = rows.filter(row => compare(deep(row.data, primary.field), item.value) * direction <= 0);
    }
  }

  const cursor = clauses.find(item => item.type === 'startAfter');
  if (cursor?.id) {
    const index = rows.findIndex(row => row.id === cursor.id);
    if (index >= 0) rows = rows.slice(index + 1);
  } else if (cursor && cursor.value !== undefined && primary) {
    const direction = primary.direction === 'desc' ? -1 : 1;
    rows = rows.filter(row => compare(deep(row.data, primary.field), cursor.value) * direction > 0);
  }

  const pageSize = clauses.find(item => item.type === 'limit')?.count;
  if (pageSize !== undefined) rows = rows.slice(0, Math.min(5000, Math.max(0, Number(pageSize) || 0)));
  return rows;
}
