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
 * Alias map type: maps alias -> table name
 */
type AliasMap = Record<string, string>;

/**
 * Build alias map from parsed tables and joins
 */
function buildAliasMap(tables: { name: string; alias?: string }[], joins: JoinConfig[]): AliasMap {
  const aliasMap: AliasMap = {};
  
  // Add FROM tables
  for (const table of tables) {
    if (table.alias) {
      aliasMap[table.alias.toLowerCase()] = table.name;
    }
    // Also add table name itself as an identity mapping
    aliasMap[table.name.toLowerCase()] = table.name;
  }
  
  // Add JOIN tables
  for (const join of joins) {
    if (join.alias) {
      aliasMap[join.alias.toLowerCase()] = join.table;
    }
    // Also add table name itself as an identity mapping
    aliasMap[join.table.toLowerCase()] = join.table;
  }
  
  return aliasMap;
}

/**
 * Resolve a column reference using alias map
 * e.g., "h.BillID" with aliasMap { h: "Header" } => "Header.BillID"
 */
function resolveColumnAlias(column: string, aliasMap: AliasMap): string {
  if (!column.includes('.')) {
    return column; // No table prefix
  }
  
  const [tableOrAlias, colName] = column.split('.');
  const resolvedTable = aliasMap[tableOrAlias.toLowerCase()] || tableOrAlias;
  return `${resolvedTable}.${colName}`;
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
    
    // First parse tables and joins to build alias map
    const tables = parseTables(normalized, warnings);
    const joins = parseJoins(normalized, warnings);
    
    // Build alias map
    const aliasMap = buildAliasMap(tables, joins);
    
    // Parse remaining clauses with alias resolution
    const columns = parseColumns(normalized, warnings, aliasMap);
    const where = parseWhere(normalized, warnings, aliasMap);
    const groupBy = parseGroupBy(normalized, warnings, aliasMap);
    const orderBy = parseOrderBy(normalized, warnings, aliasMap);
    
    // Also resolve aliases in join conditions
    for (const join of joins) {
      for (const cond of join.conditions) {
        cond.leftColumn = resolveColumnAlias(cond.leftColumn, aliasMap);
        cond.rightColumn = resolveColumnAlias(cond.rightColumn, aliasMap);
      }
    }
    
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
 * Remove SQL comments
 */
function removeComments(sql: string): string {
  // Remove single-line comments (-- comment)
  return sql
    .split('\n')
    .map(line => {
      const commentIndex = line.indexOf('--');
      if (commentIndex >= 0) {
        return line.substring(0, commentIndex);
      }
      return line;
    })
    .join('\n');
}

/**
 * Normalize SQL for easier parsing
 */
function normalizeSQL(sql: string): string {
  // First remove comments
  let cleaned = removeComments(sql);
  
  // Then normalize whitespace
  return cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse FROM clause for tables
 */
function parseTables(sql: string, warnings: string[]): { name: string; alias?: string }[] {
  // Find FROM clause - stop at JOIN, WHERE, GROUP, ORDER
  // FROM table_name [AS] alias
  const fromMatch = sql.match(/FROM\s+(\[?\w+\]?)(?:\s+(?:AS\s+)?(\w+))?(?=\s+(?:INNER|LEFT|RIGHT|FULL|CROSS|JOIN|WHERE|GROUP|ORDER|$))/i);
  
  if (!fromMatch) {
    // Try simpler match without lookahead
    const simpleMatch = sql.match(/FROM\s+(\[?\w+\]?)/i);
    if (simpleMatch) {
      return [{ name: removeBrackets(simpleMatch[1]) }];
    }
    warnings.push('Could not parse FROM clause');
    return [];
  }
  
  const tableName = removeBrackets(fromMatch[1]);
  const alias = fromMatch[2];
  
  // Don't treat SQL keywords as alias
  if (alias && /^(INNER|LEFT|RIGHT|FULL|CROSS|JOIN|WHERE|GROUP|ORDER|ON|AND|OR|AS)$/i.test(alias)) {
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
  
  // More robust approach: split by JOIN keyword and parse each part
  // First, find all JOINs in the SQL
  const joinMatches = sql.matchAll(/(INNER|LEFT|RIGHT|FULL\s+OUTER|CROSS)?\s*JOIN\s+/gi);
  const joinPositions: { start: number; type: string }[] = [];
  
  for (const m of joinMatches) {
    joinPositions.push({
      start: m.index!,
      type: (m[1] || 'INNER').toUpperCase().replace(/\s+/g, ' ')
    });
  }
  
  if (joinPositions.length === 0) return joins;
  
  // Find WHERE, GROUP BY, ORDER BY positions to know where JOINs end
  const wherePos = sql.search(/\bWHERE\b/i);
  const groupPos = sql.search(/\bGROUP\s+BY\b/i);
  const orderPos = sql.search(/\bORDER\s+BY\b/i);
  const endPositions = [wherePos, groupPos, orderPos, sql.length].filter(p => p >= 0);
  const joinEndPos = Math.min(...endPositions);
  
  // Parse each JOIN
  for (let i = 0; i < joinPositions.length; i++) {
    const joinStart = joinPositions[i].start;
    const joinType = joinPositions[i].type as any;
    
    // Find where this JOIN's clause ends (next JOIN or end of JOINs section)
    const nextJoinStart = i < joinPositions.length - 1 ? joinPositions[i + 1].start : joinEndPos;
    
    // Extract the JOIN clause text
    const joinClause = sql.substring(joinStart, nextJoinStart).trim();
    
    // Parse: [JOIN_TYPE] JOIN table_name [alias] [ON conditions]
    const joinMatch = joinClause.match(/(?:INNER|LEFT|RIGHT|FULL\s+OUTER|CROSS)?\s*JOIN\s+(\[?\w+\]?)(?:\s+(?:AS\s+)?(\w+))?\s*(?:ON\s+(.+))?$/i);
    
    if (joinMatch) {
      const table = removeBrackets(joinMatch[1]);
      let alias: string | undefined = joinMatch[2];
      const onClause = joinMatch[3];
      
      // Don't treat SQL keywords as alias
      if (alias && /^(ON|INNER|LEFT|RIGHT|FULL|CROSS|JOIN|WHERE|GROUP|ORDER|AND|OR)$/i.test(alias)) {
        alias = undefined;
      }
      
      const conditions = parseJoinConditions(onClause, warnings);
      
      // Only add if we have a valid table name
      if (table && table.length > 0) {
        joins.push({
          type: joinType === 'FULL OUTER' ? 'FULL OUTER' : joinType,
          table,
          alias,
          conditions
        });
      }
    } else {
      warnings.push(`Could not parse JOIN clause: ${joinClause.substring(0, 50)}...`);
    }
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
function parseColumns(sql: string, warnings: string[], aliasMap: AliasMap): ColumnConfig[] {
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
    const col = parseColumnExpression(part, warnings, aliasMap);
    if (col) {
      columns.push(col);
    }
  }
  
  return columns;
}

/**
 * Extract inner expression from nested parentheses
 */
function extractInnerExpression(expr: string, startIndex: number): { inner: string; endIndex: number } | null {
  if (expr[startIndex] !== '(') return null;
  
  let depth = 0;
  let i = startIndex;
  while (i < expr.length) {
    if (expr[i] === '(') depth++;
    if (expr[i] === ')') {
      depth--;
      if (depth === 0) {
        return {
          inner: expr.substring(startIndex + 1, i),
          endIndex: i + 1
        };
      }
    }
    i++;
  }
  return null;
}

/**
 * Parse CAST expression
 */
function parseCastExpression(expr: string, aliasMap: AliasMap): { innerExpr: string; dataType: string } | null {
  // Match CAST(expression AS datatype) or TRY_CAST(expression AS datatype)
  // Handle datatypes like DECIMAL(18,2), VARCHAR(255), etc.
  // Use a more robust approach: find the AS keyword and split there
  const castMatch = expr.match(/^(?:TRY_)?CAST\s*\(\s*(.+?)\s+AS\s+(.+?)\s*\)$/is);
  if (castMatch) {
    // The datatype might contain parentheses (e.g., DECIMAL(18,2))
    // So we need to be more careful
    let innerExpr = castMatch[1].trim();
    let dataType = castMatch[2].trim();
    
    // If datatype ends with ), it might have captured too much
    // Try to find the actual AS keyword position
    const asIndex = expr.toUpperCase().indexOf(' AS ');
    if (asIndex > 0) {
      // Find the opening parenthesis
      const openParen = expr.indexOf('(');
      if (openParen >= 0 && asIndex > openParen) {
        innerExpr = expr.substring(openParen + 1, asIndex).trim();
        // Find the closing parenthesis from the end
        const closeParen = expr.lastIndexOf(')');
        if (closeParen > asIndex) {
          dataType = expr.substring(asIndex + 4, closeParen).trim();
        }
      }
    }
    
    return {
      innerExpr,
      dataType
    };
  }
  return null;
}

/**
 * Parse ISNULL expression
 */
function parseIsNullExpression(expr: string): { checkExpr: string; replacement: string } | null {
  const isnullMatch = expr.match(/^ISNULL\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)$/i);
  if (isnullMatch) {
    return {
      checkExpr: isnullMatch[1].trim(),
      replacement: isnullMatch[2].trim()
    };
  }
  return null;
}

/**
 * Parse individual column expression
 */
function parseColumnExpression(expr: string, warnings: string[], aliasMap: AliasMap): ColumnConfig | null {
  expr = expr.trim();
  if (!expr) return null;
  
  // Check for alias (AS keyword) - alias can also be bracketed
  // Handle AS at the end, but be careful with AS in CAST(... AS ...)
  let alias: string | undefined = undefined;
  let expression = expr;
  
  // Find the last "AS" that's not inside parentheses (this is the alias AS)
  // We do this by finding AS from the end and checking if it's outside parentheses
  let lastAsIndex = -1;
  let depth = 0;
  for (let i = expr.length - 1; i >= 0; i--) {
    if (expr[i] === ')') depth++;
    else if (expr[i] === '(') depth--;
    else if (depth === 0 && i > 0 && expr.substring(i - 1, i + 2).toUpperCase() === ' AS ') {
      lastAsIndex = i;
      break;
    }
  }
  
  if (lastAsIndex > 0) {
    // Check if the part after AS looks like an alias (simple identifier)
    const afterAs = expr.substring(lastAsIndex + 3).trim();
    const aliasMatch = afterAs.match(/^(\[?\w+\]?)$/);
    if (aliasMatch) {
      alias = removeBrackets(aliasMatch[1]);
      expression = expr.substring(0, lastAsIndex).trim();
    }
  }
  
  // Check for window functions
  if (expression.match(/ROW_NUMBER|RANK|DENSE_RANK|NTILE|LAG|LEAD/i)) {
    warnings.push(`Window function detected - use visual builder to recreate: ${expression.substring(0, 50)}...`);
    return null;
  }
  
  // Check for aggregate functions (with optional brackets)
  const aggMatch = expression.match(/(SUM|AVG|COUNT|MIN|MAX)\s*\(\s*(.+?)\s*\)/i);
  if (aggMatch) {
    let colPart = removeBrackets(aggMatch[2]).replace(/\[|\]/g, '');
    colPart = resolveColumnAlias(colPart, aliasMap);
    return {
      type: 'aggregate',
      function: aggMatch[1].toUpperCase() as any,
      column: colPart,
      alias: alias || expression
    } as ColumnConfig;
  }
  
  // Check for CAST expressions - these should be treated as calculated columns
  const castInfo = parseCastExpression(expression, aliasMap);
  if (castInfo) {
    // Store as calculated column - the ExpressionBuilder can handle CAST expressions
    // No warning needed since we can edit it in the visual builder
    return {
      type: 'calculated',
      alias: alias,
      expression: {
        type: 'literal',
        value: expression // Store the full CAST expression
      }
    } as ColumnConfig;
  }
  
  // Check for ISNULL expressions
  const isnullInfo = parseIsNullExpression(expression);
  if (isnullInfo) {
    // Store as calculated column - no warning needed
    return {
      type: 'calculated',
      alias: alias,
      expression: {
        type: 'literal',
        value: expression // Store the full ISNULL expression
      }
    } as ColumnConfig;
  }
  
  // Check for any expression containing CAST (including nested, arithmetic, etc.)
  if (expression.match(/CAST\s*\(/i) || expression.match(/TRY_CAST\s*\(/i)) {
    // Store as calculated column - no warning needed
    return {
      type: 'calculated',
      alias: alias,
      expression: {
        type: 'literal',
        value: expression
      }
    } as ColumnConfig;
  }
  
  // Check for simple column reference with brackets: [Table].[Column] or Table.[Column]
  const bracketMatch = expression.match(/^(\[?\w+\]?)\.(\[?\w+\]?)$/);
  if (bracketMatch) {
    const tableOrAlias = removeBrackets(bracketMatch[1]);
    const resolvedTable = aliasMap[tableOrAlias.toLowerCase()] || tableOrAlias;
    return {
      type: 'simple',
      table: resolvedTable,
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
  
  // For other complex expressions, store as calculated column instead of warning
  // This allows the user to edit them in the visual builder
  return {
    type: 'calculated',
    alias: alias,
    expression: {
      type: 'literal',
      value: expression
    }
  } as ColumnConfig;
}

/**
 * Parse WHERE clause
 */
function parseWhere(sql: string, warnings: string[], aliasMap: AliasMap): WhereCondition[] {
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
    
    const cond = parseWhereCondition(condPart, warnings, aliasMap);
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
function parseWhereCondition(expr: string, warnings: string[], aliasMap: AliasMap): WhereCondition | null {
  // Remove wrapping parentheses if present
  expr = expr.trim();
  if (expr.startsWith('(') && expr.endsWith(')')) {
    expr = expr.slice(1, -1).trim();
  }
  
  // IS NULL / IS NOT NULL (with optional brackets)
  const isNullMatch = expr.match(/((?:\[?\w+\]?\.)?(?:\[?\w+\]?))\s+IS\s+(NOT\s+)?NULL/i);
  if (isNullMatch) {
    let column = removeBrackets(isNullMatch[1]).replace(/\[|\]/g, '');
    column = resolveColumnAlias(column, aliasMap);
    return {
      column,
      operator: isNullMatch[2] ? 'IS NOT NULL' : 'IS NULL'
    };
  }
  
  // IN operator
  const inMatch = expr.match(/((?:\[?\w+\]?\.)?(?:\[?\w+\]?))\s+IN\s*\((.*?)\)/i);
  if (inMatch) {
    const values = inMatch[2].split(',').map(v => v.trim().replace(/'/g, ''));
    let column = removeBrackets(inMatch[1]).replace(/\[|\]/g, '');
    column = resolveColumnAlias(column, aliasMap);
    return {
      column,
      operator: 'IN',
      value: values
    };
  }
  
  // Standard operators (with optional brackets)
  const opMatch = expr.match(/((?:\[?\w+\]?\.)?(?:\[?\w+\]?))\s*(=|!=|<>|>|<|>=|<=|LIKE)\s*(.+)/i);
  if (opMatch) {
    const value = opMatch[3].trim();
    const isParameter = value.startsWith('@');
    let column = removeBrackets(opMatch[1]).replace(/\[|\]/g, '');
    column = resolveColumnAlias(column, aliasMap);
    
    return {
      column,
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
function parseGroupBy(sql: string, _warnings: string[], aliasMap: AliasMap): string[] {
  const groupByMatch = sql.match(/GROUP\s+BY\s+(.*?)(?:\s+HAVING|\s+ORDER\s+BY|$)/is);
  
  if (!groupByMatch) {
    return [];
  }
  
  return groupByMatch[1]
    .split(',')
    .map(col => {
      const cleaned = removeBrackets(col.trim()).replace(/\[|\]/g, '');
      return resolveColumnAlias(cleaned, aliasMap);
    })
    .filter(col => col.length > 0);
}

/**
 * Parse ORDER BY clause
 */
function parseOrderBy(sql: string, _warnings: string[], aliasMap: AliasMap): { column: string; direction: 'ASC' | 'DESC' }[] {
  const orderByMatch = sql.match(/ORDER\s+BY\s+(.+)$/is);
  
  if (!orderByMatch) {
    return [];
  }
  
  const orderItems = orderByMatch[1].split(',').map(item => item.trim());
  
  return orderItems.map(item => {
    const parts = item.split(/\s+/);
    let column = removeBrackets(parts[0]).replace(/\[|\]/g, '');
    column = resolveColumnAlias(column, aliasMap);
    const direction = (parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC') as 'ASC' | 'DESC';
    
    return { column, direction };
  });
}

/**
 * Split string by comma, respecting parentheses and brackets
 */
function splitByComma(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inBrackets = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = i < str.length - 1 ? str[i + 1] : '';
    
    if (char === '[') {
      inBrackets = true;
      current += char;
    } else if (char === ']') {
      inBrackets = false;
      current += char;
    } else if (char === '(' && !inBrackets) {
      depth++;
      current += char;
    } else if (char === ')' && !inBrackets) {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0 && !inBrackets) {
      const trimmed = current.trim();
      if (trimmed) {
        parts.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  const trimmed = current.trim();
  if (trimmed) {
    parts.push(trimmed);
  }
  
  return parts;
}

