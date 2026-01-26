/**
 * SQL Parser Utility
 * Best-effort parsing of SQL queries into query builder state
 * 
 * Note: This is a simple parser for common SQL patterns.
 * Complex queries may not parse completely.
 */

import type { QueryState, JoinConfig, ColumnConfig, WhereCondition } from '../services/types';

export interface ParseResult {
  success: boolean;
  state?: Partial<QueryState>;
  warnings: string[];
  errors: string[];
}

/**
 * Parse SQL query into query state
 */
export function parseSQL(sql: string): ParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  try {
    // Normalize SQL
    const normalized = normalizeSQL(sql);
    
    // Try to parse different parts
    const tables = parseTables(normalized, warnings);
    const joins = parseJoins(normalized, warnings);
    const columns = parseColumns(normalized, warnings);
    const where = parseWhere(normalized, warnings);
    const groupBy = parseGroupBy(normalized, warnings);
    const orderBy = parseOrderBy(normalized, warnings);
    
    // Build state
    const state: Partial<QueryState> = {
      tables,
      joins,
      columns,
      where,
      groupBy,
      orderBy
    };
    
    return {
      success: errors.length === 0,
      state,
      warnings,
      errors
    };
  } catch (error) {
    errors.push(`Failed to parse SQL: ${error}`);
    return {
      success: false,
      warnings,
      errors
    };
  }
}

/**
 * Remove brackets from SQL Server identifiers
 */
function removeBrackets(identifier: string): string {
  if (!identifier) return identifier;
  return identifier.replace(/^\[|\]$/g, '').trim();
}

/**
 * Normalize SQL for easier parsing
 */
function normalizeSQL(sql: string): string {
  return sql
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse FROM clause for tables
 */
function parseTables(sql: string, warnings: string[]): { name: string; alias?: string }[] {
  // Match table name with optional brackets: FROM [TableName] alias or FROM TableName alias
  const fromMatch = sql.match(/FROM\s+(\[?\w+\]?)(?:\s+(?:AS\s+)?(\w+))?/i);
  
  if (!fromMatch) {
    warnings.push('Could not parse FROM clause');
    return [];
  }
  
  const tableName = removeBrackets(fromMatch[1]);
  const alias = fromMatch[2];
  
  // Don't treat JOIN keywords as alias
  if (alias && /^(INNER|LEFT|RIGHT|FULL|CROSS|JOIN|WHERE|GROUP|ORDER)$/i.test(alias)) {
    return [{ name: tableName }];
  }
  
  return [{
    name: tableName,
    alias: alias
  }];
}

/**
 * Parse JOIN clauses
 */
function parseJoins(sql: string, warnings: string[]): JoinConfig[] {
  const joins: JoinConfig[] = [];
  
  // Match different join types with optional brackets around table names
  const joinPattern = /(INNER|LEFT|RIGHT|FULL\s+OUTER|CROSS)?\s*JOIN\s+(\[?\w+\]?)(?:\s+(?:AS\s+)?(\w+))?\s*(?:ON\s+([^WHERE|GROUP|ORDER]+?))?(?=\s+(?:INNER|LEFT|RIGHT|FULL|CROSS|JOIN|WHERE|GROUP|ORDER|$))/gi;
  
  let match;
  while ((match = joinPattern.exec(sql)) !== null) {
    const joinType = (match[1] || 'INNER').toUpperCase().replace(/\s+/g, ' ') as any;
    const table = removeBrackets(match[2]);
    let alias: string | undefined = match[3];
    const onClause = match[4];
    
    // Don't treat ON keyword as alias
    if (alias && /^ON$/i.test(alias)) {
      alias = undefined;
    }
    
    const conditions = parseJoinConditions(onClause, warnings);
    
    joins.push({
      type: joinType === 'FULL OUTER' ? 'FULL OUTER' : joinType,
      table,
      alias,
      conditions
    });
  }
  
  return joins;
}

/**
 * Parse JOIN ON conditions
 */
function parseJoinConditions(onClause: string | undefined, _warnings: string[]): any[] {
  if (!onClause) return [];
  
  const conditions: any[] = [];
  
  // Split by AND/OR
  const parts = onClause.split(/\s+(AND|OR)\s+/i);
  
  for (let i = 0; i < parts.length; i += 2) {
    const condPart = parts[i].trim();
    const andOr = parts[i + 1] as 'AND' | 'OR' | undefined;
    
    // Match condition pattern: column operator column (with optional brackets)
    // Handles: [Table].[Column], Table.[Column], [Table].Column, Table.Column
    const condMatch = condPart.match(/((?:\[?\w+\]?\.)?(?:\[?\w+\]?))\s*(=|!=|<>|>|<|>=|<=)\s*((?:\[?\w+\]?\.)?(?:\[?\w+\]?))/);
    
    if (condMatch) {
      conditions.push({
        leftColumn: removeBrackets(condMatch[1]).replace(/\]\.\[/g, '.').replace(/\[|\]/g, ''),
        operator: condMatch[2] === '<>' ? '!=' : condMatch[2],
        rightColumn: removeBrackets(condMatch[3]).replace(/\]\.\[/g, '.').replace(/\[|\]/g, ''),
        andOr: i > 0 ? andOr : undefined
      });
    }
  }
  
  return conditions;
}

/**
 * Parse SELECT columns
 */
function parseColumns(sql: string, warnings: string[]): ColumnConfig[] {
  const columns: ColumnConfig[] = [];
  
  // Match SELECT ... FROM
  const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/is);
  
  if (!selectMatch) {
    warnings.push('Could not parse SELECT clause');
    return [];
  }
  
  const selectClause = selectMatch[1];
  
  // Handle SELECT *
  if (selectClause.trim() === '*') {
    warnings.push('SELECT * found - cannot parse into column list');
    return [];
  }
  
  // Split by commas (simple approach - doesn't handle nested functions perfectly)
  const columnParts = splitByComma(selectClause);
  
  for (const part of columnParts) {
    const col = parseColumnExpression(part, warnings);
    if (col) {
      columns.push(col);
    }
  }
  
  return columns;
}

/**
 * Parse individual column expression
 */
function parseColumnExpression(expr: string, warnings: string[]): ColumnConfig | null {
  expr = expr.trim();
  
  // Check for alias (AS keyword) - alias can also be bracketed
  const aliasMatch = expr.match(/^(.*)\s+AS\s+(\[?\w+\]?)$/i);
  const alias = aliasMatch ? removeBrackets(aliasMatch[2]) : undefined;
  const expression = aliasMatch ? aliasMatch[1].trim() : expr;
  
  // Check for window functions
  if (expression.match(/ROW_NUMBER|RANK|DENSE_RANK|NTILE|LAG|LEAD/i)) {
    warnings.push(`Window function detected - use visual builder to recreate: ${expression.substring(0, 50)}...`);
    return null;
  }
  
  // Check for aggregate functions (with optional brackets)
  const aggMatch = expression.match(/(SUM|AVG|COUNT|MIN|MAX)\s*\(\s*(.+?)\s*\)/i);
  if (aggMatch) {
    const colPart = removeBrackets(aggMatch[2]).replace(/\[|\]/g, '');
    return {
      type: 'aggregate',
      function: aggMatch[1].toUpperCase() as any,
      column: colPart,
      alias: alias || expression
    } as ColumnConfig;
  }
  
  // Check for simple column reference with brackets: [Table].[Column] or Table.[Column]
  const bracketMatch = expression.match(/^(\[?\w+\]?)\.(\[?\w+\]?)$/);
  if (bracketMatch) {
    return {
      type: 'simple',
      table: removeBrackets(bracketMatch[1]),
      column: removeBrackets(bracketMatch[2]),
      alias
    } as ColumnConfig;
  }
  
  // Check for column without table prefix (with optional brackets)
  if (expression.match(/^\[?\w+\]?$/)) {
    return {
      type: 'simple',
      table: '',
      column: removeBrackets(expression),
      alias
    } as ColumnConfig;
  }
  
  // Complex expression - mark as calculated but don't try to parse
  warnings.push(`Complex expression - use visual builder to recreate: ${expression.substring(0, 50)}...`);
  return null;
}

/**
 * Parse WHERE clause
 */
function parseWhere(sql: string, warnings: string[]): WhereCondition[] {
  const conditions: WhereCondition[] = [];
  
  const whereMatch = sql.match(/WHERE\s+(.*?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|$)/is);
  
  if (!whereMatch) {
    return [];
  }
  
  const whereClause = whereMatch[1].trim();
  
  // Split by AND/OR (simple approach)
  const parts = whereClause.split(/\s+(AND|OR)\s+/i);
  
  for (let i = 0; i < parts.length; i += 2) {
    const condPart = parts[i].trim();
    const andOr = parts[i + 1] as 'AND' | 'OR' | undefined;
    
    const cond = parseWhereCondition(condPart, warnings);
    if (cond) {
      if (i > 0) {
        cond.andOr = andOr;
      }
      conditions.push(cond);
    }
  }
  
  return conditions;
}

/**
 * Parse individual WHERE condition
 */
function parseWhereCondition(expr: string, warnings: string[]): WhereCondition | null {
  // Remove wrapping parentheses if present
  expr = expr.trim();
  if (expr.startsWith('(') && expr.endsWith(')')) {
    expr = expr.slice(1, -1).trim();
  }
  
  // IS NULL / IS NOT NULL (with optional brackets)
  const isNullMatch = expr.match(/((?:\[?\w+\]?\.)?(?:\[?\w+\]?))\s+IS\s+(NOT\s+)?NULL/i);
  if (isNullMatch) {
    return {
      column: removeBrackets(isNullMatch[1]).replace(/\[|\]/g, ''),
      operator: isNullMatch[2] ? 'IS NOT NULL' : 'IS NULL'
    };
  }
  
  // IN operator
  const inMatch = expr.match(/((?:\[?\w+\]?\.)?(?:\[?\w+\]?))\s+IN\s*\((.*?)\)/i);
  if (inMatch) {
    const values = inMatch[2].split(',').map(v => v.trim().replace(/'/g, ''));
    return {
      column: removeBrackets(inMatch[1]).replace(/\[|\]/g, ''),
      operator: 'IN',
      value: values
    };
  }
  
  // Standard operators (with optional brackets)
  const opMatch = expr.match(/((?:\[?\w+\]?\.)?(?:\[?\w+\]?))\s*(=|!=|<>|>|<|>=|<=|LIKE)\s*(.+)/i);
  if (opMatch) {
    const value = opMatch[3].trim();
    const isParameter = value.startsWith('@');
    
    return {
      column: removeBrackets(opMatch[1]).replace(/\[|\]/g, ''),
      operator: (opMatch[2] === '<>' ? '!=' : opMatch[2].toUpperCase()) as any,
      value: isParameter ? value : value.replace(/'/g, ''),
      isParameter
    };
  }
  
  warnings.push(`Could not parse filter: ${expr.substring(0, 50)}...`);
  return null;
}

/**
 * Parse GROUP BY clause
 */
function parseGroupBy(sql: string, _warnings: string[]): string[] {
  const groupByMatch = sql.match(/GROUP\s+BY\s+(.*?)(?:\s+HAVING|\s+ORDER\s+BY|$)/is);
  
  if (!groupByMatch) {
    return [];
  }
  
  return groupByMatch[1]
    .split(',')
    .map(col => removeBrackets(col.trim()).replace(/\[|\]/g, ''))
    .filter(col => col.length > 0);
}

/**
 * Parse ORDER BY clause
 */
function parseOrderBy(sql: string, _warnings: string[]): { column: string; direction: 'ASC' | 'DESC' }[] {
  const orderByMatch = sql.match(/ORDER\s+BY\s+(.+)$/is);
  
  if (!orderByMatch) {
    return [];
  }
  
  const orderItems = orderByMatch[1].split(',').map(item => item.trim());
  
  return orderItems.map(item => {
    const parts = item.split(/\s+/);
    const column = removeBrackets(parts[0]).replace(/\[|\]/g, '');
    const direction = (parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC') as 'ASC' | 'DESC';
    
    return { column, direction };
  });
}

/**
 * Split string by comma, respecting parentheses
 */
function splitByComma(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  return parts;
}

