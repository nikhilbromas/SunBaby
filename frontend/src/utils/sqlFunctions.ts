/**
 * SQL Server function library with categorized functions and metadata.
 * Used by the ExpressionBuilder and query builder components.
 */

import type { SQLFunction } from '../services/types';

export const SQL_FUNCTIONS: SQLFunction[] = [
  // Conversion Functions
  {
    name: 'CAST',
    category: 'Conversion',
    signature: 'CAST(expression AS datatype)',
    description: 'Converts an expression to a specified data type',
    example: 'CAST(OrderDate AS DATE)',
    parameters: [
      { name: 'expression', type: 'any', required: true, description: 'Expression to convert' },
      { name: 'datatype', type: 'datatype', required: true, description: 'Target data type' }
    ]
  },
  {
    name: 'CONVERT',
    category: 'Conversion',
    signature: 'CONVERT(datatype, expression [, style])',
    description: 'Converts an expression to a specified data type with optional style',
    example: 'CONVERT(VARCHAR, OrderDate, 112)',
    parameters: [
      { name: 'datatype', type: 'datatype', required: true },
      { name: 'expression', type: 'any', required: true },
      { name: 'style', type: 'int', required: false, description: 'Format style code' }
    ]
  },
  {
    name: 'TRY_CAST',
    category: 'Conversion',
    signature: 'TRY_CAST(expression AS datatype)',
    description: 'Tries to convert expression; returns NULL if conversion fails',
    example: 'TRY_CAST(CustomerID AS INT)',
    parameters: [
      { name: 'expression', type: 'any', required: true },
      { name: 'datatype', type: 'datatype', required: true }
    ]
  },
  {
    name: 'TRY_CONVERT',
    category: 'Conversion',
    signature: 'TRY_CONVERT(datatype, expression [, style])',
    description: 'Tries to convert expression; returns NULL if conversion fails',
    example: 'TRY_CONVERT(INT, CustomerID)',
    parameters: [
      { name: 'datatype', type: 'datatype', required: true },
      { name: 'expression', type: 'any', required: true },
      { name: 'style', type: 'int', required: false }
    ]
  },

  // Date/Time Functions
  {
    name: 'FORMAT',
    category: 'Date/Time',
    signature: 'FORMAT(value, format [, culture])',
    description: 'Formats a value with specified format pattern',
    example: "FORMAT(OrderDate, 'yyyy-MM-dd')",
    parameters: [
      { name: 'value', type: 'any', required: true },
      { name: 'format', type: 'string', required: true },
      { name: 'culture', type: 'string', required: false }
    ]
  },
  {
    name: 'GETDATE',
    category: 'Date/Time',
    signature: 'GETDATE()',
    description: 'Returns current date and time',
    example: 'GETDATE()',
    parameters: []
  },
  {
    name: 'DATEADD',
    category: 'Date/Time',
    signature: 'DATEADD(datepart, number, date)',
    description: 'Adds an interval to a date',
    example: "DATEADD(day, 7, OrderDate)",
    parameters: [
      { name: 'datepart', type: 'datepart', required: true },
      { name: 'number', type: 'int', required: true },
      { name: 'date', type: 'datetime', required: true }
    ]
  },
  {
    name: 'DATEDIFF',
    category: 'Date/Time',
    signature: 'DATEDIFF(datepart, startdate, enddate)',
    description: 'Returns difference between two dates',
    example: "DATEDIFF(day, StartDate, EndDate)",
    parameters: [
      { name: 'datepart', type: 'datepart', required: true },
      { name: 'startdate', type: 'datetime', required: true },
      { name: 'enddate', type: 'datetime', required: true }
    ]
  },
  {
    name: 'YEAR',
    category: 'Date/Time',
    signature: 'YEAR(date)',
    description: 'Returns year part of a date',
    example: 'YEAR(OrderDate)',
    parameters: [{ name: 'date', type: 'datetime', required: true }]
  },
  {
    name: 'MONTH',
    category: 'Date/Time',
    signature: 'MONTH(date)',
    description: 'Returns month part of a date',
    example: 'MONTH(OrderDate)',
    parameters: [{ name: 'date', type: 'datetime', required: true }]
  },
  {
    name: 'DAY',
    category: 'Date/Time',
    signature: 'DAY(date)',
    description: 'Returns day part of a date',
    example: 'DAY(OrderDate)',
    parameters: [{ name: 'date', type: 'datetime', required: true }]
  },

  // String Functions
  {
    name: 'CONCAT',
    category: 'String',
    signature: 'CONCAT(string1, string2, ...)',
    description: 'Concatenates two or more strings',
    example: "CONCAT(FirstName, ' ', LastName)",
    parameters: [
      { name: 'string1', type: 'string', required: true },
      { name: 'string2', type: 'string', required: true }
    ]
  },
  {
    name: 'SUBSTRING',
    category: 'String',
    signature: 'SUBSTRING(string, start, length)',
    description: 'Extracts part of a string',
    example: 'SUBSTRING(ProductName, 1, 10)',
    parameters: [
      { name: 'string', type: 'string', required: true },
      { name: 'start', type: 'int', required: true },
      { name: 'length', type: 'int', required: true }
    ]
  },
  {
    name: 'LEFT',
    category: 'String',
    signature: 'LEFT(string, length)',
    description: 'Returns left part of string',
    example: 'LEFT(ProductName, 5)',
    parameters: [
      { name: 'string', type: 'string', required: true },
      { name: 'length', type: 'int', required: true }
    ]
  },
  {
    name: 'RIGHT',
    category: 'String',
    signature: 'RIGHT(string, length)',
    description: 'Returns right part of string',
    example: 'RIGHT(ProductName, 5)',
    parameters: [
      { name: 'string', type: 'string', required: true },
      { name: 'length', type: 'int', required: true }
    ]
  },
  {
    name: 'UPPER',
    category: 'String',
    signature: 'UPPER(string)',
    description: 'Converts string to uppercase',
    example: 'UPPER(ProductName)',
    parameters: [{ name: 'string', type: 'string', required: true }]
  },
  {
    name: 'LOWER',
    category: 'String',
    signature: 'LOWER(string)',
    description: 'Converts string to lowercase',
    example: 'LOWER(ProductName)',
    parameters: [{ name: 'string', type: 'string', required: true }]
  },
  {
    name: 'TRIM',
    category: 'String',
    signature: 'TRIM([characters FROM] string)',
    description: 'Removes leading and trailing spaces',
    example: 'TRIM(ProductName)',
    parameters: [{ name: 'string', type: 'string', required: true }]
  },
  {
    name: 'LEN',
    category: 'String',
    signature: 'LEN(string)',
    description: 'Returns length of string',
    example: 'LEN(ProductName)',
    parameters: [{ name: 'string', type: 'string', required: true }]
  },
  {
    name: 'REPLACE',
    category: 'String',
    signature: 'REPLACE(string, find, replace)',
    description: 'Replaces occurrences in string',
    example: "REPLACE(ProductName, 'Old', 'New')",
    parameters: [
      { name: 'string', type: 'string', required: true },
      { name: 'find', type: 'string', required: true },
      { name: 'replace', type: 'string', required: true }
    ]
  },

  // Null Handling
  {
    name: 'ISNULL',
    category: 'Null Handling',
    signature: 'ISNULL(check_expression, replacement_value)',
    description: 'Replaces NULL with specified value',
    example: 'ISNULL(Discount, 0)',
    parameters: [
      { name: 'check_expression', type: 'any', required: true },
      { name: 'replacement_value', type: 'any', required: true }
    ]
  },
  {
    name: 'COALESCE',
    category: 'Null Handling',
    signature: 'COALESCE(value1, value2, ...)',
    description: 'Returns first non-NULL value',
    example: 'COALESCE(Discount, AlternateDiscount, 0)',
    parameters: [
      { name: 'value1', type: 'any', required: true },
      { name: 'value2', type: 'any', required: true }
    ]
  },
  {
    name: 'NULLIF',
    category: 'Null Handling',
    signature: 'NULLIF(expression1, expression2)',
    description: 'Returns NULL if expressions are equal',
    example: 'NULLIF(Quantity, 0)',
    parameters: [
      { name: 'expression1', type: 'any', required: true },
      { name: 'expression2', type: 'any', required: true }
    ]
  },

  // Aggregate Functions
  {
    name: 'SUM',
    category: 'Aggregate',
    signature: 'SUM([DISTINCT] expression)',
    description: 'Returns sum of values',
    example: 'SUM(Amount)',
    parameters: [{ name: 'expression', type: 'numeric', required: true }]
  },
  {
    name: 'AVG',
    category: 'Aggregate',
    signature: 'AVG([DISTINCT] expression)',
    description: 'Returns average of values',
    example: 'AVG(Price)',
    parameters: [{ name: 'expression', type: 'numeric', required: true }]
  },
  {
    name: 'COUNT',
    category: 'Aggregate',
    signature: 'COUNT({* | [DISTINCT] expression})',
    description: 'Returns count of values',
    example: 'COUNT(*)',
    parameters: [{ name: 'expression', type: 'any', required: false }]
  },
  {
    name: 'MIN',
    category: 'Aggregate',
    signature: 'MIN([DISTINCT] expression)',
    description: 'Returns minimum value',
    example: 'MIN(Price)',
    parameters: [{ name: 'expression', type: 'any', required: true }]
  },
  {
    name: 'MAX',
    category: 'Aggregate',
    signature: 'MAX([DISTINCT] expression)',
    description: 'Returns maximum value',
    example: 'MAX(Price)',
    parameters: [{ name: 'expression', type: 'any', required: true }]
  },

  // Mathematical Functions
  {
    name: 'ROUND',
    category: 'Mathematical',
    signature: 'ROUND(numeric_expression, length [, function])',
    description: 'Rounds numeric value to specified precision',
    example: 'ROUND(Price, 2)',
    parameters: [
      { name: 'numeric_expression', type: 'numeric', required: true },
      { name: 'length', type: 'int', required: true },
      { name: 'function', type: 'int', required: false }
    ]
  },
  {
    name: 'CEILING',
    category: 'Mathematical',
    signature: 'CEILING(numeric_expression)',
    description: 'Returns smallest integer >= value',
    example: 'CEILING(Price)',
    parameters: [{ name: 'numeric_expression', type: 'numeric', required: true }]
  },
  {
    name: 'FLOOR',
    category: 'Mathematical',
    signature: 'FLOOR(numeric_expression)',
    description: 'Returns largest integer <= value',
    example: 'FLOOR(Price)',
    parameters: [{ name: 'numeric_expression', type: 'numeric', required: true }]
  },
  {
    name: 'ABS',
    category: 'Mathematical',
    signature: 'ABS(numeric_expression)',
    description: 'Returns absolute value',
    example: 'ABS(Balance)',
    parameters: [{ name: 'numeric_expression', type: 'numeric', required: true }]
  },
  {
    name: 'POWER',
    category: 'Mathematical',
    signature: 'POWER(float_expression, y)',
    description: 'Returns value raised to power',
    example: 'POWER(2, 8)',
    parameters: [
      { name: 'float_expression', type: 'numeric', required: true },
      { name: 'y', type: 'numeric', required: true }
    ]
  },
  {
    name: 'SQRT',
    category: 'Mathematical',
    signature: 'SQRT(float_expression)',
    description: 'Returns square root',
    example: 'SQRT(Area)',
    parameters: [{ name: 'float_expression', type: 'numeric', required: true }]
  }
];

export const SQL_FUNCTION_CATEGORIES = [
  'Conversion',
  'Date/Time',
  'String',
  'Null Handling',
  'Aggregate',
  'Mathematical'
];

/**
 * Get functions by category
 */
export function getFunctionsByCategory(category: string): SQLFunction[] {
  return SQL_FUNCTIONS.filter(f => f.category === category);
}

/**
 * Search functions by name or description
 */
export function searchFunctions(query: string): SQLFunction[] {
  const lowerQuery = query.toLowerCase();
  return SQL_FUNCTIONS.filter(
    f => f.name.toLowerCase().includes(lowerQuery) || 
         f.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get function by name
 */
export function getFunctionByName(name: string): SQLFunction | undefined {
  return SQL_FUNCTIONS.find(f => f.name.toUpperCase() === name.toUpperCase());
}

