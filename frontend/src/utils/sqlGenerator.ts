/**
 * SQL Generator Utility
 * Generates SQL queries from query builder state
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
 * Generate complete SQL query from query state
 */
export function generateSQL(state: QueryState): string {
  const parts: string[] = [];

  // SELECT clause
  const selectClause = generateSelectClause(state.columns);
  parts.push(selectClause);

  // FROM clause
  if (state.tables.length > 0) {
    const fromClause = generateFromClause(state.tables[0]);
    parts.push(fromClause);
  }

  // JOIN clauses
  if (state.joins.length > 0) {
    const joinClauses = generateJoinClauses(state.joins);
    parts.push(joinClauses);
  }

  // WHERE clause
  if (state.where.length > 0) {
    const whereClause = generateWhereClause(state.where);
    parts.push(whereClause);
  }

  // GROUP BY clause
  if (state.groupBy.length > 0) {
    const groupByClause = generateGroupByClause(state.groupBy);
    parts.push(groupByClause);
  }

  // ORDER BY clause
  if (state.orderBy.length > 0) {
    const orderByClause = generateOrderByClause(state.orderBy);
    parts.push(orderByClause);
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
  const fullColumn = col.table ? `${col.table}.${col.column}` : col.column;
  return col.alias ? `${fullColumn} AS ${col.alias}` : fullColumn;
}

/**
 * Generate calculated column with expression
 */
function generateCalculatedColumn(col: CalculatedColumn): string {
  const expression = generateExpression(col.expression);
  return col.alias ? `${expression} AS ${col.alias}` : expression;
}

/**
 * Generate expression from expression tree
 */
export function generateExpression(node: ExpressionNode): string {
  switch (node.type) {
    case 'column':
      return String(node.value || '');

    case 'literal':
      // Quote string literals
      if (typeof node.value === 'string' && !node.value.match(/^@\w+$/)) {
        return `'${node.value.replace(/'/g, "''")}'`;
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
    overParts.push(`PARTITION BY ${col.partitionBy.join(', ')}`);
  }

  if (col.orderBy && col.orderBy.length > 0) {
    const orderItems = col.orderBy.map(o => `${o.column} ${o.direction}`).join(', ');
    overParts.push(`ORDER BY ${orderItems}`);
  }

  if (col.frameClause) {
    overParts.push(col.frameClause);
  }

  if (overParts.length > 0) {
    sql += ` OVER (${overParts.join(' ')})`;
  }

  return col.alias ? `${sql} AS ${col.alias}` : sql;
}

/**
 * Generate aggregate column
 */
function generateAggregateColumn(col: AggregateColumn): string {
  const distinct = col.distinct ? 'DISTINCT ' : '';
  const agg = `${col.function}(${distinct}${col.column})`;
  return col.alias ? `${agg} AS ${col.alias}` : agg;
}

/**
 * Generate FROM clause
 */
export function generateFromClause(table: { name: string; alias?: string }): string {
  return table.alias ? `FROM ${table.name} ${table.alias}` : `FROM ${table.name}`;
}

/**
 * Generate JOIN clauses
 */
export function generateJoinClauses(joins: JoinConfig[]): string {
  return joins.map(join => {
    const tablePart = join.alias ? `${join.table} ${join.alias}` : join.table;
    let joinStr = `${join.type} JOIN ${tablePart}`;

    if (join.conditions.length > 0 && join.type !== 'CROSS') {
      const conditions = join.conditions.map((cond, index) => {
        const condStr = `${cond.leftColumn} ${cond.operator} ${cond.rightColumn}`;
        if (index === 0) {
          return condStr;
        }
        return `${cond.andOr || 'AND'} ${condStr}`;
      }).join(' ');
      joinStr += ` ON ${conditions}`;
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

    if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
      condStr = `${cond.column} ${cond.operator}`;
    } else if (cond.operator === 'IN') {
      const values = Array.isArray(cond.value)
        ? cond.value.map(v => typeof v === 'string' ? `'${v}'` : v).join(', ')
        : String(cond.value);
      condStr = `${cond.column} IN (${values})`;
    } else {
      let value = cond.value;
      if (cond.isParameter) {
        value = String(value); // Keep @ parameters as-is
      } else if (typeof value === 'string') {
        value = `'${value.replace(/'/g, "''")}'`;
      }
      condStr = `${cond.column} ${cond.operator} ${value}`;
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
  return `GROUP BY ${columns.join(', ')}`;
}

/**
 * Generate ORDER BY clause
 */
export function generateOrderByClause(orderBy: { column: string; direction: 'ASC' | 'DESC' }[]): string {
  const orderItems = orderBy.map(o => `${o.column} ${o.direction}`).join(', ');
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

