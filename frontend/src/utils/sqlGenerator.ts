/**
 * SQL Generator Utility
 * Generates SQL queries from query builder state
 * Uses SQL Server bracket notation for identifiers to avoid reserved keyword conflicts
 */

import type {
  QueryState,
  ColumnConfig,
  SimpleColumn,
  CalculatedColumn,
  WindowFunction,
  AggregateColumn,
  JoinConfig,
  WhereCondition,
  ExpressionNode
} from '../services/types';

/**
 * SQL Server reserved keywords that need escaping
 */
const SQL_RESERVED_KEYWORDS = new Set([
  'add', 'all', 'alter', 'and', 'any', 'as', 'asc', 'authorization', 'backup', 'begin',
  'between', 'break', 'browse', 'bulk', 'by', 'cascade', 'case', 'check', 'checkpoint',
  'close', 'clustered', 'coalesce', 'collate', 'column', 'commit', 'compute', 'constraint',
  'contains', 'containstable', 'continue', 'convert', 'create', 'cross', 'current',
  'current_date', 'current_time', 'current_timestamp', 'current_user', 'cursor', 'database',
  'dbcc', 'deallocate', 'declare', 'default', 'delete', 'deny', 'desc', 'disk', 'distinct',
  'distributed', 'double', 'drop', 'dump', 'else', 'end', 'errlvl', 'escape', 'except',
  'exec', 'execute', 'exists', 'exit', 'external', 'fetch', 'file', 'fillfactor', 'for',
  'foreign', 'freetext', 'freetexttable', 'from', 'full', 'function', 'goto', 'grant',
  'group', 'having', 'holdlock', 'identity', 'identity_insert', 'identitycol', 'if', 'in',
  'index', 'inner', 'insert', 'intersect', 'into', 'is', 'join', 'key', 'kill', 'left',
  'like', 'lineno', 'load', 'merge', 'national', 'natural', 'nocheck', 'nonclustered',
  'not', 'null', 'nullif', 'number', 'of', 'off', 'offsets', 'on', 'open', 'opendatasource',
  'openquery', 'openrowset', 'openxml', 'option', 'or', 'order', 'outer', 'over', 'percent',
  'pivot', 'plan', 'precision', 'primary', 'print', 'proc', 'procedure', 'public',
  'raiserror', 'read', 'readtext', 'reconfigure', 'references', 'replication', 'restore',
  'restrict', 'return', 'revert', 'revoke', 'right', 'rollback', 'rowcount', 'rowguidcol',
  'rule', 'save', 'schema', 'securityaudit', 'select', 'semantickeyphrasetable',
  'semanticsimilaritydetailstable', 'semanticsimilaritytable', 'session_user', 'set',
  'setuser', 'shutdown', 'some', 'statistics', 'system_user', 'table', 'tablesample',
  'textsize', 'then', 'to', 'top', 'tran', 'transaction', 'trigger', 'truncate', 'try_convert',
  'tsequal', 'union', 'unique', 'unpivot', 'update', 'updatetext', 'use', 'user', 'values',
  'varying', 'view', 'waitfor', 'when', 'where', 'while', 'with', 'within', 'writetext'
]);

/**
 * Escape identifier if it's a reserved keyword
 */
function escapeIdentifier(identifier: string): string {
  if (!identifier) return identifier;
  
  // Clean the identifier - remove semicolons, extra spaces, etc.
  let cleaned = identifier.trim();
  // Remove trailing semicolons
  cleaned = cleaned.replace(/;+$/, '');
  // Remove any brackets that might already be there (we'll add our own if needed)
  cleaned = cleaned.replace(/^\[|\]$/g, '');
  
  // If it contains a dot (table.column), split and escape each part
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    return parts.map(part => escapeIdentifier(part)).join('.');
  }
  
  // Check if it's a reserved keyword (case-insensitive)
  if (SQL_RESERVED_KEYWORDS.has(cleaned.toLowerCase())) {
    return `[${cleaned}]`;
  }
  
  // Also escape if it contains special characters or starts with a number
  if (/[^a-zA-Z0-9_]/.test(cleaned) || /^[0-9]/.test(cleaned)) {
    return `[${cleaned}]`;
  }
  
  return cleaned;
}

/**
 * Generate complete SQL query from query state
 */
export function generateSQL(state: QueryState): string {
  const parts: string[] = [];

  // SELECT clause
  const selectClause = generateSelectClause(state.columns);
  parts.push(selectClause);

  // FROM clause - required for valid SQL
  // If we have columns, WHERE, GROUP BY, or ORDER BY, we need a FROM clause
  const needsFromClause = state.columns.length > 0 || 
                          state.where.length > 0 || 
                          state.groupBy.length > 0 || 
                          state.orderBy.length > 0;
  
  if (needsFromClause) {
    if (state.tables.length > 0) {
      const fromClause = generateFromClause(state.tables[0]);
      parts.push(fromClause);
    } else {
      // If no tables are specified but we have columns/WHERE/etc, we still need FROM
      // Try to infer table from first column or use a placeholder
      const firstColumn = state.columns.find(c => c.type === 'simple') as SimpleColumn | undefined;
      if (firstColumn && firstColumn.table) {
        parts.push(`FROM ${escapeIdentifier(firstColumn.table)}`);
      } else {
        // Fallback: use a placeholder (this shouldn't happen in normal usage)
        parts.push('FROM [Table]');
      }
    }

    // JOIN clauses (only valid if we have a FROM clause)
    if (state.joins.length > 0) {
      const joinClauses = generateJoinClauses(state.joins);
      parts.push(joinClauses);
    }

    // WHERE clause (only valid if we have a FROM clause)
    if (state.where.length > 0) {
      const whereClause = generateWhereClause(state.where);
      parts.push(whereClause);
    }

    // GROUP BY clause (only valid if we have a FROM clause)
    if (state.groupBy.length > 0) {
      const groupByClause = generateGroupByClause(state.groupBy);
      parts.push(groupByClause);
    }

    // ORDER BY clause (only valid if we have a FROM clause)
    if (state.orderBy.length > 0) {
      const orderByClause = generateOrderByClause(state.orderBy);
      parts.push(orderByClause);
    }
  }

  return parts.join('\n');
}

/**
 * Generate SELECT clause with columns
 */
export function generateSelectClause(columns: ColumnConfig[]): string {
  if (columns.length === 0) {
    return 'SELECT *';
  }

  const columnStrings = columns.map((col, index) => {
    let colStr = '';

    switch (col.type) {
      case 'simple':
        colStr = generateSimpleColumn(col as SimpleColumn);
        break;
      case 'calculated':
        colStr = generateCalculatedColumn(col as CalculatedColumn);
        break;
      case 'window':
        colStr = generateWindowFunction(col as WindowFunction);
        break;
      case 'aggregate':
        colStr = generateAggregateColumn(col as AggregateColumn);
        break;
    }

    // Add comma and indentation for all but first column
    return index === 0 ? `SELECT ${colStr}` : `       ${colStr}`;
  });

  return columnStrings.join(',\n');
}

/**
 * Generate simple column reference
 */
function generateSimpleColumn(col: SimpleColumn): string {
  let fullColumn: string;
  if (col.table) {
    fullColumn = `${escapeIdentifier(col.table)}.${escapeIdentifier(col.column)}`;
  } else {
    fullColumn = escapeIdentifier(col.column);
  }
  return col.alias ? `${fullColumn} AS ${escapeIdentifier(col.alias)}` : fullColumn;
}

/**
 * Generate calculated column with expression
 */
function generateCalculatedColumn(col: CalculatedColumn): string {
  const expression = generateExpression(col.expression);
  return col.alias ? `${expression} AS ${escapeIdentifier(col.alias)}` : expression;
}

/**
 * Generate expression from expression tree
 */
export function generateExpression(node: ExpressionNode): string {
  switch (node.type) {
    case 'column':
      return escapeIdentifier(String(node.value || ''));

    case 'literal':
      // Quote string literals, but keep parameters as-is
      // Also don't quote if it looks like SQL code (contains SQL keywords, functions, operators, etc.)
      if (typeof node.value === 'string') {
        const value = node.value.trim();
        // Don't quote if it's a parameter
        if (value.match(/^@\w+$/)) {
          return value;
        }
        // Don't quote if it looks like SQL code (contains SQL keywords, CAST, functions, operators, etc.)
        const sqlPatterns = [
          /\b(CAST|CONVERT|ISNULL|COALESCE|SUM|AVG|COUNT|MIN|MAX|ROW_NUMBER|RANK|DENSE_RANK)\s*\(/i,
          /\b(AS|SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|GROUP|BY|ORDER|ASC|DESC)\b/i,
          /[+\-*/()]/, // Arithmetic operators
          /\./, // Table.column notation
          /\[.*\]/, // Bracketed identifiers
        ];
        const looksLikeSQL = sqlPatterns.some(pattern => pattern.test(value));
        if (looksLikeSQL) {
          return value; // Return as-is, don't quote
        }
        // Otherwise, quote it as a string literal
        return `'${value.replace(/'/g, "''")}'`;
      }
      return String(node.value || '');

    case 'parameter':
      return String(node.value || '');

    case 'operator':
      if (node.left && node.right) {
        const left = generateExpression(node.left);
        const right = generateExpression(node.right);
        return `(${left} ${node.operator} ${right})`;
      }
      return '';

    case 'function':
      if (!node.function) return '';
      const args = (node.arguments || []).map(arg => generateExpression(arg)).join(', ');
      return `${node.function}(${args})`;

    default:
      return '';
  }
}

/**
 * Generate window function with OVER clause
 */
export function generateWindowFunction(col: WindowFunction): string {
  let sql = `${col.function}()`;

  // Build OVER clause
  const overParts: string[] = [];

  if (col.partitionBy && col.partitionBy.length > 0) {
    overParts.push(`PARTITION BY ${col.partitionBy.map(c => escapeIdentifier(c)).join(', ')}`);
  }

  if (col.orderBy && col.orderBy.length > 0) {
    const orderItems = col.orderBy.map(o => `${escapeIdentifier(o.column)} ${o.direction}`).join(', ');
    overParts.push(`ORDER BY ${orderItems}`);
  }

  if (col.frameClause) {
    overParts.push(col.frameClause);
  }

  if (overParts.length > 0) {
    sql += ` OVER (${overParts.join(' ')})`;
  }

  return col.alias ? `${sql} AS ${escapeIdentifier(col.alias)}` : sql;
}

/**
 * Generate aggregate column
 */
function generateAggregateColumn(col: AggregateColumn): string {
  const distinct = col.distinct ? 'DISTINCT ' : '';
  const agg = `${col.function}(${distinct}${escapeIdentifier(col.column)})`;
  return col.alias ? `${agg} AS ${escapeIdentifier(col.alias)}` : agg;
}

/**
 * Generate FROM clause
 */
export function generateFromClause(table: { name: string; alias?: string }): string {
  const tableName = escapeIdentifier(table.name);
  return table.alias ? `FROM ${tableName} ${escapeIdentifier(table.alias)}` : `FROM ${tableName}`;
}

/**
 * Generate JOIN clauses
 */
export function generateJoinClauses(joins: JoinConfig[]): string {
  return joins
    .filter(join => join.table && join.table.trim()) // Skip joins without table
    .map(join => {
      const tableName = escapeIdentifier(join.table);
      const tablePart = join.alias && join.alias.trim() 
        ? `${tableName} ${escapeIdentifier(join.alias)}` 
        : tableName;
      let joinStr = `${join.type} JOIN ${tablePart}`;

      if (join.type !== 'CROSS') {
        // Filter out empty/invalid conditions
        const validConditions = join.conditions.filter(
          cond => cond.leftColumn && cond.leftColumn.trim() && 
                  cond.rightColumn && cond.rightColumn.trim()
        );
        
        if (validConditions.length > 0) {
          const conditions = validConditions.map((cond, index) => {
            const condStr = `${escapeIdentifier(cond.leftColumn)} ${cond.operator} ${escapeIdentifier(cond.rightColumn)}`;
            if (index === 0) {
              return condStr;
            }
            return `${cond.andOr || 'AND'} ${condStr}`;
          }).join(' ');
          joinStr += ` ON ${conditions}`;
        }
      }

      return joinStr;
    }).join('\n');
}

/**
 * Generate WHERE clause
 */
export function generateWhereClause(conditions: WhereCondition[]): string {
  if (conditions.length === 0) return '';

  const conditionStrings = conditions.map((cond, index) => {
    let condStr = '';
    const columnName = escapeIdentifier(cond.column);

    if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
      condStr = `${columnName} ${cond.operator}`;
    } else if (cond.operator === 'IN') {
      const values = Array.isArray(cond.value)
        ? cond.value.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ')
        : String(cond.value);
      condStr = `${columnName} IN (${values})`;
    } else {
      let value = cond.value;
      if (cond.isParameter) {
        value = String(value); // Keep @ parameters as-is
      } else if (typeof value === 'string') {
        value = `'${value.replace(/'/g, "''")}'`;
      }
      condStr = `${columnName} ${cond.operator} ${value}`;
    }

    if (index === 0) {
      return `WHERE ${condStr}`;
    }
    return `  ${cond.andOr || 'AND'} ${condStr}`;
  });

  return conditionStrings.join('\n');
}

/**
 * Generate GROUP BY clause
 */
export function generateGroupByClause(columns: string[]): string {
  return `GROUP BY ${columns.map(c => escapeIdentifier(c)).join(', ')}`;
}

/**
 * Generate ORDER BY clause
 */
export function generateOrderByClause(orderBy: { column: string; direction: 'ASC' | 'DESC' }[]): string {
  const orderItems = orderBy.map(o => `${escapeIdentifier(o.column)} ${o.direction}`).join(', ');
  return `ORDER BY ${orderItems}`;
}

/**
 * Format SQL with proper indentation
 */
export function formatSQL(sql: string): string {
  // Basic SQL formatting - can be enhanced
  return sql
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}
