
/**
 * Shared utility functions for the Phantom PiNet DApp.
 */

/**
 * Escape a string for safe use in MDS SQL queries.
 * MDS SQL does not support parameterized queries, so we use robust escaping.
 */
export function escapeSql(value: string): string {
    if (!value) return '';
    return value
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/'/g, "''")     // Escape single quotes for SQL
        .replace(/\0/g, '');     // Remove null bytes
}

/**
 * Escape a string for safe use in MDS command parameters (double-quoted strings).
 */
export function escapeCmd(value: string): string {
    if (!value) return '';
    return value
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/"/g, '\\"');    // Escape double quotes
}

/**
 * Truncate a hex string (like a public key or hash) for display.
 */
export const DISPLAY_TRUNCATE_LENGTH = 12;

export function truncateHex(hex: string, length: number = DISPLAY_TRUNCATE_LENGTH): string {
    if (!hex || hex.length <= length) return hex;
    return `${hex.slice(0, length)}...`;
}
